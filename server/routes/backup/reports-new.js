/**
 * FreshTrack Reports API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllProducts,
  getAllBatches,
  getAllWriteOffs,
  getAuditLogs,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/reports/inventory
router.get('/inventory', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, category_id, as_of_date } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      category_id
    }
    
    const products = await getAllProducts(req.hotelId, filters)
    const batches = await getAllBatches(req.hotelId, filters)
    
    // Calculate totals
    const summary = {
      total_products: products.length,
      total_batches: batches.length,
      total_quantity: batches.reduce((sum, b) => sum + (b.quantity || 0), 0),
      expiring_soon: batches.filter(b => {
        if (!b.expiry_date) return false
        const expDate = new Date(b.expiry_date)
        const daysUntilExpiry = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24))
        return daysUntilExpiry > 0 && daysUntilExpiry <= 7
      }).length,
      expired: batches.filter(b => b.expiry_date && new Date(b.expiry_date) < new Date()).length,
      low_stock: products.filter(p => p.current_quantity !== undefined && 
        p.min_quantity !== undefined && p.current_quantity < p.min_quantity).length
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'inventory', filters }, ip_address: req.ip
    })
    
    res.json({ success: true, summary, products, batches })
  } catch (error) {
    console.error('Get inventory report error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate inventory report' })
  }
})

// GET /api/reports/expiry
router.get('/expiry', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, days = 30 } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      status: 'active'
    }
    
    const batches = await getAllBatches(req.hotelId, filters)
    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + parseInt(days))
    
    const expiringBatches = batches.filter(b => {
      if (!b.expiry_date) return false
      const expDate = new Date(b.expiry_date)
      return expDate >= now && expDate <= targetDate
    }).map(b => ({
      ...b,
      days_until_expiry: Math.ceil((new Date(b.expiry_date) - now) / (1000 * 60 * 60 * 24))
    })).sort((a, b) => a.days_until_expiry - b.days_until_expiry)
    
    const expiredBatches = batches.filter(b => {
      if (!b.expiry_date) return false
      return new Date(b.expiry_date) < now
    }).map(b => ({
      ...b,
      days_expired: Math.ceil((now - new Date(b.expiry_date)) / (1000 * 60 * 60 * 24))
    }))
    
    res.json({
      success: true,
      expiring: expiringBatches,
      expired: expiredBatches,
      summary: {
        expiring_count: expiringBatches.length,
        expired_count: expiredBatches.length
      }
    })
  } catch (error) {
    console.error('Get expiry report error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate expiry report' })
  }
})

// GET /api/reports/write-offs
router.get('/write-offs', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { department_id, start_date, end_date, reason } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      start_date, end_date, reason
    }
    
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    
    const summary = {
      total_write_offs: writeOffs.length,
      total_quantity: writeOffs.reduce((sum, w) => sum + (w.quantity || 0), 0),
      by_reason: writeOffs.reduce((acc, w) => {
        acc[w.reason || 'unknown'] = (acc[w.reason || 'unknown'] || 0) + 1
        return acc
      }, {})
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'write_offs', filters }, ip_address: req.ip
    })
    
    res.json({ success: true, summary, write_offs: writeOffs })
  } catch (error) {
    console.error('Get write-offs report error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate write-offs report' })
  }
})

// GET /api/reports/activity
router.get('/activity', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { start_date, end_date, user_id, action, entity_type, limit = 100 } = req.query
    const filters = { start_date, end_date, user_id, action, entity_type, limit: parseInt(limit) }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    
    const summary = {
      total_actions: logs.length,
      by_action: logs.reduce((acc, l) => {
        acc[l.action] = (acc[l.action] || 0) + 1
        return acc
      }, {}),
      by_user: logs.reduce((acc, l) => {
        acc[l.user_name || 'system'] = (acc[l.user_name || 'system'] || 0) + 1
        return acc
      }, {})
    }
    
    res.json({ success: true, summary, logs })
  } catch (error) {
    console.error('Get activity report error:', error)
    res.status(500).json({ success: false, error: 'Failed to generate activity report' })
  }
})

// GET /api/reports/dashboard
router.get('/dashboard', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id } = req.query
    const filters = { department_id: department_id || req.departmentId }
    
    const products = await getAllProducts(req.hotelId, filters)
    const batches = await getAllBatches(req.hotelId, filters)
    
    const now = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    
    const dashboard = {
      total_products: products.length,
      active_products: products.filter(p => p.is_active).length,
      total_batches: batches.length,
      active_batches: batches.filter(b => b.status === 'active').length,
      expiring_this_week: batches.filter(b => {
        if (!b.expiry_date) return false
        const expDate = new Date(b.expiry_date)
        return expDate >= now && expDate <= weekFromNow
      }).length,
      expired: batches.filter(b => b.expiry_date && new Date(b.expiry_date) < now).length,
      low_stock_products: products.filter(p => 
        p.current_quantity !== undefined && p.min_quantity !== undefined && 
        p.current_quantity < p.min_quantity
      ).length
    }
    
    res.json({ success: true, dashboard })
  } catch (error) {
    console.error('Get dashboard error:', error)
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' })
  }
})

export default router
