/**
 * FreshTrack Audit Logs API
 * Журнал действий пользователей
 * Updated for multi-hotel architecture
 */

import express from 'express'
import { db, logAudit } from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// Применяем middleware ко всем маршрутам
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
 * GET /api/audit-logs - Получить журнал действий
 */
router.get('/', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { 
      action, 
      entityType,
      userId, 
      dateFrom,
      dateTo,
      limit = 20, 
      page = 1
    } = req.query
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    let where = 'WHERE (hotel_id = ? OR hotel_id IS NULL)'
    const params = [hotelId]
    
    if (action && action !== 'all' && action !== '') {
      where += ' AND action = ?'
      params.push(action)
    }
    
    if (entityType && entityType !== 'all' && entityType !== '') {
      where += ' AND entity_type = ?'
      params.push(entityType)
    }
    
    if (userId && userId !== 'all' && userId !== '') {
      where += ' AND user_id = ?'
      params.push(userId)
    }
    
    if (dateFrom) {
      where += ' AND date(created_at) >= date(?)'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      where += ' AND date(created_at) <= date(?)'
      params.push(dateTo)
    }
    
    // Get logs
    const sql = `
      SELECT 
        id,
        hotel_id as hotelId,
        user_id as userId,
        user_name as userName,
        action,
        entity_type as entityType,
        entity_id as entityId,
        details,
        ip_address as ipAddress,
        created_at as createdAt
      FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    const logs = db.prepare(sql).all(...params, parseInt(limit), offset)
    
    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${where}`
    const countResult = db.prepare(countSql).get(...params)
    
    res.json({
      logs,
      total: countResult.total,
      limit: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.total / parseInt(limit))
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

/**
 * GET /api/audit-logs/users - Получить список пользователей из логов
 */
router.get('/users', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const users = db.prepare(`
      SELECT DISTINCT user_id as userId, user_name as userName
      FROM audit_logs
      WHERE hotel_id = ? OR hotel_id IS NULL
      ORDER BY user_name
    `).all(hotelId)
    
    res.json({ users })
  } catch (error) {
    console.error('Error fetching audit users:', error)
    res.status(500).json({ error: 'Failed to fetch audit users' })
  }
})

/**
 * GET /api/audit-logs/actions - Получить статистику по действиям
 */
router.get('/actions', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const stats = db.prepare(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE hotel_id = ? OR hotel_id IS NULL
      GROUP BY action
      ORDER BY count DESC
    `).all(hotelId)
    
    res.json({ stats })
  } catch (error) {
    console.error('Error fetching audit stats:', error)
    res.status(500).json({ error: 'Failed to fetch audit stats' })
  }
})

/**
 * GET /api/audit-logs/entity-types - Получить список типов сущностей
 */
router.get('/entity-types', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const types = db.prepare(`
      SELECT DISTINCT entity_type as entityType, COUNT(*) as count
      FROM audit_logs
      WHERE (hotel_id = ? OR hotel_id IS NULL) AND entity_type IS NOT NULL
      GROUP BY entity_type
      ORDER BY count DESC
    `).all(hotelId)
    
    res.json({ types })
  } catch (error) {
    console.error('Error fetching entity types:', error)
    res.status(500).json({ error: 'Failed to fetch entity types' })
  }
})

export default router
