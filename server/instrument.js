/**
 * Sentry Instrumentation
 * Must be imported before any other modules
 * 
 * This file initializes Sentry for the Node.js runtime.
 * It should be the first import in index.js
 */

import * as Sentry from '@sentry/node'

const isProduction = process.env.NODE_ENV === 'production'
const sentryDsn = process.env.SENTRY_DSN

// Only initialize Sentry if DSN is configured
if (sentryDsn) {
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
        try {
          const data = typeof event.request.data === 'string' 
            ? JSON.parse(event.request.data) 
            : event.request.data
          
          if (data.password) data.password = '[FILTERED]'
          if (data.token) data.token = '[FILTERED]'
          if (data.secret) data.secret = '[FILTERED]'
          
          event.request.data = JSON.stringify(data)
        } catch (e) {
          // Ignore parsing errors
        }
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
  
  console.log('✅ Sentry initialized')
} else if (isProduction) {
  console.log('⚠️ SENTRY_DSN not configured - error tracking disabled')
}
