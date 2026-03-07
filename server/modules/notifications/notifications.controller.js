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
  validate,
} from './notifications.schemas.js'
import {
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction,
} from '../../middleware/auth.js'
import {
  getAllNotifications,
  getNotificationById,
  createNotification,
  deleteNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  logAudit,
} from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError, logInfo, logWarn } from '../../utils/logger.js'

const router = Router()

// ========================================
// Уведомления
// ========================================

/**
 * GET /api/notifications
 * Получить список уведомлений с фильтрацией
 */
router.get(
  '/',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ),
  async (req, res) => {
    try {
      const validation = validate(NotificationFiltersSchema, req.query)

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Ошибка валидации',
          details: validation.errors,
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
        offset: (filters.page - 1) * filters.limit,
      }

      const notifications = await getAllNotifications(req.hotelId, dbFilters)
      const unreadCount = await getUnreadNotificationsCount(
        req.hotelId,
        req.user.id,
        deptId
      )

      res.json({
        success: true,
        notifications,
        unread_count: unreadCount,
        page: filters.page,
        limit: filters.limit,
      })
    } catch (error) {
      logError('Get notifications error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to get notifications' })
    }
  }
)

/**
 * GET /api/notifications/unread-count
 * Получить количество непрочитанных
 */
router.get(
  '/unread-count',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ),
  async (req, res) => {
    try {
      const deptId = req.canAccessAllDepartments ? null : req.departmentId
      const count = await getUnreadNotificationsCount(
        req.hotelId,
        req.user.id,
        deptId
      )
      res.json({ success: true, count })
    } catch (error) {
      logError('Get unread count error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to get unread count' })
    }
  }
)

/**
 * GET /api/notifications/logs
 * История уведомлений
 */
router.get(
  '/logs',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type } = req.query
      const offset = (parseInt(page) - 1) * parseInt(limit)
      const deptId = req.canAccessAllDepartments ? null : req.departmentId

      const filters = {
        department_id: deptId,
        type,
        limit: parseInt(limit),
        offset,
      }

      const notifications = await getAllNotifications(req.hotelId, filters)

      const logs = notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        status: n.is_read ? 'read' : 'unread',
        priority: n.priority || 'normal',
        created_at: n.created_at,
        read_at: n.read_at,
      }))

      res.json({
        success: true,
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: logs.length,
        },
      })
    } catch (error) {
      logError('Get notification logs error', error)
      res.status(500).json({ success: false, error: 'Failed to fetch logs' })
    }
  }
)

/**
 * GET /api/notifications/email-preview?type=xxx
 * Returns rendered HTML of an email template with mock data (dev/admin tool)
 */
router.get(
  '/email-preview',
  authMiddleware,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ),
  async (req, res) => {
    try {
      const { type = 'welcome' } = req.query

      const SUPPORT_EMAIL =
        process.env.SUPPORT_EMAIL || 'support@freshtrack.systems'
      const APP_URL = process.env.APP_URL || 'http://localhost:5173'

      const mockUser = {
        id: 'preview',
        name: 'Alex Johnson',
        email: 'alex@example.com',
      }
      const mockHotel = {
        id: 'preview',
        name: 'Grand Hotel Plaza',
        marsha_code: 'TSEXR',
      }
      const mockDept = { id: 'preview', name: 'Bar', email: 'bar@example.com' }
      const mockAdmin = {
        id: 'preview',
        name: 'Maria Admin',
        email: 'admin@example.com',
      }

      const footer = () =>
        `<div style="text-align:center;color:#888;font-size:12px;margin-top:24px;padding-top:24px;border-top:1px solid #eee;">
        <p>The FreshTrack Team</p>
        <p>Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#888;">${SUPPORT_EMAIL}</a></p>
        <p>© ${new Date().getFullYear()} FreshTrack. All rights reserved.</p>
      </div>`

      const wrap = (content, title) => {
        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>${title}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;background:#f5f5f5;margin:0;padding:0}
        .container{max-width:600px;margin:0 auto;padding:20px}
        .card{background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
        .logo{text-align:center;margin-bottom:24px}.logo h1{color:#FF8D6B;font-size:28px;margin:0}
        .button{display:inline-block;background:#FF8D6B;color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px}
        .code{background:#f5f5f5;padding:16px 24px;border-radius:8px;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#FF8D6B;font-family:'Courier New',monospace}
        table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}th{background:#f8f9fa;font-weight:600}
      </style></head><body><div class="container"><div class="card">
        <div class="logo"><h1>FreshTrack</h1></div>
        <div class="content">${content}</div>
        ${footer()}
      </div></div></body></html>`
      }

      const reportDate = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      const templates = {
        welcome: () =>
          wrap(
            `
        <h2 style="margin-top:0">Welcome to FreshTrack</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>Welcome to FreshTrack. Your account for <strong>${mockHotel.name}</strong> has been created and is ready to use.</p>
        <p style="text-align:center;margin-top:24px"><a href="${APP_URL}" class="button">Open FreshTrack</a></p>
      `,
            'Welcome to FreshTrack'
          ),

        invite: () =>
          wrap(
            `
        <h2 style="margin-top:0">You have been invited to FreshTrack</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>An administrator has invited you to join FreshTrack for <strong>${mockHotel.name}</strong>.</p>
        <p><strong>Your sign-in details:</strong></p>
        <table style="margin:0 0 16px">
          <tr><td style="padding:4px 16px 4px 0;color:#666">Email</td><td><strong>${mockUser.email}</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Temporary password</td><td><strong style="font-family:'Courier New',monospace">Temp#Pass1234</strong></td></tr>
        </table>
        <p style="text-align:center;margin-top:24px"><a href="${APP_URL}/login" class="button">Sign In to FreshTrack</a></p>
        <p style="color:#888;font-size:14px;margin-top:20px">For security, do not share these credentials with anyone.</p>
      `,
            'Invitation'
          ),

        verification: () =>
          wrap(
            `
        <h2 style="margin-top:0">Your FreshTrack verification code</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>Your verification code is:</p>
        <div class="code">483920</div>
        <p style="text-align:center;margin-top:16px;color:#888">This code expires in <strong>10 minutes</strong>.</p>
        <p style="text-align:center;margin-top:12px;color:#888;font-size:14px">For your security, never share this code with anyone.</p>
      `,
            'Verification code'
          ),

        'dept-verification': () =>
          wrap(
            `
        <h2 style="margin-top:0">Verify email for ${mockDept.name} reports</h2>
        <p>Hello,</p>
        <p>A FreshTrack administrator has configured <strong>${mockDept.name}</strong> at <strong>${mockHotel.name}</strong> to send daily inventory reports to this email address.</p>
        <p>To confirm that you want to receive these reports, click the button below:</p>
        <p style="text-align:center;margin:24px 0"><a href="${APP_URL}/confirm-email?token=PREVIEW" class="button">Verify Email Address</a></p>
        <p style="font-size:14px;color:#666;margin-top:20px">Once verified, you will receive automated daily reports for <strong>${mockDept.name}</strong>.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #ddd">
        <p style="color:#888;font-size:13px">If you did not expect this email, no action is required.</p>
      `,
            'Dept email verification'
          ),

        'password-reset': () =>
          wrap(
            `
        <h2 style="margin-top:0">Reset your FreshTrack password</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>We received a request to reset the password for your FreshTrack account associated with <strong>${mockUser.email}</strong>.</p>
        <p>Click the button below to set a new password. This link will expire in <strong>1 hour</strong> and can only be used once.</p>
        <p style="text-align:center;margin:24px 0"><a href="${APP_URL}/reset-password?token=PREVIEW_TOKEN" class="button">Reset Password</a></p>
        <p style="color:#888;font-size:14px;margin-top:20px">If you did not request a password reset, you can safely ignore this email.</p>
      `,
            'Reset password'
          ),

        'expiry-report': () =>
          wrap(
            `
        <h2 style="margin-top:0">Expiry report for ${mockHotel.name} — ${reportDate}</h2>
        <p>Hi <strong>${mockAdmin.name}</strong>,</p>
        <p>Here is the daily expiration report for <strong>${mockHotel.name}</strong> as of ${reportDate}.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#FEE2E2">
            <td style="padding:12px;border-radius:8px 0 0 8px;color:#DC2626"><strong>Expired — Immediate action required</strong></td>
            <td style="padding:12px;text-align:right;border-radius:0 8px 8px 0"><strong style="font-size:24px;color:#DC2626">3</strong></td>
          </tr>
          <tr><td colspan="2" style="height:8px"></td></tr>
          <tr style="background:#FEF3C7">
            <td style="padding:12px;border-radius:8px 0 0 8px;color:#D97706"><strong>Expiring today</strong></td>
            <td style="padding:12px;text-align:right;border-radius:0 8px 8px 0"><strong style="font-size:24px;color:#D97706">5</strong></td>
          </tr>
          <tr><td colspan="2" style="height:8px"></td></tr>
          <tr style="background:#FEF9C3">
            <td style="padding:12px;border-radius:8px 0 0 8px;color:#CA8A04"><strong>Expiring soon</strong></td>
            <td style="padding:12px;text-align:right;border-radius:0 8px 8px 0"><strong style="font-size:24px;color:#CA8A04">12</strong></td>
          </tr>
        </table>
        <p style="text-align:center;margin-top:24px"><a href="${APP_URL}/inventory" class="button">View Full Report</a></p>
      `,
            'Expiry report'
          ),

        'join-request': () =>
          wrap(
            `
        <h2 style="margin-top:0">New access request for ${mockHotel.name}</h2>
        <p>Hi <strong>${mockAdmin.name}</strong>,</p>
        <p><strong>${mockUser.name}</strong> (<a href="mailto:${mockUser.email}">${mockUser.email}</a>) has requested to join <strong>${mockHotel.name}</strong> on FreshTrack.</p>
        <p>You can approve or decline this request from your dashboard:</p>
        <p style="text-align:center;margin-top:24px"><a href="${APP_URL}/settings?tab=users" class="button">Review Request</a></p>
      `,
            'New access request'
          ),

        'join-approved': () =>
          wrap(
            `
        <h2 style="margin-top:0">Your request to join ${mockHotel.name} has been approved</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>Your request to join <strong>${mockHotel.name}</strong> on FreshTrack has been approved.</p>
        <p>You can now sign in and begin using FreshTrack.</p>
        <p style="text-align:center;margin-top:24px"><a href="${APP_URL}" class="button">Sign In to FreshTrack</a></p>
      `,
            'Join approved'
          ),

        'account-deleted': () =>
          wrap(
            `
        <h2 style="margin-top:0">Your FreshTrack account has been deleted</h2>
        <p>Hi <strong>${mockUser.name}</strong>,</p>
        <p>Your FreshTrack account (<strong>${mockUser.email}</strong> for ${mockHotel.name}) has been deleted by your administrator.</p>
        <ul style="line-height:1.8">
          <li>Your access to FreshTrack has been permanently revoked</li>
          <li>Your personal account data has been removed</li>
          <li>Hotel inventory data is unaffected</li>
        </ul>
        <p>If you believe this was done in error, contact your property administrator.</p>
      `,
            'Account deleted'
          ),
      }

      const builder = templates[type]
      if (!builder) {
        return res.status(400).json({
          success: false,
          error: `Unknown template type: ${type}. Valid: ${Object.keys(templates).join(', ')}`,
        })
      }

      const html = builder()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    } catch (error) {
      logError('Email preview error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/notifications/:id
 * Получить уведомление по ID
 */
router.get(
  '/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ),
  async (req, res) => {
    try {
      const notification = await getNotificationById(req.params.id)

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, error: 'Notification not found' })
      }

      if (notification.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      if (
        !req.canAccessAllDepartments &&
        notification.department_id &&
        notification.department_id !== req.departmentId
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Access denied to this department' })
      }

      res.json({ success: true, notification })
    } catch (error) {
      logError('Get notification error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to get notification' })
    }
  }
)

/**
 * POST /api/notifications
 * Создать уведомление
 */
router.post(
  '/',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE),
  async (req, res) => {
    try {
      const {
        type,
        title,
        message,
        priority,
        user_id,
        entity_type,
        entity_id,
        data,
        department_id,
      } = req.body

      if (!type || !title) {
        return res
          .status(400)
          .json({
            success: false,
            error: 'Notification type and title are required',
          })
      }

      const notificationDeptId = department_id || req.departmentId

      if (
        !req.canAccessAllDepartments &&
        department_id &&
        department_id !== req.departmentId
      ) {
        return res
          .status(403)
          .json({
            success: false,
            error: 'Cannot create notification for another department',
          })
      }

      const notification = await createNotification({
        hotel_id: req.hotelId,
        department_id: notificationDeptId,
        type,
        title,
        message,
        priority: priority || 'normal',
        user_id: user_id || req.user.id,
        entity_type,
        entity_id,
        data,
      })

      await logAudit({
        userId: req.user.id,
        hotelId: req.hotelId,
        action: 'CREATE',
        resource: 'Notification',
        resourceId: notification.id,
        details: { type, title },
      })

      res.status(201).json({ success: true, notification })
    } catch (error) {
      logError('Create notification error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to create notification' })
    }
  }
)

/**
 * PUT /api/notifications/:id/read
 * Отметить как прочитанное
 */
router.put(
  '/:id/read',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const notification = await getNotificationById(req.params.id)

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, error: 'Notification not found' })
      }

      if (notification.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      if (
        !req.canAccessAllDepartments &&
        notification.department_id &&
        notification.department_id !== req.departmentId
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Access denied to this department' })
      }

      const success = await markNotificationAsRead(req.params.id)
      res.json({ success })
    } catch (error) {
      logError('Mark notification read error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to mark notification as read' })
    }
  }
)

/**
 * PUT /api/notifications/read-all
 * Отметить все как прочитанные
 */
router.put(
  '/read-all',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const deptId = req.canAccessAllDepartments ? null : req.departmentId
      const count = await markAllNotificationsAsRead(req.hotelId, deptId)
      res.json({ success: true, count })
    } catch (error) {
      logError('Mark all notifications read error', error)
      res
        .status(500)
        .json({
          success: false,
          error: 'Failed to mark all notifications as read',
        })
    }
  }
)

/**
 * POST /api/notifications/mark-batch
 * Пакетная пометка уведомлений
 */
router.post(
  '/mark-batch',
  authMiddleware,
  hotelIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const validation = validate(MarkNotificationsSchema, req.body)

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Ошибка валидации',
          details: validation.errors,
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
      res
        .status(500)
        .json({ success: false, error: 'Failed to mark notifications' })
    }
  }
)

/**
 * DELETE /api/notifications/:id
 * Удалить уведомление
 */
router.delete(
  '/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.DELETE),
  async (req, res) => {
    try {
      const notification = await getNotificationById(req.params.id)

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, error: 'Notification not found' })
      }

      if (notification.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      if (
        !req.canAccessAllDepartments &&
        notification.department_id &&
        notification.department_id !== req.departmentId
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Access denied to this department' })
      }

      const success = await deleteNotification(req.params.id)

      await logAudit({
        userId: req.user.id,
        hotelId: req.hotelId,
        action: 'DELETE',
        resource: 'Notification',
        resourceId: req.params.id,
        details: {},
      })

      res.json({ success })
    } catch (error) {
      logError('Delete notification error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete notification' })
    }
  }
)

// ========================================
// Тестирование и Telegram
// ========================================

/**
 * POST /api/notifications/test
 * Тестовое уведомление
 */
router.post(
  '/test',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE),
  async (req, res) => {
    try {
      // Можно не валидировать строго, использовать дефолты
      const { channel = 'in_app', title, message } = req.body

      const notification = await createNotification({
        hotel_id: req.hotelId,
        department_id: req.departmentId,
        type: 'system',
        title: title || 'Тестовое уведомление',
        message: message || `Это тестовое уведомление. Канал: ${channel}`,
        priority: 'normal',
        user_id: req.user.id,
        data: { test: true, channel },
      })

      res.json({
        success: true,
        notification,
        message: 'Test notification sent successfully',
      })
    } catch (error) {
      logError('Test notification error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to send test notification' })
    }
  }
)

/**
 * POST /api/notifications/test-telegram
 * Тест Telegram
 */
router.post(
  '/test-telegram',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE),
  async (req, res) => {
    try {
      logInfo('Notifications', 'Test Telegram request', {
        userName: req.user?.name,
        hotelId: req.hotelId,
      })

      const { TelegramService } =
        await import('../../services/TelegramService.js')

      // Проверяем, настроен ли Telegram бот
      if (!TelegramService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error:
            'Telegram бот не настроен. Установите переменную окружения TELEGRAM_BOT_TOKEN.',
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
          error:
            'Нет привязанных Telegram чатов. Добавьте бота @freshtracksystemsbot в чат и используйте /link MARSHA_CODE',
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
          const result = await TelegramService.sendMessage(
            chat.chat_id,
            testMessage
          )
          if (result && !result.skipped) {
            results.push({
              chatId: chat.chat_id,
              success: true,
              messageId: result?.message_id,
            })
          } else {
            results.push({
              chatId: chat.chat_id,
              success: false,
              error: 'Telegram не настроен',
            })
          }
        } catch (error) {
          const errorMessage = error.message || String(error)

          // Определяем тип ошибки
          if (
            errorMessage.includes('Unauthorized') ||
            errorMessage.includes('401')
          ) {
            hasUnauthorizedError = true
            results.push({
              chatId: chat.chat_id,
              success: false,
              error:
                'Неверный токен Telegram бота. Проверьте переменную окружения TELEGRAM_BOT_TOKEN.',
            })
          } else {
            results.push({
              chatId: chat.chat_id,
              success: false,
              error: errorMessage,
            })
          }
        }
      }

      const successCount = results.filter((r) => r.success).length

      // Также отправляем email уведомление текущему пользователю
      let emailSent = false
      let emailError = null

      if (req.user && req.user.email) {
        try {
          const { sendEmail, EMAIL_FROM } =
            await import('../../services/EmailService.js')

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
            text: 'Если вы видите это письмо, email уведомления работают правильно!',
          })

          emailSent = true
          logInfo(
            'Test notification',
            `📧 Test email sent to ${emailRecipient}`
          )
        } catch (error) {
          emailError = error.message || String(error)
          logError(
            'Test notification',
            `Failed to send test email: ${emailError}`
          )
        }
      }

      // Если все попытки завершились ошибкой Unauthorized, возвращаем специальное сообщение
      // Используем 400 вместо 401, чтобы не путать с ошибкой авторизации пользователя
      if (hasUnauthorizedError && successCount === 0) {
        return res.status(400).json({
          success: false,
          error:
            'Ошибка авторизации Telegram бота. Проверьте правильность токена TELEGRAM_BOT_TOKEN в настройках сервера.',
          sentTo: 0,
          totalChats: targetChats.length,
          emailSent,
          emailError,
          results,
        })
      }

      res.json({
        success: successCount > 0 || emailSent,
        sentTo: successCount,
        totalChats: targetChats.length,
        emailSent,
        emailError: emailError || null,
        results,
      })
    } catch (error) {
      logError('Test telegram error', error)

      // Определяем тип ошибки для более понятного сообщения
      const errorMessage = error.message || String(error)
      let userMessage = 'Ошибка отправки тестового сообщения'
      let statusCode = 500

      if (
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401')
      ) {
        userMessage =
          'Ошибка авторизации Telegram бота. Проверьте правильность токена TELEGRAM_BOT_TOKEN.'
        statusCode = 400 // Используем 400 вместо 401, чтобы не путать с ошибкой авторизации пользователя
      } else if (errorMessage.includes('not configured')) {
        userMessage =
          'Telegram бот не настроен. Установите переменную окружения TELEGRAM_BOT_TOKEN.'
        statusCode = 400
      }

      res.status(statusCode).json({
        success: false,
        error: userMessage,
        details:
          process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      })
    }
  }
)

/**
 * POST /api/notifications/send-daily-report
 * Отправить ежедневный агрегированный отчёт
 *
 * Notifications are sent only once per day as an aggregated report
 * No per-item or real-time alerts by design (anti-spam UX)
 */
router.post(
  '/send-daily-report',
  authMiddleware,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.WRITE),
  async (req, res) => {
    try {
      const { NotificationEngine } =
        await import('../../services/NotificationEngine.js')
      const result = await NotificationEngine.sendDailyReport()

      res.json({
        success: true,
        message: 'Daily report sent',
        results: result,
      })
    } catch (error) {
      logError('Daily report error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/notifications/send-daily
 * Отправить ежедневный отчёт
 */
router.post(
  '/send-daily',
  authMiddleware,
  hotelIsolation,
  requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE),
  async (req, res) => {
    try {
      const { TelegramService } =
        await import('../../services/TelegramService.js')

      // Получаем статистику для отеля
      const statsResult = await dbQuery(
        `
      SELECT 
        COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date > CURRENT_DATE + INTERVAL '7 days') as good,
        COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '7 days') as warning,
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired
      FROM batches
      WHERE hotel_id = $1 AND quantity > 0
    `,
        [req.hotelId]
      )

      const stats = statsResult.rows[0] || { good: 0, warning: 0, expired: 0 }

      const message = `📊 Ежедневный отчёт FreshTrack

✅ В норме: ${stats.good}
⚠️ Скоро истекает: ${stats.warning}
🔴 Просрочено: ${stats.expired}

📅 ${new Date().toLocaleDateString('ru-RU')}`

      // Отправляем во все активные чаты отеля
      const chatsResult = await dbQuery(
        `
      SELECT chat_id FROM telegram_chats
      WHERE hotel_id = $1 AND is_active = true AND bot_removed = false
    `,
        [req.hotelId]
      )

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
        stats,
      })
    } catch (error) {
      logError('Send daily report error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to send daily report' })
    }
  }
)

/**
 * GET /api/notifications/summary
 * Получить сводку уведомлений
 */
router.get('/summary', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const result = await dbQuery(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE type = 'expiry') as expiry,
        COUNT(*) FILTER (WHERE type = 'critical') as critical,
        COUNT(*) FILTER (WHERE type = 'warning') as warning,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today
      FROM notifications
      WHERE hotel_id = $1
    `,
      [req.hotelId]
    )

    const summary = result.rows[0] || {
      total: 0,
      unread: 0,
      expiry: 0,
      critical: 0,
      warning: 0,
      today: 0,
    }

    res.json({
      success: true,
      summary,
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
      const { TelegramService } =
        await import('../../services/TelegramService.js')
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
        systemTime: new Date().toISOString(),
      },
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
    logWarn(
      'Telegram webhook',
      'Missing X-Telegram-Bot-Api-Secret-Token header'
    )
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
    const { TelegramService } =
      await import('../../services/TelegramService.js')

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
