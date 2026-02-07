/**
 * FreshTrack Rate Limiter Middleware
 * Protection against DoS attacks using rate-limiter-flexible
 *
 * Uses Redis as persistent store (shared across instances, survives restarts).
 * Falls back to in-memory store if Redis is unavailable.
 */

import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'
import { logWarn, logInfo, logError } from '../utils/logger.js'

const isProduction = process.env.NODE_ENV === 'production'

// ─── Redis connection (lazy: только при REDIS_URL, без обязательной зависимости ioredis) ───

let redisClient = null
let useRedis = false

try {
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    const { default: Redis } = await import('ioredis')
    redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true
    })

    await redisClient.connect()
    useRedis = true
    logInfo('RateLimiter', 'Connected to Redis for persistent rate limiting')
  } else {
    logWarn('RateLimiter', 'REDIS_URL not set — falling back to in-memory rate limiting')
  }
} catch (err) {
  if (err?.code === 'ERR_MODULE_NOT_FOUND' && err?.message?.includes('ioredis')) {
    logWarn('RateLimiter', 'REDIS_URL set but ioredis not installed — falling back to in-memory. Add ioredis to dependencies to use Redis.')
  } else {
    logWarn('RateLimiter', `Redis unavailable, falling back to in-memory rate limiting: ${err.message}`)
  }
  redisClient = null
  useRedis = false
}

// ─── Limiter factory ─────────────────────────────────────────────────────────

/**
 * Create a rate limiter backed by Redis when available, Memory otherwise.
 */
function createLimiter(opts) {
  if (useRedis && redisClient) {
    try {
      return new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: opts.keyPrefix || 'rl',
        ...opts
      })
    } catch (err) {
      logWarn('RateLimiter', `Failed to create Redis limiter "${opts.keyPrefix}", using Memory: ${err.message}`)
    }
  }
  return new RateLimiterMemory(opts)
}

// ─── Limiter instances ───────────────────────────────────────────────────────

// General API rate limiter - 100 requests per minute
const generalLimiter = createLimiter({
  keyPrefix: 'rl_general',
  points: isProduction ? 100 : 1000,
  duration: 60,
  blockDuration: isProduction ? 60 : 10
})

// Auth endpoints - stricter limits (20 attempts per 15 minutes)
const authLimiter = createLimiter({
  keyPrefix: 'rl_auth',
  points: isProduction ? 20 : 500,
  duration: isProduction ? 15 * 60 : 60,
  blockDuration: isProduction ? 5 * 60 : 10
})

// Login specifically - strict but reasonable
const loginRatePoints = parseInt(process.env.RATE_LIMIT_LOGIN_POINTS) || (isProduction ? 10 : 500)
const loginRateDuration = parseInt(process.env.RATE_LIMIT_LOGIN_DURATION) || (isProduction ? 15 * 60 : 60)
const loginLimiter = createLimiter({
  keyPrefix: 'rl_login',
  points: loginRatePoints,
  duration: loginRateDuration,
  blockDuration: isProduction ? 15 * 60 : 10
})

// Heavy operations (export, reports) - 10 per minute
const heavyLimiter = createLimiter({
  keyPrefix: 'rl_heavy',
  points: 10,
  duration: 60,
  blockDuration: 60
})

// Strict rate limit for data export (10 per hour per user)
const exportLimiter = createLimiter({
  keyPrefix: 'rl_export',
  points: parseInt(process.env.EXPORT_RATE_LIMIT_MAX) || 10,
  duration: parseInt(process.env.EXPORT_RATE_LIMIT_WINDOW) || 60 * 60,
  blockDuration: 60 * 60
})

// Telegram/Webhook endpoints - 30 per minute
const webhookLimiter = createLimiter({
  keyPrefix: 'rl_webhook',
  points: 30,
  duration: 60,
  blockDuration: 120
})

// Pending status check - lightweight endpoint, 10 per minute per user
const pendingStatusLimiter = createLimiter({
  keyPrefix: 'rl_pending',
  points: isProduction ? 10 : 100,
  duration: 60,
  blockDuration: isProduction ? 60 : 10
})

// Slow down limiter (scraper deterrent)
const slowDownLimiter = createLimiter({
  keyPrefix: 'rl_slow',
  points: 50,
  duration: 60
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  if (req.user?.id) {
    return `user_${req.user.id}`
  }
  return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown'
}

/**
 * Create rate limiter middleware
 */
function createRateLimiterMiddleware(limiter, name) {
  return async (req, res, next) => {
    const clientId = getClientId(req)

    try {
      await limiter.consume(clientId)
      next()
    } catch (rejRes) {
      if (rejRes instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000)

        logWarn('RateLimiter', `Rate limit exceeded for ${name}`, {
          clientId,
          path: req.path,
          retryAfter
        })

        res.set('Retry-After', retryAfter)
        res.set('X-RateLimit-Limit', limiter.points)
        res.set('X-RateLimit-Remaining', rejRes.remainingPoints)
        res.set('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString())

        return res.status(429).json({
          success: false,
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
          retryAfter
        })
      }

      // Unknown error - let request through but log it
      logWarn('RateLimiter', 'Rate limiter error', { error: rejRes })
      next()
    }
  }
}

// ─── Exported middleware ─────────────────────────────────────────────────────

export const rateLimitGeneral = createRateLimiterMiddleware(generalLimiter, 'general')
export const rateLimitAuth = createRateLimiterMiddleware(authLimiter, 'auth')
export const rateLimitLogin = createRateLimiterMiddleware(loginLimiter, 'login')
export const rateLimitHeavy = createRateLimiterMiddleware(heavyLimiter, 'heavy')
export const rateLimitWebhook = createRateLimiterMiddleware(webhookLimiter, 'webhook')
export const rateLimitPendingStatus = createRateLimiterMiddleware(pendingStatusLimiter, 'pending-status')
export const rateLimitExport = createRateLimiterMiddleware(exportLimiter, 'export')

/**
 * Export rate limiter with security alerting
 */
export async function rateLimitExportWithAlert(req, res, next) {
  const clientId = getClientId(req)

  try {
    await exportLimiter.consume(clientId)
    next()
  } catch (rejRes) {
    if (rejRes instanceof RateLimiterRes) {
      const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000)

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

      res.set('Retry-After', retryAfter)
      res.set('X-RateLimit-Limit', exportLimiter.points)
      res.set('X-RateLimit-Remaining', rejRes.remainingPoints)
      res.set('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString())

      return res.status(429).json({
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many export requests. Security team has been notified.',
        retryAfter
      })
    }

    logWarn('RateLimiter', 'Rate limiter error', { error: rejRes })
    next()
  }
}

/**
 * Slow down middleware - add delay after certain number of requests
 */
export async function slowDown(req, res, next) {
  const clientId = getClientId(req)

  try {
    const rateLimiterRes = await slowDownLimiter.consume(clientId, 0)
    const remaining = rateLimiterRes.remainingPoints

    if (remaining < 20) {
      const delay = (20 - remaining) * 50
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    next()
  } catch {
    next()
  }
}

export default {
  general: rateLimitGeneral,
  auth: rateLimitAuth,
  login: rateLimitLogin,
  heavy: rateLimitHeavy,
  webhook: rateLimitWebhook,
  pendingStatus: rateLimitPendingStatus,
  slowDown
}
