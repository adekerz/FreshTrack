/**
 * FreshTrack Export API - PostgreSQL Async Version
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllProducts,
  getAllBatches,
  getAllCategories,
  getAllDepartments,
  getAllWriteOffs,
  getAuditLogs,
  logAudit,
  query
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

// GET /api/export/products
router.get('/products', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { format = 'json' } = req.query
    
    // getAllProducts only accepts hotelId
    const products = await getAllProducts(req.hotelId)
    
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
    logError('Export products error', error)
    res.status(500).json({ success: false, error: 'Failed to export products' })
  }
})

// GET /api/export/batches
router.get('/batches', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, product_id, status, format = 'json' } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    
    // getAllBatches signature: (hotelId, departmentId, status)
    const batches = await getAllBatches(req.hotelId, deptId, status)
    
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
    logError('Export batches error', error)
    res.status(500).json({ success: false, error: 'Failed to export batches' })
  }
})

// GET /api/export/categories
router.get('/categories', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const categories = await getAllCategories(req.hotelId)
    res.json({ success: true, categories, count: categories.length })
  } catch (error) {
    logError('Export categories error', error)
    res.status(500).json({ success: false, error: 'Failed to export categories' })
  }
})

// GET /api/export/departments
router.get('/departments', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const departments = await getAllDepartments(req.hotelId)
    res.json({ success: true, departments, count: departments.length })
  } catch (error) {
    logError('Export departments error', error)
    res.status(500).json({ success: false, error: 'Failed to export departments' })
  }
})

// GET /api/export/write-offs
router.get('/write-offs', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, start_date, end_date, format = 'json' } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { department_id: deptId, start_date, end_date }
    
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'write_off', entity_id: null,
      details: { count: writeOffs.length, format }, ip_address: req.ip
    })
    
    res.json({ success: true, write_offs: writeOffs, count: writeOffs.length })
  } catch (error) {
    logError('Export write-offs error', error)
    res.status(500).json({ success: false, error: 'Failed to export write-offs' })
  }
})

// GET /api/export/inventory - Export inventory (products with current batches)
router.get('/inventory', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, format = 'json' } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    
    const [products, batches] = await Promise.all([
      getAllProducts(req.hotelId),
      getAllBatches(req.hotelId, deptId, null)
    ])
    
    // Merge products with their batch quantities
    const inventory = products.map(product => {
      const productBatches = batches.filter(b => b.product_id === product.id)
      const totalQuantity = productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)
      const nearestExpiry = productBatches
        .filter(b => b.expiry_date)
        .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0]?.expiry_date || null
      
      return {
        ...product,
        total_quantity: totalQuantity,
        batch_count: productBatches.length,
        nearest_expiry: nearestExpiry
      }
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'inventory', entity_id: null,
      details: { count: inventory.length, format }, ip_address: req.ip
    })
    
    if (format === 'csv') {
      const headers = ['id', 'name', 'sku', 'category_name', 'department_name', 'unit', 'total_quantity', 'batch_count', 'nearest_expiry']
      const csv = [
        headers.join(','),
        ...inventory.map(p => headers.map(h => `"${(p[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv')
      return res.send(csv)
    }
    
    res.json({ success: true, inventory, count: inventory.length })
  } catch (error) {
    logError('Export inventory error', error)
    res.status(500).json({ success: false, error: 'Failed to export inventory' })
  }
})

// GET /api/export/collections - Export FIFO collection history
router.get('/collections', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, start_date, end_date, format = 'json' } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    
    // Query collection_history table using imported query function
    let queryText = `
      SELECT ch.*, 
             u.name as collected_by_name
      FROM collection_history ch
      LEFT JOIN users u ON ch.user_id = u.id
      WHERE ch.hotel_id = $1
    `
    const params = [req.hotelId]
    let paramIndex = 2
    
    if (deptId) {
      queryText += ` AND ch.department_id = $${paramIndex++}`
      params.push(deptId)
    }
    if (start_date) {
      queryText += ` AND ch.collected_at >= $${paramIndex++}`
      params.push(start_date)
    }
    if (end_date) {
      queryText += ` AND ch.collected_at <= $${paramIndex++}`
      params.push(end_date)
    }
    
    queryText += ' ORDER BY ch.collected_at DESC LIMIT 10000'
    
    const result = await query(queryText, params)
    const collections = result.rows || []
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'export', entity_type: 'collections', entity_id: null,
      details: { count: collections.length, format }, ip_address: req.ip
    })
    
    if (format === 'csv') {
      const headers = ['id', 'product_name', 'category_name', 'quantity', 'reason', 'collected_by_name', 'collected_at', 'expiry_date']
      const csv = [
        headers.join(','),
        ...collections.map(c => headers.map(h => `"${(c[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=collections.csv')
      return res.send(csv)
    }
    
    res.json({ success: true, collections, count: collections.length })
  } catch (error) {
    logError('Export collections error', error)
    res.status(500).json({ success: false, error: 'Failed to export collections' })
  }
})

// GET /api/export/audit
router.get('/audit', authMiddleware, hotelIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
  try {
    const { start_date, end_date, limit = 1000 } = req.query
    const filters = { start_date, end_date, limit: parseInt(limit) }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    
    res.json({ success: true, logs, count: logs.length })
  } catch (error) {
    logError('Export audit logs error', error)
    res.status(500).json({ success: false, error: 'Failed to export audit logs' })
  }
})

// GET /api/export/all
router.get('/all', authMiddleware, hotelIsolation, requirePermission(PermissionResource.EXPORT, PermissionAction.READ), async (req, res) => {
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
    logError('Export all error', error)
    res.status(500).json({ success: false, error: 'Failed to export all data' })
  }
})

export default router



