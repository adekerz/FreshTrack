/**
 * asyncHandler - wraps async route handlers to forward errors to Express error handler.
 * Eliminates try/catch boilerplate in controllers.
 *
 * Works with the global error handler in server/index.js
 * and Sentry.setupExpressErrorHandler(app).
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function} Express middleware that catches rejected promises
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export default asyncHandler
