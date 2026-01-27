/**
 * IP Allowlist Middleware
 * Restricts access to sensitive endpoints based on IP address
 */

import { logWarn } from '../utils/logger.js'

export function requireAllowlistedIP(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next() // Skip в dev
  }
  
  const allowedIPs = process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) || []
  
  if (allowedIPs.length === 0) {
    return next() // Если не настроено, пропускаем
  }
  
  // Get client IP (consider X-Forwarded-For for proxies)
  const forwardedFor = req.headers['x-forwarded-for']
  const clientIP = forwardedFor 
    ? forwardedFor.split(',')[0].trim() 
    : req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress
  
  if (allowedIPs.includes(clientIP)) {
    return next()
  }
  
  logWarn('IPAllowlist', `Rejected request from non-allowlisted IP: ${clientIP}`, {
    path: req.path,
    method: req.method,
    user: req.user?.id
  })
  
  res.status(403).json({
    success: false,
    error: 'Access denied',
    message: 'Your IP address is not authorized for this action'
  })
}
