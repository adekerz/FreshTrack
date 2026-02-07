/**
 * Auth Account Controller
 *
 * Routes: /password (PUT), /change-password, /accept-terms, /terms-status
 */

import { Router } from 'express'
import {
  ChangePasswordSchema,
  validate
} from './auth.schemas.js'
import { AuthService } from './auth.service.js'
import { authMiddleware, generateToken } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError } from '../../utils/logger.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { setTokenCookie } from './auth-cookies.js'

const router = Router()

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENT_TERMS_VERSION = '1.0'

/**
 * PUT /api/auth/password
 * Смена пароля текущего пользователя
 */
router.put('/password', authMiddleware, asyncHandler(async (req, res) => {
  const validation = validate(ChangePasswordSchema, req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: validation.errors
    })
  }

  const result = await AuthService.changePassword(
    req.user.id,
    validation.data.currentPassword,
    validation.data.newPassword
  )

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  await logAudit({
    hotel_id: req.user.hotel_id,
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    action: 'UPDATE',
    entity_type: 'user',
    entity_id: req.user.id,
    details: { field: 'password' },
    ip_address: req.ip
  })

  res.json({ message: 'Пароль изменён' })
}))

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: currentPassword and newPassword'
    })
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters'
    })
  }

  // Get user
  const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [req.user.id])
  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Check if user has a password set
  if (!user.password_hash || user.password_hash === null) {
    return res.status(400).json({
      success: false,
      error: 'Password not set. Please set a password first.'
    })
  }

  // Verify current password (ensure password_hash is a string)
  const passwordMatch = await bcrypt.compare(currentPassword, String(user.password_hash))
  if (!passwordMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid current password'
    })
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  // Update password
  await dbQuery(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [hashedPassword, req.user.id]
  )

  // Audit log
  await logAudit({
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    hotel_id: req.user.hotel_id,
    action: 'PASSWORD_CHANGE',
    entity_type: 'user',
    entity_id: req.user.id,
    details: {},
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  })

  res.json({
    success: true,
    message: 'Password changed successfully'
  })
}))

// ═══════════════════════════════════════════════════════════════
// TERMS ACCEPTANCE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/accept-terms
 * Accept Terms of Service and Privacy Policy
 * Uses partialToken for multi-step auth flow
 */
router.post('/accept-terms', asyncHandler(async (req, res) => {
  const { partialToken, termsVersion } = req.body

  if (!partialToken) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: partialToken'
    })
  }

  // Verify version matches current version
  if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
    return res.status(400).json({
      success: false,
      error: 'Invalid terms version. Please refresh the page.'
    })
  }

  // Verify partial token
  let decoded
  try {
    decoded = jwt.verify(partialToken, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }

  if (!decoded.termsAcceptancePending) {
    return res.status(400).json({
      success: false,
      error: 'Invalid token type'
    })
  }

  const userId = decoded.userId

  // Get user data
  const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [userId])
  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Update terms acceptance
  await dbQuery(`
    UPDATE users
    SET terms_accepted = TRUE,
        terms_accepted_at = NOW(),
        terms_version = $1
    WHERE id = $2
  `, [CURRENT_TERMS_VERSION, userId])

  // Generate full token
  const token = generateToken(user)

  // Format user response
  const userData = await AuthService.formatUserResponse(user, true)

  // Audit log
  await logAudit({
    user_id: userId,
    user_name: user.name || user.login,
    hotel_id: user.hotel_id,
    action: 'TERMS_ACCEPTED',
    entity_type: 'User',
    entity_id: userId,
    details: {
      termsVersion: CURRENT_TERMS_VERSION,
      acceptedAt: new Date().toISOString()
    },
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  })

  setTokenCookie(res, token)
  res.json({
    success: true,
    token,
    user: userData,
    message: 'Terms accepted successfully'
  })
}))

/**
 * GET /api/auth/terms-status
 * Get current terms acceptance status
 */
router.get('/terms-status', authMiddleware, asyncHandler(async (req, res) => {
  const userResult = await dbQuery(`
    SELECT terms_accepted, terms_accepted_at, terms_version
    FROM users WHERE id = $1
  `, [req.user.id])

  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  const { terms_accepted, terms_accepted_at, terms_version } = userResult.rows[0]

  res.json({
    success: true,
    termsAccepted: terms_accepted || false,
    termsAcceptedAt: terms_accepted_at,
    termsVersion: terms_version,
    currentVersion: CURRENT_TERMS_VERSION,
    needsAcceptance: !terms_accepted || terms_version !== CURRENT_TERMS_VERSION
  })
}))

export default router
