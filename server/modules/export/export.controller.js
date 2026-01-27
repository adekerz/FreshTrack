/**
 * Export Controller
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import {
  getAllProducts,
  getAllBatches,
  getAllCategories,
  getAllDepartments,
  getAllWriteOffs,
  getAuditLogs,
  logAudit,
  query
} from '../../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { rateLimitExportWithAlert } from '../../middleware/rateLimiter.js'
import { requireAllowlistedIP } from '../../middleware/ipAllowlist.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { ExportService } from '../../services/ExportService.js'

const router = Router()

router.get('/products', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
    try {
      const { format = 'json' } = req.query
      const products = await getAllProducts(req.hotelId)
      
      // Check export size limit
      if (products.length > ExportService.MAX_EXPORT_ROWS) {
        return res.status(400).json({
          success: false,
          error: 'EXPORT_TOO_LARGE',
          message: `Dataset has ${products.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
          suggestion: 'Apply date filters or contact support for bulk export.',
          totalRows: products.length,
          maxRows: ExportService.MAX_EXPORT_ROWS
        })
      }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, products, 'products', format, {
      filename: 'products',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export products error', error)
    res.status(500).json({ success: false, error: 'Failed to export products' })
  }
})

router.get('/batches', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
    try {
      const { department_id, product_id, status, format = 'json' } = req.query
      const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
      const batches = await getAllBatches(req.hotelId, deptId, status)
      
      // Check export size limit
      if (batches.length > ExportService.MAX_EXPORT_ROWS) {
        return res.status(400).json({
          success: false,
          error: 'EXPORT_TOO_LARGE',
          message: `Dataset has ${batches.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
          suggestion: 'Apply date filters or contact support for bulk export.',
          totalRows: batches.length,
          maxRows: ExportService.MAX_EXPORT_ROWS
        })
      }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, batches, 'batches', format, {
      filename: 'batches',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export batches error', error)
    res.status(500).json({ success: false, error: 'Failed to export batches' })
  }
})

router.get('/categories', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
    try {
      const categories = await getAllCategories(req.hotelId)
      
      // Check export size limit
      if (categories.length > ExportService.MAX_EXPORT_ROWS) {
        return res.status(400).json({
          success: false,
          error: 'EXPORT_TOO_LARGE',
          message: `Dataset has ${categories.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
          suggestion: 'Apply filters or contact support for bulk export.',
          totalRows: categories.length,
          maxRows: ExportService.MAX_EXPORT_ROWS
        })
      }
      
      // Use ExportService for consistent audit logging
      await ExportService.sendExport(res, categories, 'categories', 'json', {
        filename: 'categories',
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        filters: req.query
      })
    } catch (error) {
      logError('Export categories error', error)
      res.status(500).json({ success: false, error: 'Failed to export categories' })
    }
  }
)

router.get('/departments', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
    try {
      const departments = await getAllDepartments(req.hotelId)
      
      // Check export size limit
      if (departments.length > ExportService.MAX_EXPORT_ROWS) {
        return res.status(400).json({
          success: false,
          error: 'EXPORT_TOO_LARGE',
          message: `Dataset has ${departments.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
          suggestion: 'Apply filters or contact support for bulk export.',
          totalRows: departments.length,
          maxRows: ExportService.MAX_EXPORT_ROWS
        })
      }
      
      // Use ExportService for consistent audit logging
      await ExportService.sendExport(res, departments, 'departments', 'json', {
        filename: 'departments',
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        filters: req.query
      })
    } catch (error) {
      logError('Export departments error', error)
      res.status(500).json({ success: false, error: 'Failed to export departments' })
    }
  }
)

router.get('/write-offs', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
  try {
    const { department_id, start_date, end_date, format = 'json' } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { department_id: deptId, start_date, end_date }
    
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    
    // Check export size limit
    if (writeOffs.length > ExportService.MAX_EXPORT_ROWS) {
      return res.status(400).json({
        success: false,
        error: 'EXPORT_TOO_LARGE',
        message: `Dataset has ${writeOffs.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
        suggestion: 'Apply date filters or contact support for bulk export.',
        totalRows: writeOffs.length,
        maxRows: ExportService.MAX_EXPORT_ROWS
      })
    }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, writeOffs, 'writeOffs', format, {
      filename: 'write_offs',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export write-offs error', error)
    res.status(500).json({ success: false, error: 'Failed to export write-offs' })
  }
})

router.get('/inventory', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
  try {
    const { department_id, format = 'json' } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    
    const [products, batches] = await Promise.all([
      getAllProducts(req.hotelId),
      getAllBatches(req.hotelId, deptId, null)
    ])
    
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
    
    // Check export size limit
    if (inventory.length > ExportService.MAX_EXPORT_ROWS) {
      return res.status(400).json({
        success: false,
        error: 'EXPORT_TOO_LARGE',
        message: `Dataset has ${inventory.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
        suggestion: 'Apply date filters or contact support for bulk export.',
        totalRows: inventory.length,
        maxRows: ExportService.MAX_EXPORT_ROWS
      })
    }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, inventory, 'inventory', format, {
      filename: 'inventory',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export inventory error', error)
    res.status(500).json({ success: false, error: 'Failed to export inventory' })
  }
})

router.get('/collections', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
  try {
    const { department_id, start_date, end_date, format = 'json' } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    
    let queryText = `
      SELECT ch.*, u.name as collected_by_name
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
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, collections, 'collections', format, {
      filename: 'collections',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export collections error', error)
    res.status(500).json({ success: false, error: 'Failed to export collections' })
  }
})

router.get('/audit', 
  authMiddleware, 
  hotelIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
  try {
    const { start_date, end_date, limit = 1000 } = req.query
    const filters = { start_date, end_date, limit: parseInt(limit) }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    
    // Check export size limit
    if (logs.length > ExportService.MAX_EXPORT_ROWS) {
      return res.status(400).json({
        success: false,
        error: 'EXPORT_TOO_LARGE',
        message: `Dataset has ${logs.length} rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
        suggestion: 'Apply date filters or contact support for bulk export.',
        totalRows: logs.length,
        maxRows: ExportService.MAX_EXPORT_ROWS
      })
    }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, logs, 'auditLogs', 'json', {
      filename: 'audit_logs',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export audit logs error', error)
    res.status(500).json({ success: false, error: 'Failed to export audit logs' })
  }
})

router.get('/all', 
  authMiddleware, 
  hotelIsolation, 
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,
  requireAllowlistedIP,
  async (req, res) => {
  try {
    const [products, batches, categories, departments, writeOffs] = await Promise.all([
      getAllProducts(req.hotelId, {}),
      getAllBatches(req.hotelId, {}),
      getAllCategories(req.hotelId, {}),
      getAllDepartments(req.hotelId, {}),
      getAllWriteOffs(req.hotelId, {})
    ])
    
    // Check total export size
    const totalRows = products.length + batches.length + categories.length + departments.length + writeOffs.length
    if (totalRows > ExportService.MAX_EXPORT_ROWS) {
      return res.status(400).json({
        success: false,
        error: 'EXPORT_TOO_LARGE',
        message: `Dataset has ${totalRows} total rows. Maximum: ${ExportService.MAX_EXPORT_ROWS}.`,
        suggestion: 'Export entities separately with filters or contact support for bulk export.',
        totalRows,
        maxRows: ExportService.MAX_EXPORT_ROWS,
        breakdown: {
          products: products.length,
          batches: batches.length,
          categories: categories.length,
          departments: departments.length,
          writeOffs: writeOffs.length
        }
      })
    }
    
    // Combine all data for export
    const allData = {
      products,
      batches,
      categories,
      departments,
      write_offs: writeOffs,
      exported_at: new Date().toISOString()
    }
    
    // Use ExportService for consistent audit logging
    await ExportService.sendExport(res, [allData], 'all', format, {
      filename: 'all_data',
      user: req.user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      filters: req.query
    })
  } catch (error) {
    logError('Export all error', error)
    res.status(500).json({ success: false, error: 'Failed to export all data' })
  }
})

export default router
