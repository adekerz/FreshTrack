/**
 * FreshTrack Server Logger
 * JSON structured logging для Railway/production (один JSON на строку).
 * В development — читаемый текст.
 */

const isDev = process.env.NODE_ENV !== 'production'
const useJson = process.env.LOG_FORMAT === 'json' || (process.env.NODE_ENV === 'production' && process.env.LOG_FORMAT !== 'text')

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
 * Вывод одной строки (JSON или текст). В production по умолчанию JSON для парсинга в Railway.
 */
function write(level, context, message, meta = null, errorDetails = null) {
  const timestamp = new Date().toISOString()
  if (useJson) {
    const payload = {
      timestamp,
      level,
      context,
      message: typeof message === 'string' ? message : String(message)
    }
    if (meta != null && typeof meta === 'object' && Object.keys(meta).length > 0) {
      payload.meta = meta
    }
    if (errorDetails != null) {
      payload.error = errorDetails
    }
    const out = level === LogLevel.ERROR ? process.stderr : process.stdout
    out.write(JSON.stringify(payload) + '\n')
  } else {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    const text = `[${timestamp}] [${level}] [${context}] ${message}${metaStr}`
    if (level === LogLevel.ERROR) {
      process.stderr.write(text + '\n')
      if (errorDetails?.stack) process.stderr.write(errorDetails.stack + '\n')
    } else {
      process.stdout.write(text + '\n')
    }
  }
}

/**
 * Log debug message (only in development, не в production)
 */
export function logDebug(context, message, meta = null) {
  if (isDev) {
    write(LogLevel.DEBUG, context, message, meta)
  }
}

/**
 * Log info message
 */
export function logInfo(context, message, meta = null) {
  write(LogLevel.INFO, context, message, meta)
}

/**
 * Log warning message
 */
export function logWarn(context, message, meta = null) {
  write(LogLevel.WARN, context, message, meta)
}

/**
 * Log error message
 */
export function logError(context, error, meta = null) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorDetails = error instanceof Error
    ? { message: error.message, ...(error.stack && { stack: error.stack }) }
    : { message: errorMessage }
  if (useJson) {
    write(LogLevel.ERROR, context, errorMessage, meta, errorDetails)
  } else {
    write(LogLevel.ERROR, context, errorMessage, meta, error instanceof Error ? { stack: error.stack } : null)
  }
}

/**
 * Request logger middleware (only in development)
 */
export function requestLogger(req, res, next) {
  if (isDev) {
    write(LogLevel.INFO, 'Request', `${req.method} ${req.path}`, null)
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
