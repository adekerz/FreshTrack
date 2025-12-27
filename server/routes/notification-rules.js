/**
 * FreshTrack Notification Rules API
 * Manage notification rules, Telegram chats, and job control
 */

import express from 'express'
import { query } from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'
import { NotificationEngine } from '../services/NotificationEngine.js'
import { TelegramService } from '../services/TelegramService.js'
import { 
  runExpiryCheckNow, 
  runQueueProcessNow, 
  getJobStatus 
} from '../jobs/notificationJobs.js'

const router = express.Router()

// Apply auth middleware
router.use(authMiddleware)
router.use(hotelIsolation)

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION RULES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notification-rules - Get notification rules (root path)
 */
router.get('/', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const rules = await NotificationEngine.getRules(req.hotelId)
    res.json({ success: true, rules })
  } catch (error) {
    console.error('Get notification rules error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

/**
 * GET /api/notification-rules/rules - Get notification rules (legacy path)
 */
router.get('/rules', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const rules = await NotificationEngine.getRules(req.hotelId)
    res.json({ success: true, rules })
  } catch (error) {
    console.error('Get notification rules error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

/**
 * POST /api/notification-rules - Create/update notification rule
 */
router.post('/rules', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { 
      id, type, name, description, 
      warningDays, criticalDays, 
      channels, recipientRoles, 
      departmentId, enabled 
    } = req.body
    
    const ruleId = await NotificationEngine.upsertRule({
      id,
      hotelId: req.hotelId,
      departmentId,
      type,
      name,
      description,
      warningDays,
      criticalDays,
      channels,
      recipientRoles,
      enabled
    })
    
    res.json({ success: true, id: ruleId })
  } catch (error) {
    console.error('Create notification rule error:', error)
    res.status(500).json({ success: false, error: 'Failed to create notification rule' })
  }
})

/**
 * PATCH /api/notification-rules/:id/toggle - Toggle notification rule enabled/disabled
 */
router.patch('/:id/toggle', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { id } = req.params
    
    // Get current rule
    const current = await query(
      'SELECT id, enabled FROM notification_rules WHERE id = $1 AND hotel_id = $2',
      [id, req.hotelId]
    )
    
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }
    
    const newEnabled = !current.rows[0].enabled
    
    await query(
      'UPDATE notification_rules SET enabled = $1 WHERE id = $2 AND hotel_id = $3',
      [newEnabled, id, req.hotelId]
    )
    
    res.json({ success: true, isActive: newEnabled })
  } catch (error) {
    console.error('Toggle notification rule error:', error)
    res.status(500).json({ success: false, error: 'Failed to toggle notification rule' })
  }
})

/**
 * DELETE /api/notification-rules/:id - Delete notification rule (alternative path)
 */
router.delete('/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    await query(
      'DELETE FROM notification_rules WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )
    res.json({ success: true })
  } catch (error) {
    console.error('Delete notification rule error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification rule' })
  }
})

/**
 * DELETE /api/notification-rules/rules/:id - Delete notification rule
 */
router.delete('/rules/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    await query(
      'DELETE FROM notification_rules WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )
    res.json({ success: true })
  } catch (error) {
    console.error('Delete notification rule error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification rule' })
  }
})

// ═══════════════════════════════════════════════════════════════
// TELEGRAM CHATS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notification-rules/telegram-chats - Get linked Telegram chats
 */
router.get('/telegram-chats', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const result = await query(`
      SELECT tc.*, d.name as department_name
      FROM telegram_chats tc
      LEFT JOIN departments d ON tc.department_id = d.id
      WHERE tc.hotel_id = $1 OR tc.hotel_id IS NULL
      ORDER BY tc.added_at DESC
    `, [req.hotelId])
    
    res.json({ success: true, chats: result.rows })
  } catch (error) {
    console.error('Get telegram chats error:', error)
    res.status(500).json({ success: false, error: 'Failed to get telegram chats' })
  }
})

/**
 * PUT /api/notification-rules/telegram-chats/:id - Update Telegram chat settings
 */
router.put('/telegram-chats/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { departmentId, notificationTypes, silentMode } = req.body
    
    await query(`
      UPDATE telegram_chats 
      SET department_id = $1, 
          notification_types = $2,
          silent_mode = $3
      WHERE id = $4 AND hotel_id = $5
    `, [
      departmentId || null,
      JSON.stringify(notificationTypes || ['expiry']),
      silentMode || false,
      req.params.id,
      req.hotelId
    ])
    
    res.json({ success: true })
  } catch (error) {
    console.error('Update telegram chat error:', error)
    res.status(500).json({ success: false, error: 'Failed to update telegram chat' })
  }
})

/**
 * DELETE /api/notification-rules/telegram-chats/:id - Remove Telegram chat link
 */
router.delete('/telegram-chats/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    await query(
      'DELETE FROM telegram_chats WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )
    res.json({ success: true })
  } catch (error) {
    console.error('Delete telegram chat error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete telegram chat' })
  }
})

// ═══════════════════════════════════════════════════════════════
// JOB CONTROL (Admin only)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notification-rules/jobs/status - Get job status
 */
router.get('/jobs/status', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const status = getJobStatus()
    res.json({ success: true, ...status })
  } catch (error) {
    console.error('Get job status error:', error)
    res.status(500).json({ success: false, error: 'Failed to get job status' })
  }
})

/**
 * POST /api/notification-rules/jobs/run-expiry-check - Trigger expiry check manually
 */
router.post('/jobs/run-expiry-check', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const count = await runExpiryCheckNow()
    res.json({ success: true, notificationsCreated: count })
  } catch (error) {
    console.error('Run expiry check error:', error)
    res.status(500).json({ success: false, error: 'Failed to run expiry check' })
  }
})

/**
 * POST /api/notification-rules/jobs/run-queue - Trigger queue processing manually
 */
router.post('/jobs/run-queue', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const result = await runQueueProcessNow()
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Run queue process error:', error)
    res.status(500).json({ success: false, error: 'Failed to run queue process' })
  }
})

// ═══════════════════════════════════════════════════════════════
// TELEGRAM WEBHOOK (for production)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/notification-rules/telegram-webhook - Receive Telegram updates
 * This is called by Telegram when webhook is configured
 */
router.post('/telegram-webhook', async (req, res) => {
  try {
    const update = req.body
    
    if (update) {
      await TelegramService.processUpdate(update)
    }
    
    // Always return 200 to Telegram
    res.sendStatus(200)
  } catch (error) {
    console.error('Telegram webhook error:', error)
    res.sendStatus(200) // Still return 200 to prevent retry spam
  }
})

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION STATS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notification-rules/stats - Get notification statistics
 */
router.get('/stats', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const stats = await NotificationEngine.getStats(req.hotelId, startDate, endDate)
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Get notification stats error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification stats' })
  }
})

/**
 * POST /api/notification-rules/test-telegram - Send test Telegram message
 */
router.post('/test-telegram', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { chatId, message } = req.body
    
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'chatId is required' })
    }
    
    const result = await TelegramService.sendMessage(
      chatId, 
      message || '✅ *Тест FreshTrack*\n\nЕсли вы видите это сообщение, Telegram интеграция работает!'
    )
    
    res.json({ success: true, messageId: result.message_id })
  } catch (error) {
    console.error('Test telegram error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
