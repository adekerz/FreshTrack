/**
 * requireVerifiedEmail - Middleware to ensure user email is verified
 * Returns 403 if email is not verified
 * 
 * TODO: Apply this middleware to sensitive endpoints:
 * - Password reset endpoints (when implemented)
 * - Change email endpoint (when implemented)
 * - Sensitive profile updates
 * - Join request creation (already handled in auth.service.register)
 * 
 * Usage:
 * router.post('/sensitive-endpoint', authMiddleware, requireVerifiedEmail, handler)
 */

export function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    })
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      error: 'Email not verified',
      needsVerification: true
    })
  }

  next()
}
