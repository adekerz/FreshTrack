/**
 * Sentry Instrumentation - Must be imported first!
 * This file initializes Sentry before any other code runs.
 */

import * as Sentry from '@sentry/node'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const sentryDsn = process.env.SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'freshtrack@2.0.0',
    
    // Send default PII (IP addresses, etc.)
    sendDefaultPii: true,
    
    // Performance monitoring - 10% in production, 100% in dev
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Filter sensitive data before sending
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization
        delete event.request.headers.cookie
      }
      return event
    },
    
    // Ignore common non-critical errors
    ignoreErrors: [
      'TokenExpiredError',
      'JsonWebTokenError',
      /^Rate limit exceeded/
    ]
  })
  
  console.log('✅ Sentry initialized for error tracking')
} else {
  console.log('ℹ️ Sentry DSN not configured - error tracking disabled')
}

export default Sentry
