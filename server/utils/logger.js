/**
 * FreshTrack Server Logger
 * Centralized logging utility with environment-aware behavior
 */

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Log levels
 */
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(level, context, message, meta = null) {
  const timestamp = new Date().toISOString()
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
  return `[${timestamp}] [${level}] [${context}] ${message}${metaStr}`
}

/**
 * Log debug message (only in development)
 */
export function logDebug(context, message, meta = null) {
  if (isDev) {
    console.log(formatMessage(LogLevel.DEBUG, context, message, meta))
  }
}

/**
 * Log info message
 */
export function logInfo(context, message, meta = null) {
  console.log(formatMessage(LogLevel.INFO, context, message, meta))
}

/**
 * Log warning message
 */
export function logWarn(context, message, meta = null) {
  console.warn(formatMessage(LogLevel.WARN, context, message, meta))
}

/**
 * Log error message
 */
export function logError(context, error, meta = null) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error && isDev ? error.stack : undefined
  
  console.error(formatMessage(LogLevel.ERROR, context, errorMessage, meta))
  
  if (errorStack) {
    console.error(errorStack)
  }
}

/**
 * Request logger middleware (only in development)
 */
export function requestLogger(req, res, next) {
  if (isDev) {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${req.method} ${req.path}`)
  }
  next()
}

/**
 * Simple rate limiter for public endpoints
 */
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 60 // 60 requests per minute

export function simpleRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  const now = Date.now()
  
  // Clean old entries
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key)
    }
  }
  
  const clientData = rateLimitMap.get(ip)
  
  if (!clientData) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 })
    return next()
  }
  
  if (now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 })
    return next()
  }
  
  clientData.count++
  
  if (clientData.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.'
    })
  }
  
  next()
}

export default {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  requestLogger,
  simpleRateLimit
}
