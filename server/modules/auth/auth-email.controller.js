/**
 * Auth Email Controller
 *
 * Routes: /verification-status, /verify-email-otp, /request-email-verification,
 *         /resend-email-otp, /change-email, /verify-email-change
 */

import { Router } from 'express'
import { AuthService } from './auth.service.js'
import { authMiddleware, generateToken } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError } from '../../utils/logger.js'
import { EmailVerificationService } from '../../services/EmailVerificationService.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { setTokenCookie } from './auth-cookies.js'

const router = Router()

// ═══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auth/verification-status
 * Статус верификации email (только OTP-коды)
 */
router.get('/verification-status', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id

  const userResult = await dbQuery(`
    SELECT email, email_verified
    FROM users WHERE id = $1
  `, [userId])

  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  const user = userResult.rows[0]

  res.json({
    success: true,
    verified: user.email_verified || false,
    email: user.email,
    canResend: true
  })
}))

// ═══════════════════════════════════════════════════════════════
// EMAIL OTP VERIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/verify-email-otp
 * Verify email OTP code after registration
 */
router.post('/verify-email-otp', asyncHandler(async (req, res) => {
  const { partialToken, otp } = req.body

  if (!partialToken || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: partialToken and otp'
    })
  }

  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid OTP format. Must be 6 digits.'
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

  if (!decoded.emailVerificationPending) {
    return res.status(400).json({
      success: false,
      error: 'Invalid token'
    })
  }

  // Verify OTP
  const verifyResult = await EmailVerificationService.verifyOTP(decoded.userId, otp)

  // Get full user data
  const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [decoded.userId])
  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Create join request if hotel_id exists
  if (user.hotel_id) {
    const { createJoinRequest } = await import('../../db/database.js')
    await createJoinRequest(user.id, user.hotel_id)
  }

  // Generate full token
  const token = generateToken(user)

  // Format user response
  const userData = await AuthService.formatUserResponse(user, true)

  // Audit log
  await logAudit({
    user_id: user.id,
    user_name: user.name || user.login,
    hotel_id: user.hotel_id,
    action: 'EMAIL_VERIFIED',
    entity_type: 'User',
    entity_id: user.id,
    details: { email: user.email }
  })

  setTokenCookie(res, token)
  res.json({
    success: true,
    token,
    user: userData,
    message: 'Email verified successfully'
  })
}))

/**
 * POST /api/auth/request-email-verification
 * Запросить OTP для подтверждения email (для залогиненных без email_verified)
 * Вызывается после MFA, когда пользователь попал на verify-email без partialToken
 */
router.post('/request-email-verification', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id
  const userResult = await dbQuery(
    'SELECT id, email, email_verified FROM users WHERE id = $1',
    [userId]
  )
  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }
  const user = userResult.rows[0]
  if (user.email_verified) {
    return res.status(400).json({
      success: false,
      error: 'Email already verified'
    })
  }
  if (!user.email) {
    return res.status(400).json({
      success: false,
      error: 'No email to verify'
    })
  }

  const canResend = await EmailVerificationService.canResendOTP(user.id)
  if (!canResend) {
    return res.status(429).json({
      success: false,
      error: 'Please wait before requesting a new code',
      cooldownSeconds: EmailVerificationService.RESEND_COOLDOWN_SECONDS
    })
  }

  const result = await EmailVerificationService.sendOTP(
    user.id,
    user.email,
    'REGISTRATION'
  )

  const partialToken = jwt.sign(
    { userId: user.id, emailVerificationPending: true },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  )

  res.json({
    success: true,
    partialToken,
    email: user.email,
    expiresAt: result.expiresAt,
    cooldownSeconds: result.cooldownSeconds
  })
}))

/**
 * POST /api/auth/resend-email-otp
 * Resend OTP code
 */
router.post('/resend-email-otp', asyncHandler(async (req, res) => {
  const { partialToken } = req.body

  if (!partialToken) {
    return res.status(400).json({
      success: false,
      error: 'partialToken is required'
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

  // Get user data
  const userResult = await dbQuery('SELECT id, email FROM users WHERE id = $1', [decoded.userId])
  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Check cooldown
  const canResend = await EmailVerificationService.canResendOTP(user.id)
  if (!canResend) {
    return res.status(429).json({
      success: false,
      error: 'Please wait before requesting a new code'
    })
  }

  // Send new OTP
  const result = await EmailVerificationService.sendOTP(
    user.id,
    user.email,
    'REGISTRATION'
  )

  res.json({
    success: true,
    expiresAt: result.expiresAt,
    cooldownSeconds: result.cooldownSeconds,
    message: 'New OTP sent to your email'
  })
}))

// ═══════════════════════════════════════════════════════════════
// PROFILE MANAGEMENT ENDPOINTS (Email Change)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/change-email
 * Request email change (requires password verification)
 */
router.post('/change-email', authMiddleware, asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body

  if (!newEmail || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: newEmail and password'
    })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(newEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    })
  }

  // Verify current password
  const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [req.user.id])
  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid password'
    })
  }

  // Check if email is already in use
  const existingEmail = await dbQuery(
    'SELECT id FROM users WHERE email = $1 AND id != $2',
    [newEmail, req.user.id]
  )

  if (existingEmail.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Email already in use'
    })
  }

  // Save pending email
  await dbQuery(
    'UPDATE users SET pending_email = $1 WHERE id = $2',
    [newEmail, req.user.id]
  )

  // Send OTP to NEW email
  const otpResult = await EmailVerificationService.sendOTP(
    req.user.id,
    newEmail,
    'EMAIL_CHANGE'
  )

  // Generate partial token
  const partialToken = jwt.sign(
    { userId: req.user.id, emailChangePending: true },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  )

  // Audit log
  await logAudit({
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    hotel_id: req.user.hotel_id,
    action: 'EMAIL_CHANGE_REQUESTED',
    entity_type: 'User',
    entity_id: req.user.id,
    details: { oldEmail: user.email, newEmail }
  })

  res.json({
    success: true,
    partialToken,
    newEmail,
    expiresAt: otpResult.expiresAt,
    cooldownSeconds: otpResult.cooldownSeconds,
    message: 'OTP sent to new email'
  })
}))

/**
 * POST /api/auth/verify-email-change
 * Verify email change OTP
 */
router.post('/verify-email-change', authMiddleware, asyncHandler(async (req, res) => {
  const { partialToken, otp } = req.body

  if (!partialToken || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: partialToken and otp'
    })
  }

  // Validate OTP format
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid OTP format. Must be 6 digits.'
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

  if (!decoded.emailChangePending || decoded.userId !== req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Invalid token'
    })
  }

  // Verify OTP
  await EmailVerificationService.verifyOTP(decoded.userId, otp)

  // Apply new email
  const { rows } = await dbQuery(
    `UPDATE users
     SET email = pending_email,
         pending_email = NULL,
         email_verified = TRUE
     WHERE id = $1
     RETURNING email`,
    [decoded.userId]
  )

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  // Audit log
  await logAudit({
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    hotel_id: req.user.hotel_id,
    action: 'EMAIL_CHANGED',
    entity_type: 'User',
    entity_id: req.user.id,
    details: { newEmail: rows[0].email }
  })

  res.json({
    success: true,
    email: rows[0].email,
    message: 'Email changed successfully'
  })
}))

export default router
