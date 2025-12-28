/**
 * FreshTrack Sentry Integration
 * Production error tracking and monitoring
 */

import * as Sentry from '@sentry/node'
import { logInfo, logError } from '../utils/logger.js'

const isProduction = process.env.NODE_ENV === 'production'
const sentryDsn = process.env.SENTRY_DSN

/**
 * Initialize Sentry for error tracking
 */
export function initSentry(app) {
  if (!sentryDsn) {
    if (isProduction) {
      logInfo('Sentry', 'SENTRY_DSN not configured - error tracking disabled')
    }
    return
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'freshtrack@2.0.0',
    
    // Performance monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization
        delete event.request.headers.cookie
      }
      
      // Remove sensitive body data
      if (event.request?.data) {
        const data = typeof event.request.data === 'string' 
          ? JSON.parse(event.request.data) 
          : event.request.data
        
        if (data.password) data.password = '[FILTERED]'
        if (data.token) data.token = '[FILTERED]'
        if (data.secret) data.secret = '[FILTERED]'
        
        event.request.data = JSON.stringify(data)
      }
      
      return event
    },
    
    // Ignore certain errors
    ignoreErrors: [
      'TokenExpiredError',
      'JsonWebTokenError',
      'NotFoundError',
      /^Rate limit exceeded/
    ]
  })

  logInfo('Sentry', 'Initialized error tracking')
}

/**
 * Sentry request handler - add to beginning of middleware chain
 */
export function sentryRequestHandler() {
  if (!sentryDsn) {
    return (req, res, next) => next()
  }
  return Sentry.Handlers.requestHandler()
}

/**
 * Sentry tracing handler for performance monitoring
 */
export function sentryTracingHandler() {
  if (!sentryDsn) {
    return (req, res, next) => next()
  }
  return Sentry.Handlers.tracingHandler()
}

/**
 * Sentry error handler - add after all routes
 */
export function sentryErrorHandler() {
  if (!sentryDsn) {
    return (err, req, res, next) => next(err)
  }
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only report 500 errors and unhandled exceptions
      return !error.status || error.status >= 500
    }
  })
}

/**
 * Capture exception manually
 */
export function captureException(error, context = {}) {
  if (!sentryDsn) {
    logError('Sentry', error, context)
    return
  }
  
  Sentry.withScope(scope => {
    if (context.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
        role: context.user.role
      })
    }
    
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }
    
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }
    
    Sentry.captureException(error)
  })
}

/**
 * Capture message manually
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!sentryDsn) {
    logInfo('Sentry', message, context)
    return
  }
  
  Sentry.withScope(scope => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value)
      })
    }
    
    Sentry.captureMessage(message, level)
  })
}

/**
 * Set user context for all subsequent events
 */
export function setUser(user) {
  if (!sentryDsn) return
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
    hotelId: user.hotelId
  })
}

/**
 * Clear user context
 */
export function clearUser() {
  if (!sentryDsn) return
  Sentry.setUser(null)
}

export default {
  init: initSentry,
  requestHandler: sentryRequestHandler,
  tracingHandler: sentryTracingHandler,
  errorHandler: sentryErrorHandler,
  captureException,
  captureMessage,
  setUser,
  clearUser
}
