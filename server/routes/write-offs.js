/**
 * FreshTrack Write-offs API - PostgreSQL Async Version
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllWriteOffs,
  getWriteOffById,
  createWriteOff,
  updateWriteOff,
  deleteWriteOff,
  getWriteOffStats,
  getBatchById,
  updateBatch,
  getProductById,
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

// GET /api/write-offs/stats - MUST be before /:id
router.get('/stats', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id } = req.query
    // Use department from isolation middleware if user can't access all departments
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    const stats = await getWriteOffStats(req.hotelId, deptId)
    res.json({ success: true, ...stats })
  } catch (error) {
    logError('Get write-off stats error', error)
    res.status(500).json({ success: false, error: 'Failed to get write-off stats' })
  }
})

// GET /api/write-offs
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, start_date, end_date, reason, product_id, limit, offset } = req.query
    // Use department from isolation middleware if user can't access all departments
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    const filters = {
      department_id: deptId,
      start_date, end_date, reason, product_id,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    }
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    res.json({ success: true, write_offs: writeOffs })
  } catch (error) {
    logError('Get write-offs error', error)
    res.status(500).json({ success: false, error: 'Failed to get write-offs' })
  }
})

// GET /api/write-offs/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.READ), async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && writeOff.department_id && writeOff.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    res.json({ success: true, write_off: writeOff })
  } catch (error) {
    logError('Get write-off error', error)
    res.status(500).json({ success: false, error: 'Failed to get write-off' })
  }
})

// POST /api/write-offs
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { batch_id, product_id, quantity, reason, notes } = req.body
    
    if (!quantity || !reason) {
      return res.status(400).json({ success: false, error: 'Quantity and reason are required' })
    }
    
    let productInfo = null
    let batchInfo = null
    
    if (batch_id) {
      batchInfo = await getBatchById(batch_id)
      if (!batchInfo) {
        return res.status(404).json({ success: false, error: 'Batch not found' })
      }
      productInfo = await getProductById(batchInfo.product_id)
      if (!productInfo || productInfo.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }
      // Check department access for batch
      if (!req.canAccessAllDepartments && batchInfo.department_id !== req.departmentId) {
        return res.status(403).json({ success: false, error: 'Access denied to this department' })
      }
      if (quantity > batchInfo.quantity) {
        return res.status(400).json({ success: false, error: 'Write-off quantity exceeds batch quantity' })
      }
    } else if (product_id) {
      productInfo = await getProductById(product_id)
      if (!productInfo || productInfo.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Product access denied' })
      }
      // Check department access for product
      if (!req.canAccessAllDepartments && productInfo.department_id && productInfo.department_id !== req.departmentId) {
        return res.status(403).json({ success: false, error: 'Access denied to this department' })
      }
    } else {
      return res.status(400).json({ success: false, error: 'Either batch_id or product_id is required' })
    }
    
    // Use department from batch, product, or user's department
    const deptId = batchInfo?.department_id || productInfo?.department_id || req.departmentId
    
    const writeOff = await createWriteOff({
      hotel_id: req.hotelId,
      department_id: deptId,
      batch_id: batch_id || null,
      product_id: productInfo.id,
      product_name: productInfo.name,
      quantity: parseFloat(quantity),
      reason,
      notes: notes || null,
      user_id: req.user.id
    })
    
    // Update batch quantity if write-off from batch
    if (batch_id && batchInfo) {
      const newQuantity = batchInfo.quantity - parseFloat(quantity)
      await updateBatch(batch_id, { 
        quantity: newQuantity,
        status: newQuantity <= 0 ? 'depleted' : batchInfo.status
      })
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'write_off', entity_id: writeOff.id,
      details: { product_name: productInfo.name, quantity, reason }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, write_off: writeOff })
  } catch (error) {
    logError('Create write-off error', error)
    res.status(500).json({ success: false, error: 'Failed to create write-off' })
  }
})

// PUT /api/write-offs/:id
router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // SECURITY: Check department access
    if (!req.canAccessAllDepartments && writeOff.department_id && writeOff.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const { reason, notes } = req.body
    const updates = {}
    if (reason !== undefined) updates.reason = reason
    if (notes !== undefined) updates.notes = notes
    
    const success = await updateWriteOff(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'write_off', entity_id: req.params.id,
        details: { updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Update write-off error', error)
    res.status(500).json({ success: false, error: 'Failed to update write-off' })
  }
})

// DELETE /api/write-offs/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.DELETE), async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // SECURITY: Check department access
    if (!req.canAccessAllDepartments && writeOff.department_id && writeOff.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const success = await deleteWriteOff(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'write_off', entity_id: req.params.id,
        details: { product_id: writeOff.product_id }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete write-off error', error)
    res.status(500).json({ success: false, error: 'Failed to delete write-off' })
  }
})

export default router



