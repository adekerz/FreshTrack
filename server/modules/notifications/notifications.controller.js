/**
 * Notifications Controller
 * 
 * HTTP обработчики для notifications endpoints.
 * Использует Zod схемы для валидации.
 */

import { Router } from 'express'
import crypto from 'crypto'
import {
  NotificationFiltersSchema,
  MarkNotificationsSchema,
  SendTestNotificationSchema,
  validate
} from './notifications.schemas.js'
import { authMiddleware, hotelIsolation, departmentIsolation, requirePermission, PermissionResource, PermissionAction } from '../../middleware/auth.js'
import {
  getAllNotifications,
  getNotificationById,
  createNotification,
  deleteNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  logAudit
} from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError, logInfo } from '../../utils/logger.js'

const router = Router()

// ========================================
// Уведомления
// ========================================

/**
 * GET /api/notifications
 * Получить список уведомлений с фильтрацией
 */
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const validation = validate(NotificationFiltersSchema, req.query)

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const filters = validation.data
    const deptId = req.canAccessAllDepartments ? null : req.departmentId

    const dbFilters = {
      user_id: req.user.id,
      department_id: deptId,
      type: filters.type,
      is_read: filters.unreadOnly ? false : undefined,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit
    }

    const notifications = await getAllNotifications(req.hotelId, dbFilters)
    const unreadCount = await getUnreadNotificationsCount(req.hotelId, req.user.id, deptId)

    res.json({
      success: true,
      notifications,
      unread_count: unreadCount,
      page: filters.page,
      limit: filters.limit
    })
  } catch (error) {
    logError('Get notifications error', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications' })
  }
})

/**
 * GET /api/notifications/unread-count
 * Получить количество непрочитанных
 */
router.get('/unread-count', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const count = await getUnreadNotificationsCount(req.hotelId, req.user.id, deptId)
    res.json({ success: true, count })
  } catch (error) {
    logError('Get unread count error', error)
    res.status(500).json({ success: false, error: 'Failed to get unread count' })
  }
})

/**
 * GET /api/notifications/logs
 * История уведомлений
 */
router.get('/logs', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const deptId = req.canAccessAllDepartments ? null : req.departmentId

    const filters = {
      department_id: deptId,
      type,
      limit: parseInt(limit),
      offset
    }

    const notifications = await getAllNotifications(req.hotelId, filters)

    const logs = notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      status: n.is_read ? 'read' : 'unread',
      priority: n.priority || 'normal',
      created_at: n.created_at,
      read_at: n.read_at
    }))

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: logs.length
      }
    })
  } catch (error) {
    logError('Get notification logs error', error)
    res.status(500).json({ success: false, error: 'Failed to fetch logs' })
  }
})

/**
 * GET /api/notifications/:id
 * Получить уведомление по ID
 */
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }

    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!req.canAccessAllDepartments && notification.department_id && notification.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }

    res.json({ success: true, notification })
  } catch (error) {
    logError('Get notification error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification' })
  }
})

/**
 * POST /api/notifications
 * Создать уведомление
 */
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { type, title, message, priority, user_id, entity_type, entity_id, data, department_id } = req.body

    if (!type || !title) {
      return res.status(400).json({ success: false, error: 'Notification type and title are required' })
    }

    const notificationDeptId = department_id || req.departmentId

    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create notification for another department' })
    }

    const notification = await createNotification({
      hotel_id: req.hotelId,
      department_id: notificationDeptId,
      type, title, message, priority: priority || 'normal',
      user_id: user_id || req.user.id,
      entity_type, entity_id, data
    })

    await logAudit({
      userId: req.user.id,
      hotelId: req.hotelId,
      action: 'CREATE',
      resource: 'Notification',
      resourceId: notification.id,
      details: { type, title }
    })

    res.status(201).json({ success: true, notification })
  } catch (error) {
    logError('Create notification error', error)
    res.status(500).json({ success: false, error: 'Failed to create notification' })
  }
})

/**
 * PUT /api/notifications/:id/read
 * Отметить как прочитанное
 */
router.put('/:id/read', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }

    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!req.canAccessAllDepartments && notification.department_id && notification.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }

    const success = await markNotificationAsRead(req.params.id)
    res.json({ success })
  } catch (error) {
    logError('Mark notification read error', error)
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' })
  }
})

/**
 * PUT /api/notifications/read-all
 * Отметить все как прочитанные
 */
router.put('/read-all', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const count = await markAllNotificationsAsRead(req.hotelId, deptId)
    res.json({ success: true, count })
  } catch (error) {
    logError('Mark all notifications read error', error)
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' })
  }
})

/**
 * POST /api/notifications/mark-batch
 * Пакетная пометка уведомлений
 */
router.post('/mark-batch', authMiddleware, hotelIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const validation = validate(MarkNotificationsSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const { notificationIds, status } = validation.data

    let sql = ''
    if (status === 'read') {
      sql = `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = ANY($1) AND hotel_id = $2`
    } else if (status === 'archived') {
      sql = `UPDATE notifications SET status = 'archived' WHERE id = ANY($1) AND hotel_id = $2`
    } else if (status === 'dismissed') {
      sql = `UPDATE notifications SET status = 'dismissed' WHERE id = ANY($1) AND hotel_id = $2`
    }

    const result = await dbQuery(sql, [notificationIds, req.hotelId])

    res.json({ success: true, updated: result.rowCount })
  } catch (error) {
    logError('Mark batch error', error)
    res.status(500).json({ success: false, error: 'Failed to mark notifications' })
  }
})

/**
 * DELETE /api/notifications/:id
 * Удалить уведомление
 */
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.DELETE), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }

    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    if (!req.canAccessAllDepartments && notification.department_id && notification.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }

    const success = await deleteNotification(req.params.id)

    await logAudit({
      userId: req.user.id,
      hotelId: req.hotelId,
      action: 'DELETE',
      resource: 'Notification',
      resourceId: req.params.id,
      details: {}
    })

    res.json({ success })
  } catch (error) {
    logError('Delete notification error', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification' })
  }
})

// ========================================
// Тестирование и Telegram
// ========================================

/**
 * POST /api/notifications/test
 * Тестовое уведомление
 */
router.post('/test', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const validation = validate(SendTestNotificationSchema, req.body)

    // Можно не валидировать строго, использовать дефолты
    const { type = 'system', channel = 'in_app', title, message } = req.body

    const notification = await createNotification({
      hotel_id: req.hotelId,
      department_id: req.departmentId,
      type: 'system',
      title: title || 'Тестовое уведомление',
      message: message || `Это тестовое уведомление. Канал: ${channel}`,
      priority: 'normal',
      user_id: req.user.id,
      data: { test: true, channel }
    })

    res.json({
      success: true,
      notification,
      message: 'Test notification sent successfully'
    })
  } catch (error) {
    logError('Test notification error', error)
    res.status(500).json({ success: false, error: 'Failed to send test notification' })
  }
})

/**
 * POST /api/notifications/test-telegram
 * Тест Telegram
 */
router.post('/test-telegram', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    console.log('📤 Test Telegram request received')
    console.log('   User:', req.user?.name, 'Hotel ID:', req.hotelId)

    const { TelegramService } = await import('../../services/TelegramService.js')
    
    // Проверяем, настроен ли Telegram бот
    if (!TelegramService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Telegram бот не настроен. Установите переменную окружения TELEGRAM_BOT_TOKEN.'
      })
    }

    const { chatId } = req.body

    let targetChats = []

    if (chatId) {
      targetChats = [{ chat_id: chatId }]
    } else {
      let chatsQuery = `SELECT chat_id, chat_title FROM telegram_chats 
                        WHERE is_active = true AND bot_removed = false`
      const params = []

      if (req.hotelId) {
        chatsQuery += ` AND hotel_id = $1`
        params.push(req.hotelId)
      }

      const chatsResult = await dbQuery(chatsQuery, params)
      targetChats = chatsResult.rows
    }

    if (targetChats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Нет привязанных Telegram чатов. Добавьте бота @freshtracksystemsbot в чат и используйте /link MARSHA_CODE'
      })
    }

    const testMessage = `✅ *Тест FreshTrack*

Если вы видите это сообщение, Telegram интеграция работает!

📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`

    const results = []
    let hasUnauthorizedError = false
    
    // Отправляем Telegram уведомления
    for (const chat of targetChats) {
      try {
        const result = await TelegramService.sendMessage(chat.chat_id, testMessage)
        if (result && !result.skipped) {
          results.push({ chatId: chat.chat_id, success: true, messageId: result?.message_id })
        } else {
          results.push({ chatId: chat.chat_id, success: false, error: 'Telegram не настроен' })
        }
      } catch (error) {
        const errorMessage = error.message || String(error)
        
        // Определяем тип ошибки
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
          hasUnauthorizedError = true
          results.push({ 
            chatId: chat.chat_id, 
            success: false, 
            error: 'Неверный токен Telegram бота. Проверьте переменную окружения TELEGRAM_BOT_TOKEN.' 
          })
        } else {
          results.push({ chatId: chat.chat_id, success: false, error: errorMessage })
        }
      }
    }

    const successCount = results.filter(r => r.success).length

    // Также отправляем email уведомление текущему пользователю
    let emailSent = false
    let emailError = null
    
    if (req.user && req.user.email) {
      try {
        const { sendEmail, EMAIL_FROM } = await import('../../services/EmailService.js')
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .header {
      border-left: 4px solid #FF8D6B;
      padding-left: 16px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
    .content {
      margin: 24px 0;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">✅ Тест FreshTrack</h1>
    </div>
    
    <div class="content">
      <div class="message">
        Если вы видите это письмо, email уведомления работают правильно!<br><br>
        📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
      </div>
    </div>
    
    <div class="footer">
      <p>Это автоматическое тестовое уведомление от FreshTrack.</p>
    </div>
  </div>
</body>
</html>
        `
        
        // Resend dev sender (onboarding@resend.dev) разрешает только адрес владельца аккаунта
        const emailRecipient =
          process.env.NODE_ENV === 'development' &&
          process.env.RESEND_USE_DEV_SENDER === 'true' &&
          process.env.RESEND_DEV_RECIPIENT
            ? process.env.RESEND_DEV_RECIPIENT
            : req.user.email

        await sendEmail({
          to: emailRecipient,
          from: EMAIL_FROM.system,
          subject: '✅ Тест FreshTrack — Email уведомления работают',
          html: emailHtml,
          text: 'Если вы видите это письмо, email уведомления работают правильно!'
        })
        
        emailSent = true
        logInfo('Test notification', `📧 Test email sent to ${emailRecipient}`)
      } catch (error) {
        emailError = error.message || String(error)
        logError('Test notification', `Failed to send test email: ${emailError}`)
      }
    }

    // Если все попытки завершились ошибкой Unauthorized, возвращаем специальное сообщение
    // Используем 400 вместо 401, чтобы не путать с ошибкой авторизации пользователя
    if (hasUnauthorizedError && successCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка авторизации Telegram бота. Проверьте правильность токена TELEGRAM_BOT_TOKEN в настройках сервера.',
        sentTo: 0,
        totalChats: targetChats.length,
        emailSent,
        emailError,
        results
      })
    }

    res.json({
      success: successCount > 0 || emailSent,
      sentTo: successCount,
      totalChats: targetChats.length,
      emailSent,
      emailError: emailError || null,
      results
    })
  } catch (error) {
    logError('Test telegram error', error)
    
    // Определяем тип ошибки для более понятного сообщения
    const errorMessage = error.message || String(error)
    let userMessage = 'Ошибка отправки тестового сообщения'
    let statusCode = 500
    
    if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
      userMessage = 'Ошибка авторизации Telegram бота. Проверьте правильность токена TELEGRAM_BOT_TOKEN.'
      statusCode = 400 // Используем 400 вместо 401, чтобы не путать с ошибкой авторизации пользователя
    } else if (errorMessage.includes('not configured')) {
      userMessage = 'Telegram бот не настроен. Установите переменную окружения TELEGRAM_BOT_TOKEN.'
      statusCode = 400
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    })
  }
})

/**
 * POST /api/notifications/send-daily-report
 * Отправить ежедневный агрегированный отчёт
 * 
 * Notifications are sent only once per day as an aggregated report
 * No per-item or real-time alerts by design (anti-spam UX)
 */
router.post('/send-daily-report', authMiddleware, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.WRITE), async (req, res) => {
  try {
    const { NotificationEngine } = await import('../../services/NotificationEngine.js')
    const result = await NotificationEngine.sendDailyReport()

    res.json({
      success: true,
      message: 'Daily report sent',
      results: result
    })
  } catch (error) {
    logError('Daily report error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/notifications/send-daily
 * Отправить ежедневный отчёт
 */
router.post('/send-daily', authMiddleware, hotelIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { TelegramService } = await import('../../services/TelegramService.js')

    // Получаем статистику для отеля
    const statsResult = await dbQuery(`
      SELECT 
        COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date > CURRENT_DATE + INTERVAL '7 days') as good,
        COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '7 days') as warning,
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired
      FROM batches
      WHERE hotel_id = $1 AND quantity > 0
    `, [req.hotelId])

    const stats = statsResult.rows[0] || { good: 0, warning: 0, expired: 0 }

    const message = `📊 Ежедневный отчёт FreshTrack

✅ В норме: ${stats.good}
⚠️ Скоро истекает: ${stats.warning}
🔴 Просрочено: ${stats.expired}

📅 ${new Date().toLocaleDateString('ru-RU')}`

    // Отправляем во все активные чаты отеля
    const chatsResult = await dbQuery(`
      SELECT chat_id FROM telegram_chats
      WHERE hotel_id = $1 AND is_active = true AND bot_removed = false
    `, [req.hotelId])

    let sentCount = 0
    for (const chat of chatsResult.rows) {
      try {
        await TelegramService.sendMessage(chat.chat_id, message)
        sentCount++
      } catch (err) {
        // Log but continue
      }
    }

    res.json({
      success: true,
      message: 'Daily report sent',
      sentTo: sentCount,
      stats
    })
  } catch (error) {
    logError('Send daily report error', error)
    res.status(500).json({ success: false, error: 'Failed to send daily report' })
  }
})

/**
 * GET /api/notifications/summary
 * Получить сводку уведомлений
 */
router.get('/summary', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE type = 'expiry') as expiry,
        COUNT(*) FILTER (WHERE type = 'critical') as critical,
        COUNT(*) FILTER (WHERE type = 'warning') as warning,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today
      FROM notifications
      WHERE hotel_id = $1
    `, [req.hotelId])

    const summary = result.rows[0] || {
      total: 0,
      unread: 0,
      expiry: 0,
      critical: 0,
      warning: 0,
      today: 0
    }

    res.json({
      success: true,
      summary
    })
  } catch (error) {
    logError('Get notifications summary error', error)
    res.status(500).json({ success: false, error: 'Failed to get summary' })
  }
})

/**
 * GET /api/notifications/status
 * Получить статус системы уведомлений
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Проверяем Telegram бота
    let telegramStatus = 'unknown'
    try {
      const { TelegramService } = await import('../../services/TelegramService.js')
      const botInfo = TelegramService.getBotInfo?.()
      telegramStatus = botInfo ? 'connected' : 'disconnected'
    } catch {
      telegramStatus = 'error'
    }

    // Считаем чаты
    const chatsResult = await dbQuery(`
      SELECT COUNT(*) as count FROM telegram_chats
      WHERE is_active = true AND bot_removed = false
    `)

    // Считаем pending уведомления
    const pendingResult = await dbQuery(`
      SELECT COUNT(*) as count FROM notification_queue
      WHERE status = 'pending'
    `)

    res.json({
      success: true,
      status: {
        telegram: telegramStatus,
        linkedChats: parseInt(chatsResult.rows[0]?.count || 0),
        pendingNotifications: parseInt(pendingResult.rows[0]?.count || 0),
        systemTime: new Date().toISOString()
      }
    })
  } catch (error) {
    logError('Get notification status error', error)
    res.status(500).json({ success: false, error: 'Failed to get status' })
  }
})

/**
 * Verify Telegram webhook secret token
 * Telegram sends X-Telegram-Bot-Api-Secret-Token header when secret_token is set
 */
function verifyTelegramWebhook(req, res, next) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  
  if (!secret) {
    // If secret not configured, allow (for backward compatibility)
    return next()
  }

  const token = req.headers['x-telegram-bot-api-secret-token']
  
  if (!token) {
    logWarn('Telegram webhook', 'Missing X-Telegram-Bot-Api-Secret-Token header')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Use constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    logWarn('Telegram webhook', 'Invalid secret token')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
}

/**
 * POST /api/notifications/telegram-webhook
 * Telegram webhook endpoint - receives updates from Telegram
 * This endpoint must be PUBLIC (no auth) for Telegram to call it
 */
router.post('/telegram-webhook', verifyTelegramWebhook, async (req, res) => {
  try {
    const { TelegramService } = await import('../../services/TelegramService.js')
    
    // Skip if Telegram is not configured
    if (!TelegramService.isConfigured()) {
      return res.sendStatus(200)
    }

    const update = req.body

    if (update) {
      await TelegramService.processUpdate(update)
    }

    // Always return 200 to Telegram (even on errors)
    res.sendStatus(200)
  } catch (error) {
    logError('Telegram webhook error', error)
    // Return 200 anyway to prevent Telegram from retrying
    res.sendStatus(200)
  }
})

export default router
