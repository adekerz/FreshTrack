/**
 * FreshTrack Notifications API - PostgreSQL Async Version
 */

import express from 'express'
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
    console.error('Get notifications error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications' })
  }
})

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const count = await getUnreadNotificationsCount(req.hotelId, req.user.id, deptId)
    res.json({ success: true, count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ success: false, error: 'Failed to get unread count' })
  }
})

// GET /api/notifications/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
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
    console.error('Get notification error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification' })
  }
})

// POST /api/notifications
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
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
    console.error('Create notification error:', error)
    res.status(500).json({ success: false, error: 'Failed to create notification' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
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
    console.error('Mark notification read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const count = await markAllNotificationsAsRead(req.hotelId, deptId)
    res.json({ success: true, count })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' })
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
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
    console.error('Delete notification error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification' })
  }
})

export default router
