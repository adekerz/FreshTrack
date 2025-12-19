/**
 * FreshTrack Collections API
 * History of collected (written-off) items
 * For CollectionHistoryPage
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
 * GET /api/collections/stats - Get collection statistics
 */
router.get('/stats', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    // Today
    const today = db.prepare(`
      SELECT COUNT(*) as count FROM write_offs 
      WHERE hotel_id = ? AND DATE(written_off_at) = DATE('now', 'localtime')
    `).get(hotelId)
    
    // This week
    const week = db.prepare(`
      SELECT COUNT(*) as count FROM write_offs 
      WHERE hotel_id = ? 
        AND DATE(written_off_at) >= DATE('now', 'localtime', '-7 days')
    `).get(hotelId)
    
    // This month
    const month = db.prepare(`
      SELECT COUNT(*) as count FROM write_offs 
      WHERE hotel_id = ? 
        AND DATE(written_off_at) >= DATE('now', 'localtime', 'start of month')
    `).get(hotelId)
    
    // Total
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM write_offs WHERE hotel_id = ?
    `).get(hotelId)
    
    res.json({
      today: today.count,
      week: week.count,
      month: month.count,
      total: total.count
    })
  } catch (error) {
    console.error('Error fetching collection stats:', error)
    res.status(500).json({ error: 'Failed to fetch collection stats' })
  }
})

/**
 * GET /api/collections - Get collection history with pagination and filters
 */
router.get('/', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { 
      page = 1, 
      limit = 20, 
      departmentId, 
      reason, 
      startDate, 
      endDate 
    } = req.query
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    let where = 'WHERE wo.hotel_id = ?'
    const params = [hotelId]
    
    if (departmentId) {
      where += ' AND wo.department_id = ?'
      params.push(departmentId)
    }
    
    if (reason) {
      where += ' AND wo.reason = ?'
      params.push(reason)
    }
    
    if (startDate) {
      where += ' AND DATE(wo.written_off_at) >= ?'
      params.push(startDate)
    }
    
    if (endDate) {
      where += ' AND DATE(wo.written_off_at) <= ?'
      params.push(endDate)
    }
    
    // Get total count
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM write_offs wo ${where}
    `).get(...params).count
    
    // Get logs with pagination
    const logs = db.prepare(`
      SELECT 
        wo.id,
        wo.written_off_at as date,
        wo.written_off_at as collectedAt,
        wo.reason,
        wo.quantity,
        wo.product_name as productName,
        wo.comment,
        p.name as productNameRef,
        c.name as categoryName,
        d.id as departmentId,
        d.name as departmentName,
        u.name as performedBy,
        u.name as collectedByName,
        u.login as performedByUsername,
        wo.written_off_at as createdAt,
        b.expiry_date as expiryDate
      FROM write_offs wo
      LEFT JOIN products p ON wo.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN batches b ON wo.batch_id = b.id
      JOIN departments d ON wo.department_id = d.id
      LEFT JOIN users u ON wo.written_off_by = u.id
      ${where}
      ORDER BY wo.written_off_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset)
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching collections:', error)
    res.status(500).json({ error: 'Failed to fetch collections' })
  }
})

/**
 * GET /api/collections/:id - Get single collection record
 */
router.get('/:id', hotelAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const hotelId = req.hotelId
    
    const record = db.prepare(`
      SELECT 
        wo.*,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        u.full_name as performed_by_name
      FROM write_offs wo
      JOIN products p ON wo.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON wo.department_id = d.id
      LEFT JOIN users u ON wo.performed_by = u.id
      WHERE wo.id = ? AND wo.hotel_id = ?
    `).get(id, hotelId)
    
    if (!record) {
      return res.status(404).json({ error: 'Collection record not found' })
    }
    
    res.json(record)
  } catch (error) {
    console.error('Error fetching collection:', error)
    res.status(500).json({ error: 'Failed to fetch collection' })
  }
})

export default router
