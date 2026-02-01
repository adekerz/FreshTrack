/**
 * FreshTrack Rate Limiter Middleware
 * Protection against DoS attacks using rate-limiter-flexible
 * PRODUCTION: Uses Redis for distributed rate limiting
 * DEVELOPMENT: Uses in-memory rate limiting
 */

import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible'
import { logWarn, logError } from '../utils/logger.js'
import Redis from 'ioredis'

/**
 * Rate limiter configurations for different endpoint types
 */

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production'

// Redis client for production (distributed rate limiting)
let redisClient = null
let useRedis = false

if (isProduction && process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      }
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully for rate limiting')
      useRedis = true
    })

  } catch (error) {
    console.error('[Redis] Failed to initialize:', error.message)
    console.warn('[Redis] Falling back to in-memory rate limiting')
  }
}

/**
 * Create rate limiter with Redis or Memory fallback
 */
function createRateLimiter(config) {
  if (useRedis && redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      ...config,
      keyPrefix: config.keyPrefix || 'rl',
    })
  }
  return new RateLimiterMemory(config)
}

/**
 * Key generator: IP + userId for better isolation
 */
function keyGenerator(req) {
  const userId = req.user?.id || 'anonymous'
  const ip = req.ip || req.connection?.remoteAddress || 'unknown'
  return `${ip}:${userId}`
}

// General API rate limiter - комфортные лимиты для production
const generalLimiter = createRateLimiter({
  keyPrefix: 'rl:general',
  points: isProduction ? 300 : 1000, // 300 req/min в проде (было 100)
  duration: 60,
  blockDuration: isProduction ? 30 : 10, // Блокировка 30 сек (было 60)
})

// Auth endpoints - stricter limits (20 attempts per 15 minutes)
const authLimiter = createRateLimiter({
  keyPrefix: 'rl:auth',
  points: isProduction ? 20 : 500,
  duration: isProduction ? 15 * 60 : 60,
  blockDuration: isProduction ? 5 * 60 : 10, // Block for 5 minutes in prod
})

// Heavy endpoints - export, reports (10 requests per minute)
const heavyLimiter = createRateLimiter({
  keyPrefix: 'rl:heavy',
  points: isProduction ? 10 : 100,
  duration: 60,
  blockDuration: isProduction ? 60 : 10,
})

// Pending status check - light limit (checked every 30s by waiting users)
const pendingStatusLimiter = createRateLimiter({
  keyPrefix: 'rl:pending',
  points: isProduction ? 120 : 1000, // 2 per second
  duration: 60,
  blockDuration: 10,
})

// Webhook endpoints - 60 requests per minute
const webhookLimiter = createRateLimiter({
  keyPrefix: 'rl:webhook',
  points: 60,
  duration: 60,
  blockDuration: isProduction ? 60 : 10,
})

// Login endpoint - very strict (5 attempts per 15 minutes)
const loginLimiter = createRateLimiter({
  keyPrefix: 'rl:login',
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
})

// Export rate limiter - strict limit for data exports (10 per hour)
const exportLimiter = createRateLimiter({
  keyPrefix: 'rl:export',
  points: parseInt(process.env.EXPORT_RATE_LIMIT_MAX) || 10,
  duration: parseInt(process.env.EXPORT_RATE_LIMIT_WINDOW) || 60 * 60, // 1 hour in seconds
  blockDuration: 60 * 60 // Block for 1 hour if exceeded
})

/**
 * Rate limiter middleware factory
 */
function rateLimiterMiddleware(limiter, name = 'API') {
  return async (req, res, next) => {
    try {
      const key = keyGenerator(req)
      const result = await limiter.consume(key)

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points)
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints)
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString())

      next()
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000)

      res.setHeader('Retry-After', retryAfter)
      res.setHeader('X-RateLimit-Limit', limiter.points)
      res.setHeader('X-RateLimit-Remaining', 0)
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString())

      logWarn('RateLimiter', `${name} limit exceeded for ${req.ip}`, {
        clientId: keyGenerator(req),
        path: req.path,
        retryAfter
      })

      res.status(429).json({
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter
      })
    }
  }
}

// Export middleware
export const rateLimitGeneral = rateLimiterMiddleware(generalLimiter, 'General')
export const rateLimitAuth = rateLimiterMiddleware(authLimiter, 'Auth')
export const rateLimitHeavy = rateLimiterMiddleware(heavyLimiter, 'Heavy')
export const rateLimitPendingStatus = rateLimiterMiddleware(pendingStatusLimiter, 'PendingStatus')
export const rateLimitWebhook = rateLimiterMiddleware(webhookLimiter, 'Webhook')
export const rateLimitLogin = rateLimiterMiddleware(loginLimiter, 'Login')
export const rateLimitExport = rateLimiterMiddleware(exportLimiter, 'Export')

/**
 * Export rate limiter with security alerting
 * Sends alert when limit exceeded
 */
export async function rateLimitExportWithAlert(req, res, next) {
  const clientId = keyGenerator(req)

  try {
    await exportLimiter.consume(clientId)
    next()
  } catch (rateLimiterRes) {
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000)

    logWarn('RateLimiter', `Export rate limit exceeded`, {
      clientId,
      path: req.path,
      retryAfter,
      userId: req.user?.id
    })

    // Send security alert
    if (req.user) {
      try {
        const { SecurityAlertService } = await import('../services/SecurityAlertService.js')
        await SecurityAlertService.sendAlert('export_suspicious', {
          userId: req.user.id,
          userLogin: req.user.login,
          userEmail: req.user.email,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          endpoint: req.originalUrl,
          exceedCount: 10,
          timestamp: new Date().toISOString()
        })
      } catch (alertError) {
        logError('RateLimiter', 'Failed to send security alert', alertError)
      }
    }

    res.setHeader('Retry-After', retryAfter)
    res.setHeader('X-RateLimit-Limit', exportLimiter.points)
    res.setHeader('X-RateLimit-Remaining', 0)
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString())

    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many export requests. Security team has been notified.',
      retryAfter
    })
  }
}

/**
 * Slow down middleware - add delay after certain number of requests
 * Useful for slowing down scrapers without blocking
 */
const slowDownLimiter = createRateLimiter({
  keyPrefix: 'rl:slowdown',
  points: 50,
  duration: 60
})

export async function slowDown(req, res, next) {
  const clientId = keyGenerator(req)

  try {
    const rateLimiterRes = await slowDownLimiter.consume(clientId, 0) // Just check, don't consume
    const remaining = rateLimiterRes.remainingPoints

    // Add delay after 30 requests
    if (remaining < 20) {
      const delay = (20 - remaining) * 50 // 50ms per request over limit
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    next()
  } catch {
    next()
  }
}

// Graceful shutdown
export async function shutdownRateLimiter() {
  if (redisClient) {
    await redisClient.quit()
    console.log('[Redis] Rate limiter disconnected')
  }
}

export default {
  general: rateLimitGeneral,
  auth: rateLimitAuth,
  login: rateLimitLogin,
  heavy: rateLimitHeavy,
  webhook: rateLimitWebhook,
  pendingStatus: rateLimitPendingStatus,
  export: rateLimitExport,
  exportWithAlert: rateLimitExportWithAlert,
  slowDown
}
