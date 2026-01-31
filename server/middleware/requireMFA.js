/**
 * Require MFA Middleware
 * Enforces MFA for users who have mfa_required = true
 * Includes grace period for SUPER_ADMIN
 * MFA отключена в development при DISABLE_MFA_IN_DEV=true
 */

import { logWarn } from '../utils/logger.js'

const isMfaDisabledInDev = () =>
  process.env.NODE_ENV === 'development' && process.env.DISABLE_MFA_IN_DEV === 'true'

export function requireMFA(req, res, next) {
  if (isMfaDisabledInDev()) return next()

  const { mfa_required, mfa_enabled, mfa_grace_period_ends } = req.user
  
  if (!mfa_required) {
    return next() // MFA не требуется для этой роли
  }
  
  if (mfa_enabled) {
    return next() // MFA включен, все ОК
  }
  
  // Проверка grace period
  const now = new Date()
  const graceEnds = mfa_grace_period_ends ? new Date(mfa_grace_period_ends) : null
  
  if (graceEnds && now < graceEnds) {
    // Grace period еще активен
    const daysLeft = Math.ceil((graceEnds - now) / (1000 * 60 * 60 * 24))
    
    // Warning в response headers
    res.setHeader('X-MFA-Warning', `MFA required in ${daysLeft} days`)
    res.setHeader('X-MFA-Grace-Period-Ends', graceEnds.toISOString())
    
    return next() // Разрешаем доступ, но предупреждаем
  }
  
  // Grace period истек или не установлен
  return res.status(403).json({
    success: false,
    error: 'MFA setup required',
    requiresMFASetup: true,
    gracePeriodExpired: true,
    message: 'Your account requires multi-factor authentication. Grace period has expired. Please set up MFA in account settings.'
  })
}
