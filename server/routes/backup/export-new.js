/**
 * FreshTrack Export API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllProducts,
  getAllBatches,
  getAllCategories,
  getAllDepartments,
  getAllWriteOffs,
  getAuditLogs,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/export/products
router.get('/products', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, category_id, format = 'json' } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      category_id
    }
    
    const products = await getAllProducts(req.hotelId, filters)
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'product', entity_id: null,
      details: { count: products.length, format }, ip_address: req.ip
    })
    
    if (format === 'csv') {
      const headers = ['id', 'name', 'sku', 'barcode', 'category_id', 'department_id', 'unit', 'min_quantity', 'max_quantity']
      const csv = [
        headers.join(','),
        ...products.map(p => headers.map(h => `"${(p[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=products.csv')
      return res.send(csv)
    }
    
    res.json({ success: true, products, count: products.length })
  } catch (error) {
    console.error('Export products error:', error)
    res.status(500).json({ success: false, error: 'Failed to export products' })
  }
})

// GET /api/export/batches
router.get('/batches', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, product_id, status, format = 'json' } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      product_id, status
    }
    
    const batches = await getAllBatches(req.hotelId, filters)
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'batch', entity_id: null,
      details: { count: batches.length, format }, ip_address: req.ip
    })
    
    if (format === 'csv') {
      const headers = ['id', 'product_id', 'product_name', 'quantity', 'production_date', 'expiry_date', 'supplier', 'status']
      const csv = [
        headers.join(','),
        ...batches.map(b => headers.map(h => `"${(b[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=batches.csv')
      return res.send(csv)
    }
    
    res.json({ success: true, batches, count: batches.length })
  } catch (error) {
    console.error('Export batches error:', error)
    res.status(500).json({ success: false, error: 'Failed to export batches' })
  }
})

// GET /api/export/categories
router.get('/categories', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const categories = await getAllCategories(req.hotelId, {})
    res.json({ success: true, categories, count: categories.length })
  } catch (error) {
    console.error('Export categories error:', error)
    res.status(500).json({ success: false, error: 'Failed to export categories' })
  }
})

// GET /api/export/departments
router.get('/departments', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const departments = await getAllDepartments(req.hotelId, {})
    res.json({ success: true, departments, count: departments.length })
  } catch (error) {
    console.error('Export departments error:', error)
    res.status(500).json({ success: false, error: 'Failed to export departments' })
  }
})

// GET /api/export/write-offs
router.get('/write-offs', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query
    const filters = { start_date, end_date }
    
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'write_off', entity_id: null,
      details: { count: writeOffs.length, format }, ip_address: req.ip
    })
    
    res.json({ success: true, write_offs: writeOffs, count: writeOffs.length })
  } catch (error) {
    console.error('Export write-offs error:', error)
    res.status(500).json({ success: false, error: 'Failed to export write-offs' })
  }
})

// GET /api/export/audit
router.get('/audit', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { start_date, end_date, limit = 1000 } = req.query
    const filters = { start_date, end_date, limit: parseInt(limit) }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    
    res.json({ success: true, logs, count: logs.length })
  } catch (error) {
    console.error('Export audit logs error:', error)
    res.status(500).json({ success: false, error: 'Failed to export audit logs' })
  }
})

// GET /api/export/all
router.get('/all', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const [products, batches, categories, departments, writeOffs] = await Promise.all([
      getAllProducts(req.hotelId, {}),
      getAllBatches(req.hotelId, {}),
      getAllCategories(req.hotelId, {}),
      getAllDepartments(req.hotelId, {}),
      getAllWriteOffs(req.hotelId, {})
    ])
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'all', entity_id: null,
      details: { 
        products: products.length, batches: batches.length,
        categories: categories.length, departments: departments.length,
        write_offs: writeOffs.length
      }, ip_address: req.ip
    })
    
    res.json({
      success: true,
      data: { products, batches, categories, departments, write_offs: writeOffs },
      exported_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Export all error:', error)
    res.status(500).json({ success: false, error: 'Failed to export all data' })
  }
})

export default router
