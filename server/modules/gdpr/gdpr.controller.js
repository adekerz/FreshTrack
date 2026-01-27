/**
 * GDPR Compliance Controller
 * Implements GDPR Article 15 (Right to Access) and Article 17 (Right to Erasure)
 */

import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { logError, logInfo } from '../../utils/logger.js'
import { query as dbQuery } from '../../db/postgres.js'
import { AuthService } from '../auth/auth.service.js'
import { logAudit } from '../../db/database.js'

const router = Router()

/**
 * GET /api/gdpr/my-data
 * GDPR Article 15: Right to Access
 * User can request all their personal data
 */
router.get('/my-data', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    
    // Собираем все данные пользователя
    const userData = await dbQuery(`
      SELECT id, login, email, name, role, status, created_at, updated_at, 
             hotel_id, department_id, telegram_chat_id, is_active
      FROM users
      WHERE id = $1
    `, [userId])
    
    if (userData.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const auditLogs = await dbQuery(`
      SELECT entity_type, action, created_at, details, ip_address
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1000
    `, [userId])
    
    const joinRequests = await dbQuery(`
      SELECT hotel_id, status, requested_at, processed_at, notes
      FROM join_requests
      WHERE user_id = $1
    `, [userId])
    
    // Log GDPR data access request
    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: userId,
      user_name: req.user.name || req.user.login,
      action: 'gdpr_data_access',
      entity_type: 'user',
      entity_id: userId,
      details: { requestType: 'GDPR_ARTICLE_15' },
      ip_address: req.ip
    })
    
    res.json({
      success: true,
      data: {
        user: userData.rows[0],
        activityLog: auditLogs.rows,
        joinRequests: joinRequests.rows
      },
      generatedAt: new Date().toISOString(),
      format: 'JSON',
      message: 'You can download this data for your records'
    })
  } catch (error) {
    logError('GDPR', 'Failed to get user data', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/gdpr/delete-my-account
 * GDPR Article 17: Right to Erasure
 * User can request account deletion (anonymizes data, keeps audit logs)
 * MFA required for SUPER_ADMIN
 */
router.post('/delete-my-account', 
  authMiddleware, 
  requireMFA, // MFA required for SUPER_ADMIN
  async (req, res) => {
  try {
    const userId = req.user.id
    const { confirmPassword } = req.body
    
    if (!confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password confirmation required' 
      })
    }
    
    // Проверка пароля для подтверждения
    const user = await AuthService.getCurrentUser(userId)
    if (!user.success || !user.data.user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    // Verify password
    const { verifyPassword } = await import('../../db/database.js')
    const userRecord = await dbQuery('SELECT password FROM users WHERE id = $1', [userId])
    
    if (userRecord.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const isValidPassword = verifyPassword(confirmPassword, userRecord.rows[0].password)
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid password' })
    }
    
    // GDPR: не удаляем audit logs (legal requirement)
    // Но anonymize user data
    await dbQuery(`
      UPDATE users
      SET 
        email = 'deleted-' || id || '@deleted.local',
        name = 'Deleted User',
        login = 'deleted-' || id,
        password = NULL,
        status = 'DELETED',
        mfa_secret = NULL,
        mfa_backup_codes = NULL,
        is_active = FALSE,
        deleted_at = NOW()
      WHERE id = $1
    `, [userId])
    
    // Anonymize в audit logs (только PII, не actions)
    await dbQuery(`
      UPDATE audit_logs
      SET user_name = 'Deleted User'
      WHERE user_id = $1
    `, [userId])
    
    // Anonymize в join_requests
    await dbQuery(`
      UPDATE join_requests
      SET notes = COALESCE(notes, '') || ' [User deleted account]'
      WHERE user_id = $1
    `, [userId])
    
    // Log GDPR deletion request
    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: userId,
      user_name: req.user.name || req.user.login,
      action: 'gdpr_account_deletion',
      entity_type: 'user',
      entity_id: userId,
      details: { requestType: 'GDPR_ARTICLE_17' },
      ip_address: req.ip
    })
    
    logInfo('GDPR', `Account deleted (anonymized) for user ${userId}`)
    
    res.json({
      success: true,
      message: 'Your account has been deleted. Audit logs are retained for legal compliance.'
    })
  } catch (error) {
    logError('GDPR', 'Failed to delete account', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
