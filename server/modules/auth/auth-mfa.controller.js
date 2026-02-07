/**
 * Auth MFA Controller
 *
 * Routes: /mfa/setup, /mfa/verify-setup, /mfa/verify, /mfa/disable,
 *         /mfa/status, /mfa/request-recovery, /mfa/emergency-recover,
 *         /mfa/admin-reset/:userId, /mfa/recovery-requests
 */

import { Router } from 'express'
import { AuthService } from './auth.service.js'
import { authMiddleware, generateToken, superAdminOnly } from '../../middleware/auth.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError, logWarn } from '../../utils/logger.js'
import { MFAService } from '../../services/MFAService.js'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { setTokenCookie } from './auth-cookies.js'

const router = Router()

// ═══════════════════════════════════════════════════════════════
// MFA ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/mfa/setup
 * Setup MFA (только для залогиненных юзеров)
 */
router.post('/mfa/setup', authMiddleware, asyncHandler(async (req, res) => {
  const { id: userId, login, mfa_enabled } = req.user

  if (mfa_enabled) {
    return res.status(400).json({ success: false, error: 'MFA already enabled' })
  }

  const result = await MFAService.setupMFA(userId, login)

  res.json({
    success: true,
    secret: result.secret,
    qrCode: result.qrCode,
    backupCodes: result.backupCodes,
    message: 'Save backup codes securely. They cannot be retrieved later.'
  })
}))

/**
 * POST /api/auth/mfa/verify-setup
 * Verify and enable MFA
 */
router.post('/mfa/verify-setup', authMiddleware, asyncHandler(async (req, res) => {
  const { token } = req.body
  const { id: userId, mfa_enabled } = req.user
  const ipAddress = req.ip
  const userAgent = req.get('user-agent')

  // Проверяем, что MFA еще не включено
  if (mfa_enabled) {
    return res.status(400).json({ success: false, error: 'MFA is already enabled' })
  }

  // Проверяем формат токена
  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
  }

  // Проверяем, что секрет установлен (после setup)
  const userResult = await dbQuery('SELECT mfa_secret FROM users WHERE id = $1', [userId])
  if (userResult.rows.length === 0 || !userResult.rows[0].mfa_secret) {
    return res.status(400).json({ success: false, error: 'MFA setup not completed. Please run setup first.' })
  }

  // Проверяем код
  await MFAService.verifyTOTP(userId, token, ipAddress, userAgent)

  // Активируем MFA
  await MFAService.enableMFA(userId)

  res.json({ success: true, message: 'MFA enabled successfully' })
}))

/**
 * POST /api/auth/mfa/verify
 * Verify MFA и завершить login
 */
router.post('/mfa/verify', asyncHandler(async (req, res) => {
  const { partialToken, code, useBackup } = req.body
  const ipAddress = req.ip
  const userAgent = req.get('user-agent')

  if (!partialToken || !code) {
    return res.status(400).json({ success: false, error: 'Token and code required' })
  }

  // Декодируем partial token
  let decoded
  try {
    decoded = jwt.verify(partialToken, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(400).json({ success: false, error: 'Invalid or expired token' })
  }

  if (!decoded.mfaPending) {
    return res.status(400).json({ success: false, error: 'Invalid token' })
  }

  const userId = decoded.userId

  // Верификация
  if (useBackup) {
    await MFAService.verifyBackupCode(userId, code, ipAddress, userAgent)
  } else {
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
    }
    await MFAService.verifyTOTP(userId, code, ipAddress, userAgent)
  }

  // Получаем полные данные пользователя
  const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [userId])
  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  const user = userResult.rows[0]

  // Check terms acceptance after MFA (skip if disabled in dev)
  const MFA_TERMS_VERSION = '1.0'
  const termsCheckDisabledInDev =
    process.env.NODE_ENV === 'development' && process.env.DISABLE_TERMS_CHECK_IN_DEV === 'true'

  if (!termsCheckDisabledInDev) {
    const needsTermsAcceptance = !user.terms_accepted || user.terms_version !== MFA_TERMS_VERSION

    if (needsTermsAcceptance) {
      const termsPartialToken = jwt.sign(
        { userId: user.id, termsAcceptancePending: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      )

      return res.json({
        success: true,
        requiresTermsAcceptance: true,
        partialToken: termsPartialToken,
        currentTermsVersion: MFA_TERMS_VERSION,
        message: 'Please review and accept Terms of Service and Privacy Policy'
      })
    }
  }

  // Выдаем полный token
  const token = generateToken(user)

  // Форматируем ответ
  const userData = await AuthService.formatUserResponse(user, true)

  setTokenCookie(res, token)
  res.json({
    success: true,
    token,
    user: userData
  })
}))

/**
 * POST /api/auth/mfa/disable
 * Disable MFA
 */
router.post('/mfa/disable', authMiddleware, asyncHandler(async (req, res) => {
  const { token } = req.body
  const { id: userId } = req.user
  const ipAddress = req.ip
  const userAgent = req.get('user-agent')

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
  }

  await MFAService.disableMFA(userId, token, ipAddress, userAgent)

  res.json({ success: true, message: 'MFA disabled' })
}))

/**
 * GET /api/auth/mfa/status
 * Get MFA status
 */
router.get('/mfa/status', authMiddleware, asyncHandler(async (req, res) => {
  const userResult = await dbQuery(
    'SELECT mfa_enabled, mfa_required, mfa_backup_codes, mfa_grace_period_ends FROM users WHERE id = $1',
    [req.user.id]
  )

  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  const { mfa_enabled, mfa_required, mfa_backup_codes, mfa_grace_period_ends } = userResult.rows[0]

  const now = new Date()
  const graceEnds = mfa_grace_period_ends ? new Date(mfa_grace_period_ends) : null
  const daysLeft = graceEnds && now < graceEnds
    ? Math.ceil((graceEnds - now) / (1000 * 60 * 60 * 24))
    : null

  const mfaDisabledInDev =
    process.env.NODE_ENV === 'development' && process.env.DISABLE_MFA_IN_DEV === 'true'

  res.json({
    success: true,
    enabled: mfa_enabled || false,
    required: mfa_required || false,
    backupCodesCount: mfa_backup_codes ? mfa_backup_codes.length : 0,
    gracePeriodEnds: graceEnds ? graceEnds.toISOString() : null,
    gracePeriodDaysLeft: daysLeft,
    mfaDisabledInDev: mfaDisabledInDev
  })
}))

/**
 * POST /api/auth/mfa/request-recovery
 * Request MFA recovery assistance (creates ticket for admin)
 * If user is the ONLY active SUPER_ADMIN, provides emergency email recovery
 */
router.post('/mfa/request-recovery', asyncHandler(async (req, res) => {
  const { email, login, reason } = req.body

  if (!email || !login) {
    return res.status(400).json({
      success: false,
      error: 'Email and login are required'
    })
  }

  // Verify user exists
  const userResult = await dbQuery(
    'SELECT id, name, role FROM users WHERE email = $1 AND login = $2',
    [email, login]
  )

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    })
  }

  const user = userResult.rows[0]

  // Check if this is the ONLY active SUPER_ADMIN (emergency case)
  const activeAdminsResult = await dbQuery(`
    SELECT COUNT(*) as count FROM users
    WHERE role = 'SUPER_ADMIN'
      AND is_active = TRUE
      AND email IS NOT NULL
      AND id != $1
  `, [user.id])

  const otherActiveAdmins = parseInt(activeAdminsResult.rows[0].count)
  const isOnlySuperAdmin = user.role === 'SUPER_ADMIN' && otherActiveAdmins === 0

  // Create recovery request
  const requestId = uuidv4()
  await dbQuery(`
    INSERT INTO mfa_recovery_requests
    (id, email, login, reason, status, created_at)
    VALUES ($1, $2, $3, $4, 'PENDING', NOW())
  `, [requestId, email, login, reason || null])

  // Emergency recovery: if this is the ONLY SUPER_ADMIN, send email recovery link
  if (isOnlySuperAdmin) {
    const recoveryToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours validity

    // Store recovery token
    await dbQuery(`
      INSERT INTO mfa_emergency_recovery (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET token = $2, expires_at = $3, created_at = NOW()
    `, [user.id, recoveryToken, expiresAt])

    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const recoveryLink = `${appUrl}/api/auth/mfa/emergency-recover?token=${recoveryToken}`

    // Send emergency recovery email
    try {
      const { sendEmail } = await import('../../services/EmailService.js')
      await sendEmail({
        to: email,
        subject: '🚨 EMERGENCY: MFA Recovery - FreshTrack',
        html: `
          <h2>Emergency MFA Recovery</h2>
          <p><strong>You are the only active SUPER_ADMIN.</strong></p>
          <p>Use this secure link to reset your MFA (valid for 24 hours):</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${recoveryLink}"
               style="display: inline-block; padding: 16px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Reset MFA
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            If you did not request this, please contact support immediately.
          </p>
          <p style="color: #dc2626; font-size: 14px; margin-top: 24px;">
            ⚠️ This link will be logged in audit trail for security.
          </p>
        `
      })

      // Log emergency recovery request
      await logAudit({
        hotel_id: null,
        user_id: user.id,
        user_name: user.name || login,
        action: 'mfa_emergency_recovery_requested',
        entity_type: 'user',
        entity_id: user.id,
        details: {
          requestId,
          isOnlySuperAdmin: true,
          email,
          timestamp: new Date().toISOString()
        },
        ip_address: req.ip
      })

      return res.json({
        success: true,
        message: 'Emergency recovery email sent. Check your email for recovery link.',
        requestId,
        emergencyRecovery: true,
        note: 'You are the only active SUPER_ADMIN. Recovery link sent to your email.'
      })
    } catch (emailError) {
      logError('MFA Recovery', 'Failed to send emergency recovery email', emailError)
      return res.status(500).json({
        success: false,
        error: 'Failed to send recovery email. Please contact support.'
      })
    }
  }

  // Normal recovery: notify other SUPER_ADMINs
  const adminsResult = await dbQuery(`
    SELECT email, name FROM users
    WHERE role = 'SUPER_ADMIN'
      AND is_active = TRUE
      AND email IS NOT NULL
  `)

  // Send notification emails to admins
  for (const admin of adminsResult.rows) {
    try {
      const { sendEmail } = await import('../../services/EmailService.js')
      await sendEmail({
        to: admin.email,
        subject: 'MFA Recovery Request - FreshTrack',
        html: `
          <h2>MFA Recovery Request</h2>
          <p>A user has requested MFA recovery assistance:</p>
          <ul>
            <li><strong>User:</strong> ${user.name} (${login})</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Reason:</strong> ${reason || 'Not specified'}</li>
            <li><strong>Request ID:</strong> ${requestId}</li>
          </ul>
          <p>Please review and assist the user with MFA recovery.</p>
        `
      })
    } catch (emailError) {
      logError('MFA Recovery', `Failed to notify admin ${admin.email}`, emailError)
    }
  }

  res.json({
    success: true,
    message: 'Recovery request submitted. Administrator will contact you.',
    requestId
  })
}))

/**
 * GET /api/auth/mfa/emergency-recover
 * Emergency MFA recovery via email link (only for ONLY SUPER_ADMIN)
 */
router.get('/mfa/emergency-recover', asyncHandler(async (req, res) => {
  const { token } = req.query

  if (!token) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Invalid Recovery Link</h2>
          <p>Missing recovery token.</p>
        </body>
      </html>
    `)
  }

  // Verify token
  const tokenResult = await dbQuery(`
    SELECT er.user_id, er.expires_at, u.email, u.name, u.login
    FROM mfa_emergency_recovery er
    JOIN users u ON u.id = er.user_id
    WHERE er.token = $1 AND er.expires_at > NOW()
  `, [token])

  if (tokenResult.rows.length === 0) {
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Invalid or Expired Recovery Link</h2>
          <p>The recovery link is invalid or has expired.</p>
          <p>Please request a new recovery link.</p>
        </body>
      </html>
    `)
  }

  const { user_id, email, name, login } = tokenResult.rows[0]

  // Reset MFA
  await dbQuery(`
    UPDATE users
    SET mfa_enabled = FALSE,
        mfa_secret = NULL,
        mfa_backup_codes = NULL
    WHERE id = $1
  `, [user_id])

  // Delete used token
  await dbQuery(`
    DELETE FROM mfa_emergency_recovery WHERE token = $1
  `, [token])

  // Audit log
  await logAudit({
    hotel_id: null,
    user_id: user_id,
    user_name: name || login,
    action: 'mfa_emergency_recovery_completed',
    entity_type: 'user',
    entity_id: user_id,
    details: {
      method: 'email_link',
      timestamp: new Date().toISOString()
    },
    ip_address: req.ip
  })

  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #059669;">✓ MFA Reset Successful</h2>
        <p>Your multi-factor authentication has been reset.</p>
        <p>You can now log in without MFA and set up MFA again in account settings.</p>
        <p style="margin-top: 30px;">
          <a href="/login" style="color: #FF8D6B; text-decoration: underline;">Go to Login</a>
        </p>
      </body>
    </html>
  `)
}))

/**
 * POST /api/auth/mfa/admin-reset/:userId
 * SUPER_ADMIN can reset MFA for another user
 */
router.post('/mfa/admin-reset/:userId',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  asyncHandler(async (req, res) => {
    const { userId } = req.params
    const { reason } = req.body

    // Get target user
    const userResult = await dbQuery(
      'SELECT id, login, email, name FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const targetUser = userResult.rows[0]

    // Reset MFA
    await dbQuery(`
      UPDATE users
      SET mfa_enabled = FALSE,
          mfa_secret = NULL,
          mfa_backup_codes = NULL
      WHERE id = $1
    `, [userId])

    // Audit log
    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'mfa_admin_reset',
      entity_type: 'user',
      entity_id: userId,
      details: {
        targetUserId: userId,
        targetLogin: targetUser.login,
        reason: reason || 'Admin-assisted recovery',
        resetBy: req.user.id
      },
      ip_address: req.ip
    })

    // MFA audit log
    await MFAService.logMFAEvent(userId, 'admin_reset', req.ip, req.get('user-agent'), true)

    // Send notification to user
    if (targetUser.email) {
      try {
        const { sendEmail } = await import('../../services/EmailService.js')
        await sendEmail({
          to: targetUser.email,
          subject: 'MFA Reset - FreshTrack',
          html: `
            <h2>MFA Reset Notification</h2>
            <p>Your multi-factor authentication has been reset by an administrator.</p>
            <p><strong>Reset by:</strong> ${req.user.name || req.user.login}</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p>Please set up MFA again in your account settings.</p>
          `
        })
      } catch (emailError) {
        logWarn('MFA Recovery', `Failed to notify user ${targetUser.email}`, emailError)
      }
    }

    res.json({
      success: true,
      message: 'MFA reset successfully. User has been notified.'
    })
  })
)

/**
 * GET /api/auth/mfa/recovery-requests
 * Get pending MFA recovery requests (SUPER_ADMIN only)
 */
router.get('/mfa/recovery-requests',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  asyncHandler(async (req, res) => {
    const { status = 'PENDING' } = req.query

    const result = await dbQuery(`
      SELECT
        r.id, r.email, r.login, r.reason, r.status,
        r.created_at, r.resolved_at,
        u.id as user_id, u.name as user_name,
        resolved_by.name as resolved_by_name
      FROM mfa_recovery_requests r
      LEFT JOIN users u ON u.email = r.email AND u.login = r.login
      LEFT JOIN users resolved_by ON resolved_by.id = r.resolved_by
      WHERE r.status = $1
      ORDER BY r.created_at DESC
    `, [status])

    res.json({
      success: true,
      requests: result.rows
    })
  })
)

export default router
