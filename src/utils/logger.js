/**
 * FreshTrack Logger Utility
 * Conditional logging based on environment
 * Production: no console output, future: send to monitoring service
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

/**
 * Log debug information (dev only)
 */
export function logDebug(message, ...args) {
  if (isDev) {
    console.log(`[DEBUG] ${message}`, ...args)
  }
}

/**
 * Log info (dev only)
 */
export function logInfo(message, ...args) {
  if (isDev) {
    console.info(`[INFO] ${message}`, ...args)
  }
}

/**
 * Log warning (dev only, could send to monitoring in prod)
 */
export function logWarn(message, ...args) {
  if (isDev) {
    console.warn(`[WARN] ${message}`, ...args)
  }
  // TODO: In production, send to Sentry/LogRocket
}

/**
 * Log error (always log, but sanitize in production)
 */
export function logError(context, error) {
  if (isDev) {
    console.error(`[ERROR] ${context}:`, error)
  } else {
    // In production: sanitize and log without stack trace
    console.error(`[ERROR] ${context}: ${error?.message || 'Unknown error'}`)
    // TODO: Send to error monitoring service
  }
}

/**
 * Log API calls (dev only)
 */
export function logApi(method, endpoint, data) {
  if (isDev) {
    console.log(`[API] ${method} ${endpoint}`, data ? { data } : '')
  }
}

export default {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  api: logApi
}
