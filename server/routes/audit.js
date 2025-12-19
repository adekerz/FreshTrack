/**
 * FreshTrack Audit Logs API
 * Audit trail and activity logs
 * For AuditLogsPage
 */

import express from 'express'
import { db, logAudit } from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware и hotelIsolation ко всем маршрутам
router.use(authMiddleware)
router.use(hotelIsolation)

// Middleware to require hotel context (with auto-selection for SUPER_ADMIN)
const requireHotelContext = (req, res, next) => {
  if (!req.hotelId) {
    // For SUPER_ADMIN, auto-select first hotel if none specified
    if (req.user?.role === 'SUPER_ADMIN') {
      const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
      if (firstHotel) {
        req.hotelId = firstHotel.id
        return next()
      }
    }
    return res.status(400).json({ 
      success: false, 
      error: 'Hotel context required. Please specify hotel_id.' 
    })
  }
  next()
}
router.use(requireHotelContext)

/**
 * GET /api/audit-logs - Get audit logs with pagination and filters
 */
router.get('/', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { 
      page = 1, 
      limit = 20, 
      actionType,
      entityType,
      dateFrom,
      dateTo,
      userId
    } = req.query
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    let where = 'WHERE al.hotel_id = ?'
    const params = [hotelId]
    
    if (actionType) {
      where += ' AND al.action = ?'
      params.push(actionType)
    }
    
    if (entityType) {
      where += ' AND al.entity_type = ?'
      params.push(entityType)
    }
    
    if (dateFrom) {
      where += ' AND DATE(al.created_at) >= ?'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      where += ' AND DATE(al.created_at) <= ?'
      params.push(dateTo)
    }
    
    if (userId) {
      where += ' AND al.user_id = ?'
      params.push(userId)
    }
    
    // Get total count
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs al ${where}
    `).get(...params).count
    
    // Get logs with pagination
    const logs = db.prepare(`
      SELECT 
        al.id,
        al.action,
        al.entity_type as entityType,
        al.entity_id as entityId,
        al.details,
        al.ip_address as ipAddress,
        al.created_at as createdAt,
        al.user_id as userId,
        COALESCE(u.name, al.user_name) as userName,
        u.login as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset)
    
    // Parse details JSON
    const parsedLogs = logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    }))
    
    res.json({
      logs: parsedLogs,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

/**
 * GET /api/audit-logs/actions - Get list of unique action types
 */
router.get('/actions', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const actions = db.prepare(`
      SELECT DISTINCT action FROM audit_logs 
      WHERE hotel_id = ? 
      ORDER BY action
    `).all(hotelId)
    
    res.json(actions.map(a => a.action))
  } catch (error) {
    console.error('Error fetching action types:', error)
    res.status(500).json({ error: 'Failed to fetch action types' })
  }
})

/**
 * GET /api/audit-logs/entity-types - Get list of unique entity types
 */
router.get('/entity-types', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const types = db.prepare(`
      SELECT DISTINCT entity_type FROM audit_logs 
      WHERE hotel_id = ? 
      ORDER BY entity_type
    `).all(hotelId)
    
    res.json(types.map(t => t.entity_type))
  } catch (error) {
    console.error('Error fetching entity types:', error)
    res.status(500).json({ error: 'Failed to fetch entity types' })
  }
})

/**
 * GET /api/audit-logs/:id - Get single audit log entry
 */
router.get('/:id', hotelAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const hotelId = req.hotelId
    
    const log = db.prepare(`
      SELECT 
        al.*,
        COALESCE(u.name, al.user_name) as user_display_name,
        u.login as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ? AND al.hotel_id = ?
    `).get(id, hotelId)
    
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' })
    }
    
    res.json({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })
  } catch (error) {
    console.error('Error fetching audit log:', error)
    res.status(500).json({ error: 'Failed to fetch audit log' })
  }
})

export default router
