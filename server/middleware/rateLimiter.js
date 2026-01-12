/**
 * FreshTrack Rate Limiter Middleware
 * Protection against DoS attacks using rate-limiter-flexible
 */

import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'
import { logWarn } from '../utils/logger.js'

/**
 * Rate limiter configurations for different endpoint types
 */

// General API rate limiter - 100 requests per minute
const isProduction = process.env.NODE_ENV === 'production'

const generalLimiter = new RateLimiterMemory({
  points: isProduction ? 100 : 1000,
  duration: 60,
  blockDuration: isProduction ? 60 : 10 // Block for 1 minute in prod, 10 sec in dev
})

// Auth endpoints - stricter limits (20 attempts per 15 minutes)
const authLimiter = new RateLimiterMemory({
  points: isProduction ? 20 : 500,
  duration: isProduction ? 15 * 60 : 60,
  blockDuration: isProduction ? 5 * 60 : 10 // Block for 5 minutes in prod
})

// Login specifically - strict but reasonable
// In development, disable rate limiting for easier testing
const loginLimiter = new RateLimiterMemory({
  points: isProduction ? 5 : 500,
  duration: isProduction ? 15 * 60 : 60,
  blockDuration: isProduction ? 30 * 60 : 10
})

// Heavy operations (export, reports) - 10 per minute
const heavyLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  blockDuration: 60
})

// Telegram/Webhook endpoints - 30 per minute
const webhookLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
  blockDuration: 120
})

// Pending status check - lightweight endpoint, 10 per minute per user
const pendingStatusLimiter = new RateLimiterMemory({
  points: isProduction ? 10 : 100,
  duration: 60,
  blockDuration: isProduction ? 60 : 10
})

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  // Use user ID if authenticated, otherwise IP
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

/**
 * General API rate limiter - apply to all routes
 */
export const rateLimitGeneral = createRateLimiterMiddleware(generalLimiter, 'general')

/**
 * Auth rate limiter - apply to /api/auth routes
 */
export const rateLimitAuth = createRateLimiterMiddleware(authLimiter, 'auth')

/**
 * Login rate limiter - apply specifically to login endpoint
 */
export const rateLimitLogin = createRateLimiterMiddleware(loginLimiter, 'login')

/**
 * Heavy operations rate limiter - apply to export, reports
 */
export const rateLimitHeavy = createRateLimiterMiddleware(heavyLimiter, 'heavy')

/**
 * Webhook rate limiter - apply to telegram, notifications
 */
export const rateLimitWebhook = createRateLimiterMiddleware(webhookLimiter, 'webhook')

/**
 * Pending status rate limiter - lightweight for pending users checking status
 */
export const rateLimitPendingStatus = createRateLimiterMiddleware(pendingStatusLimiter, 'pending-status')

/**
 * Slow down middleware - add delay after certain number of requests
 * Useful for slowing down scrapers without blocking
 */
const slowDownLimiter = new RateLimiterMemory({
  points: 50,
  duration: 60
})

export async function slowDown(req, res, next) {
  const clientId = getClientId(req)
  
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

export default {
  general: rateLimitGeneral,
  auth: rateLimitAuth,
  login: rateLimitLogin,
  heavy: rateLimitHeavy,
  webhook: rateLimitWebhook,
  pendingStatus: rateLimitPendingStatus,
  slowDown
}
