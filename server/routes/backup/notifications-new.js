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
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// GET /api/notifications
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { type, is_read, limit, offset } = req.query
    const filters = {
      user_id: req.user.id,
      type,
      is_read: is_read !== undefined ? is_read === 'true' : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    }
    const notifications = await getAllNotifications(req.hotelId, filters)
    const unreadCount = await getUnreadNotificationsCount(req.hotelId, req.user.id)
    res.json({ success: true, notifications, unread_count: unreadCount })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications' })
  }
})

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const count = await getUnreadNotificationsCount(req.hotelId, req.user.id)
    res.json({ success: true, count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ success: false, error: 'Failed to get unread count' })
  }
})

// GET /api/notifications/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, notification })
  } catch (error) {
    console.error('Get notification error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification' })
  }
})

// POST /api/notifications
router.post('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { type, title, message, priority, user_id, entity_type, entity_id, data } = req.body
    
    if (!type || !title) {
      return res.status(400).json({ success: false, error: 'Notification type and title are required' })
    }
    
    const notification = await createNotification({
      hotel_id: req.hotelId,
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
router.put('/:id/read', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await markNotificationAsRead(req.params.id)
    res.json({ success })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const count = await markAllNotificationsAsRead(req.hotelId, req.user.id)
    res.json({ success: true, count })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' })
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id)
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }
    if (notification.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteNotification(req.params.id)
    res.json({ success })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete notification' })
  }
})

export default router
