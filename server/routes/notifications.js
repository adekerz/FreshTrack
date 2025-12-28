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
    // Import TelegramService
    const { TelegramService } = await import('../services/TelegramService.js')
    const { chatId } = req.body
    
    // Get chat ID from settings if not provided
    let targetChatId = chatId
    if (!targetChatId) {
      // Try to get from settings
      const { getSettingValue } = await import('../db/database.js')
      targetChatId = await getSettingValue(req.hotelId, null, 'telegram_chat_id')
    }
    
    if (!targetChatId) {
      return res.status(400).json({ success: false, error: 'No Telegram chat ID configured' })
    }
    
    const result = await TelegramService.sendMessage(
      targetChatId,
      '✅ *Тест FreshTrack*\n\nЕсли вы видите это сообщение, Telegram интеграция работает!'
    )
    
    res.json({ success: true, messageId: result?.message_id })
  } catch (error) {
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

export default router



