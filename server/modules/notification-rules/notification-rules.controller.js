/**
 * Notification Rules Controller
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import { query, logAudit } from '../../db/database.js'
import {
  authMiddleware,
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { NotificationEngine } from '../../services/NotificationEngine.js'
import { TelegramService } from '../../services/TelegramService.js'
import { clearThresholdsCache } from '../../services/ExpiryService.js'
import {
  runExpiryCheckNow,
  runQueueProcessNow,
  getJobStatus
} from '../../jobs/notificationJobs.js'

const router = Router()

// ═══════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (no auth required)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/notification-rules/telegram-webhook
 * Telegram webhook - receives updates from Telegram
 * MUST be public (no auth) for Telegram to call it
 */
router.post('/telegram-webhook', async (req, res) => {
  try {
    // Skip if Telegram is not configured
    if (!TelegramService.isConfigured()) {
      return res.sendStatus(200)
    }

    const update = req.body

    if (update) {
      await TelegramService.processUpdate(update)
    }

    res.sendStatus(200)
  } catch (error) {
    logError('Telegram webhook error', error)
    res.sendStatus(200)
  }
})

// ═══════════════════════════════════════════════════════════════
// PROTECTED ENDPOINTS (auth required)
// ═══════════════════════════════════════════════════════════════

router.use(authMiddleware)
router.use(hotelIsolation)

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION RULES
// ═══════════════════════════════════════════════════════════════

router.get('/', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const rules = await NotificationEngine.getRules(req.hotelId)
    res.json({ success: true, rules })
  } catch (error) {
    logError('Get notification rules error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

router.get('/rules', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const rules = await NotificationEngine.getRules(req.hotelId)
    res.json({ success: true, rules })
  } catch (error) {
    logError('Get notification rules error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

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

    // Очищаем кеш порогов чтобы новые пороги применились
    clearThresholdsCache(req.hotelId)

    // Audit logging
    await logAudit({
      userId: req.user.id,
      action: id ? 'UPDATE' : 'CREATE',
      resource: 'NotificationRule',
      resourceId: ruleId,
      details: { type, name, warningDays, criticalDays, channels, enabled }
    })

    res.json({ success: true, id: ruleId })
  } catch (error) {
    logError('Create notification rule error', error)
    res.status(500).json({ success: false, error: 'Failed to create notification rule' })
  }
})

router.patch('/:id/toggle', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { id } = req.params

    // Сначала проверяем существует ли правило
    const originalRule = await query(
      'SELECT id, enabled, hotel_id, type FROM notification_rules WHERE id = $1',
      [id]
    )

    if (originalRule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }

    const rule = originalRule.rows[0]

    // Если это системное правило (hotel_id IS NULL), работаем через копию для отеля
    if (rule.hotel_id === null) {
      // Проверяем есть ли уже копия для этого отеля
      const hotelCopy = await query(
        'SELECT id, enabled FROM notification_rules WHERE hotel_id = $1 AND type = $2',
        [req.hotelId, rule.type]
      )

      if (hotelCopy.rows.length > 0) {
        // Есть копия - переключаем ЕЁ состояние
        const copyRule = hotelCopy.rows[0]
        const newEnabled = !copyRule.enabled

        await query(
          'UPDATE notification_rules SET enabled = $1 WHERE id = $2',
          [newEnabled, copyRule.id]
        )

        // Audit logging
        await logAudit({
          userId: req.user.id,
          action: 'TOGGLE',
          resource: 'NotificationRule',
          resourceId: copyRule.id,
          details: { enabled: newEnabled, type: rule.type }
        })

        return res.json({ success: true, isActive: newEnabled })
      } else {
        // Нет копии - создаём с противоположным состоянием от системного
        const newEnabled = !rule.enabled

        const insertResult = await query(`
          INSERT INTO notification_rules (hotel_id, type, name, description, warning_days, critical_days, channels, recipient_roles, enabled)
          SELECT $1, type, name, description, warning_days, critical_days, channels, recipient_roles, $2
          FROM notification_rules WHERE id = $3
          RETURNING id
        `, [req.hotelId, newEnabled, id])

        // Audit logging
        await logAudit({
          userId: req.user.id,
          action: 'CREATE',
          resource: 'NotificationRule',
          resourceId: insertResult.rows[0]?.id,
          details: { enabled: newEnabled, type: rule.type, copiedFrom: id }
        })

        return res.json({ success: true, isActive: newEnabled })
      }
    } else {
      // Проверяем что правило принадлежит этому отелю
      if (rule.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      // Обновляем правило отеля
      const newEnabled = !rule.enabled
      await query(
        'UPDATE notification_rules SET enabled = $1 WHERE id = $2 AND hotel_id = $3',
        [newEnabled, id, req.hotelId]
      )

      // Audit logging
      await logAudit({
        userId: req.user.id,
        action: 'TOGGLE',
        resource: 'NotificationRule',
        resourceId: id,
        details: { enabled: newEnabled, type: rule.type }
      })

      return res.json({ success: true, isActive: newEnabled })
    }
  } catch (error) {
    logError('Toggle notification rule error', error)
    res.status(500).json({ success: false, error: 'Failed to toggle notification rule' })
  }
})

router.delete('/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    // Проверяем что это не системное правило
    const rule = await query(
      'SELECT id, hotel_id FROM notification_rules WHERE id = $1',
      [req.params.id]
    )

    if (rule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }

    if (rule.rows[0].hotel_id === null) {
      return res.status(403).json({ success: false, error: 'Cannot delete system rule' })
    }

    // Удаляем только правила отеля
    await query(
      'DELETE FROM notification_rules WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )

    // Audit logging
    await logAudit({
      userId: req.user.id,
      action: 'DELETE',
      resource: 'NotificationRule',
      resourceId: req.params.id,
      details: {}
    })

    res.json({ success: true })
  } catch (error) {
    logError('Delete notification rule error', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification rule' })
  }
})

router.delete('/rules/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    // Проверяем что это не системное правило
    const rule = await query(
      'SELECT id, hotel_id FROM notification_rules WHERE id = $1',
      [req.params.id]
    )

    if (rule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }

    if (rule.rows[0].hotel_id === null) {
      return res.status(403).json({ success: false, error: 'Cannot delete system rule' })
    }

    await query(
      'DELETE FROM notification_rules WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )
    res.json({ success: true })
  } catch (error) {
    logError('Delete notification rule error', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification rule' })
  }
})

// ═══════════════════════════════════════════════════════════════
// TELEGRAM CHATS
// ═══════════════════════════════════════════════════════════════

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
    logError('Get telegram chats error', error)
    res.status(500).json({ success: false, error: 'Failed to get telegram chats' })
  }
})

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
    logError('Update telegram chat error', error)
    res.status(500).json({ success: false, error: 'Failed to update telegram chat' })
  }
})

router.delete('/telegram-chats/:id', requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    await query(
      'DELETE FROM telegram_chats WHERE id = $1 AND hotel_id = $2',
      [req.params.id, req.hotelId]
    )
    res.json({ success: true })
  } catch (error) {
    logError('Delete telegram chat error', error)
    res.status(500).json({ success: false, error: 'Failed to delete telegram chat' })
  }
})

// ═══════════════════════════════════════════════════════════════
// JOB CONTROL
// ═══════════════════════════════════════════════════════════════

router.get('/jobs/status', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const status = getJobStatus()
    res.json({ success: true, ...status })
  } catch (error) {
    logError('Get job status error', error)
    res.status(500).json({ success: false, error: 'Failed to get job status' })
  }
})

router.post('/jobs/run-expiry-check', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const count = await runExpiryCheckNow()
    res.json({ success: true, notificationsCreated: count })
  } catch (error) {
    logError('Run expiry check error', error)
    res.status(500).json({ success: false, error: 'Failed to run expiry check' })
  }
})

router.post('/jobs/run-queue', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const result = await runQueueProcessNow()
    res.json({ success: true, ...result })
  } catch (error) {
    logError('Run queue process error', error)
    res.status(500).json({ success: false, error: 'Failed to run queue process' })
  }
})

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION STATS
// ═══════════════════════════════════════════════════════════════

router.get('/stats', requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const stats = await NotificationEngine.getStats(req.hotelId, startDate, endDate)
    res.json({ success: true, stats })
  } catch (error) {
    logError('Get notification stats error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification stats' })
  }
})

router.post('/test-telegram', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    // Check if Telegram is configured
    if (!TelegramService.isConfigured()) {
      return res.status(400).json({
        success: false,
        configured: false,
        error: 'Telegram not configured. Set TELEGRAM_BOT_TOKEN environment variable on the server.'
      })
    }

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
    logError('Test telegram error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
