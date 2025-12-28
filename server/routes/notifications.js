/**
 * FreshTrack Notifications API - PostgreSQL Async Version
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
  logAudit
} from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// GET /api/notifications
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const { type, is_read, limit, offset } = req.query
    // Use department from isolation middleware if user can't access all departments
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const filters = {
      user_id: req.user.id,
      department_id: deptId,
      type,
      is_read: is_read !== undefined ? is_read === 'true' : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    }
    const notifications = await getAllNotifications(req.hotelId, filters)
    const unreadCount = await getUnreadNotificationsCount(req.hotelId, req.user.id, deptId)
    res.json({ success: true, notifications, unread_count: unreadCount })
  } catch (error) {
    logError('Get notifications error', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications' })
  }
})

// GET /api/notifications/unread-count
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

// GET /api/notifications/logs - Get notification logs/history
router.get('/logs', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    
    // Get notifications as logs
    const filters = {
      department_id: deptId,
      type,
      limit: parseInt(limit),
      offset
    }
    
    const notifications = await getAllNotifications(req.hotelId, filters)
    
    // Transform to log format
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

// GET /api/notifications/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.READ), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access for notifications with department_id
    if (!req.canAccessAllDepartments && notification.department_id && notification.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    res.json({ success: true, notification })
  } catch (error) {
    logError('Get notification error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification' })
  }
})

// POST /api/notifications
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { type, title, message, priority, user_id, entity_type, entity_id, data, department_id } = req.body
    
    if (!type || !title) {
      return res.status(400).json({ success: false, error: 'Notification type and title are required' })
    }
    
    // Use provided department_id or fall back to user's department
    const notificationDeptId = department_id || req.departmentId
    
    // Non-admin users can only create notifications for their department
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
    
    res.status(201).json({ success: true, notification })
  } catch (error) {
    logError('Create notification error', error)
    res.status(500).json({ success: false, error: 'Failed to create notification' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
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

// PUT /api/notifications/read-all
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

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.DELETE), async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && notification.department_id && notification.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const success = await deleteNotification(req.params.id)
    res.json({ success })
  } catch (error) {
    logError('Delete notification error', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification' })
  }
})

// POST /api/notifications/test-telegram - Send test Telegram notification (alias)
router.post('/test-telegram', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    console.log('📤 Test Telegram request received')
    console.log('   User:', req.user?.name, 'Hotel ID:', req.hotelId)
    
    // Import TelegramService
    const { TelegramService } = await import('../services/TelegramService.js')
    const { query } = await import('../db/postgres.js')
    const { chatId } = req.body
    
    let targetChats = []
    
    if (chatId) {
      // Send to specific chat
      targetChats = [{ chat_id: chatId }]
    } else {
      // Get all linked chats for this hotel (or all chats for SUPER_ADMIN)
      let chatsQuery = `SELECT chat_id, chat_title FROM telegram_chats 
                        WHERE is_active = true AND bot_removed = false`
      const params = []
      
      if (req.hotelId) {
        chatsQuery += ` AND hotel_id = $1`
        params.push(req.hotelId)
      }
      
      console.log('   Query:', chatsQuery, 'Params:', params)
      const chatsResult = await query(chatsQuery, params)
      targetChats = chatsResult.rows
      console.log('   Found chats:', targetChats.length, targetChats)
    }
    
    if (targetChats.length === 0) {
      console.log('   ❌ No chats found')
      return res.status(400).json({ 
        success: false, 
        error: 'Нет привязанных Telegram чатов. Добавьте бота @adekerzbot в чат и используйте /link hotel:RC-ASTANA' 
      })
    }
    
    const testMessage = `✅ *Тест FreshTrack*

Если вы видите это сообщение, Telegram интеграция работает!

📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`
    
    const results = []
    for (const chat of targetChats) {
      try {
        console.log('   Sending to chat:', chat.chat_id)
        const result = await TelegramService.sendMessage(chat.chat_id, testMessage)
        console.log('   ✅ Sent! Message ID:', result?.message_id)
        results.push({ chatId: chat.chat_id, success: true, messageId: result?.message_id })
      } catch (error) {
        console.log('   ❌ Error:', error.message)
        results.push({ chatId: chat.chat_id, success: false, error: error.message })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    console.log('   Result: sent to', successCount, 'of', targetChats.length, 'chats')
    
    res.json({ 
      success: successCount > 0, 
      sentTo: successCount,
      totalChats: targetChats.length,
      results
    })
  } catch (error) {
    console.error('❌ Test telegram error:', error)
    logError('Test telegram error', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to send test message' })
  }
})

// POST /api/notifications/test - Send test notification
router.post('/test', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { type = 'test', channel = 'app' } = req.body
    
    // Create a test notification
    const notification = await createNotification({
      hotel_id: req.hotelId,
      department_id: req.departmentId,
      type: 'test',
      title: 'Тестовое уведомление',
      message: `Это тестовое уведомление. Канал: ${channel}`,
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

// POST /api/notifications/check-expiring - Manually trigger expiry check
router.post('/check-expiring', authMiddleware, requirePermission(PermissionResource.NOTIFICATIONS, PermissionAction.WRITE), async (req, res) => {
  try {
    const { NotificationEngine } = await import('../services/NotificationEngine.js')
    const count = await NotificationEngine.checkExpiringBatches()
    
    res.json({ 
      success: true, 
      message: `Expiry check complete`,
      notificationsCreated: count
    })
  } catch (error) {
    logError('Expiry check error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router



