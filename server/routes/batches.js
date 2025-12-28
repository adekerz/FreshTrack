/**
 * FreshTrack Batches API - PostgreSQL Async Version
 * Phase 6: Uses UnifiedFilterService for consistent filtering
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchStats,
  getProductById,
  getProductByName,
  createProduct,
  createWriteOff,
  logAudit,
  createAuditSnapshot
} from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  getUserContext,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'
import {
  enrichBatchesWithExpiryData,
  enrichBatchWithExpiryData,
  calculateBatchStats
} from '../services/ExpiryService.js'
import { UnifiedFilterService, PaginationDefaults } from '../services/FilterService.js'

const router = express.Router()

// GET /api/batches - Phase 6: Unified filtering with pagination
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.READ), async (req, res) => {
  try {
    // Phase 6: Parse filters using UnifiedFilterService
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    
    // Determine department access
    const deptId = req.canAccessAllDepartments 
      ? (filters.departmentIds?.[0] || null) 
      : req.departmentId
    
    // Get DB status filter (not virtual expiry status)
    const { dbStatuses } = UnifiedFilterService.separateStatusFilters(filters.status)
    const statusFilter = dbStatuses.length ? dbStatuses[0] : null
    
    const rawBatches = await getAllBatches(req.hotelId, deptId, statusFilter)
    
    // Enrich batches with expiry data (Single Source of Truth)
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId,
      locale: filters.locale || req.user?.locale || 'ru'
    })
    
    // Phase 6: Apply post-query filters (virtual status, search)
    batches = UnifiedFilterService.applyPostQueryFilters(batches, filters, {
      searchFields: ['product_name', 'batch_code', 'supplier']
    })
    
    // Phase 6: Create paginated response
    const total = batches.length
    const paginatedBatches = batches.slice(filters.offset, filters.offset + filters.limit)
    
    res.json({ 
      success: true, 
      ...UnifiedFilterService.createPaginatedResponse(paginatedBatches, total, filters),
      batches: paginatedBatches // Backward compatibility
    })
  } catch (error) {
    logError('Get batches error', error)
    res.status(500).json({ success: false, error: 'Failed to get batches' })
  }
})

// GET /api/batches/stats - MUST be before /:id
router.get('/stats', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id } = req.query
    // Use department from isolation middleware if user can't access all departments
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    
    // Get raw batches and calculate stats using ExpiryService
    const rawBatches = await getAllBatches(req.hotelId, deptId, null)
    const stats = await calculateBatchStats(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId
    })
    
    res.json({ success: true, stats })
  } catch (error) {
    logError('Get batch stats error', error)
    res.status(500).json({ success: false, error: 'Failed to get batch stats' })
  }
})

// GET /api/batches/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.READ), async (req, res) => {
  try {
    const { locale } = req.query
    const rawBatch = await getBatchById(req.params.id)
    if (!rawBatch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(rawBatch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access for non-admin users
    if (!req.canAccessAllDepartments && rawBatch.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    // Enrich with expiry data
    const batch = await enrichBatchWithExpiryData(rawBatch, {
      hotelId: req.hotelId,
      locale: locale || req.user?.locale || 'ru'
    })
    
    res.json({ success: true, batch })
  } catch (error) {
    logError('Get batch error', error)
    res.status(500).json({ success: false, error: 'Failed to get batch' })
  }
})

// POST /api/batches
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.CREATE), async (req, res) => {
  try {
    const { 
      product_id, productName, department, category,
      quantity, expiry_date, expiryDate,
      supplier, notes, batch_code 
    } = req.body
    
    // Validate hotel_id is available
    if (!req.hotelId) {
      logError('Create batch error: No hotel_id in request', { user: req.user?.id })
      return res.status(400).json({ success: false, error: 'Hotel ID is required' })
    }
    
    // Validate department_id - use from request or user's department
    const departmentId = department || req.departmentId
    if (!departmentId) {
      return res.status(400).json({ success: false, error: 'Department ID is required' })
    }
    
    // Non-admin users can only create batches in their own department
    if (!req.canAccessAllDepartments && departmentId !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create batch in other department' })
    }
    
    let productId = product_id
    let product = null
    
    // Если передано имя продукта вместо ID - найти или создать продукт
    if (!productId && productName) {
      product = await getProductByName(productName, req.hotelId)
      
      if (!product) {
        // Создать новый продукт
        product = await createProduct({
          name: productName,
          hotel_id: req.hotelId,
          department_id: department || null,
          category_id: category || 'other',
          unit: 'шт'
        })
      }
      productId = product.id
    } else if (productId) {
      product = await getProductById(productId)
    }
    
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID or product name is required' })
    }
    
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Product access denied' })
    }
    
    // Поддержка обоих форматов дат
    const expDate = expiry_date || expiryDate || null
    
    // Use the departmentId validated earlier
    const batch = await createBatch({
      hotel_id: req.hotelId,
      department_id: departmentId,
      product_id: productId, 
      quantity: quantity === null || quantity === undefined ? null : parseFloat(quantity),
      expiry_date: expDate,
      added_by: req.user.id
    })
    
    // Enrich batch with expiry data before returning
    const enrichedBatch = await enrichBatchWithExpiryData(batch, {
      hotelId: req.hotelId,
      departmentId: departmentId
    })
    
    // Log audit with snapshot_after (create has no before state)
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'batch', entity_id: batch.id,
      details: { product_id: productId, product_name: product.name, quantity },
      ip_address: req.ip,
      snapshot_before: null,
      snapshot_after: createAuditSnapshot(enrichedBatch, 'batch')
    })
    
    // Вернуть данные в формате, ожидаемом фронтендом
    res.status(201).json({ 
      success: true, 
      batch: enrichedBatch,
      // Дополнительные поля для совместимости
      id: batch.id,
      productId: productId,
      productName: product.name,
      departmentId: department || product.department_id,
      expiryDate: expDate,
      quantity: batch.quantity
    })
  } catch (error) {
    logError('Create batch error', error)
    res.status(500).json({ success: false, error: 'Failed to create batch' })
  }
})

// PUT /api/batches/:id
router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE), async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && batch.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    // Create snapshot BEFORE update
    const snapshotBefore = createAuditSnapshot(batch, 'batch')
    
    const { quantity, production_date, expiry_date, supplier, notes, status, batch_code } = req.body
    const updates = {}
    if (quantity !== undefined) updates.quantity = parseFloat(quantity)
    if (production_date !== undefined) updates.production_date = production_date
    if (expiry_date !== undefined) updates.expiry_date = expiry_date
    if (supplier !== undefined) updates.supplier = supplier
    if (notes !== undefined) updates.notes = notes
    if (status !== undefined) updates.status = status
    if (batch_code !== undefined) updates.batch_code = batch_code
    
    const success = await updateBatch(req.params.id, updates)
    if (success) {
      // Get updated batch for snapshot AFTER
      const updatedBatch = await getBatchById(req.params.id)
      const enrichedBatch = await enrichBatchWithExpiryData(updatedBatch, { hotelId: req.hotelId })
      const snapshotAfter = createAuditSnapshot(enrichedBatch, 'batch')
      
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'batch', entity_id: req.params.id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip,
        snapshot_before: snapshotBefore,
        snapshot_after: snapshotAfter
      })
      
      res.json({ success: true, batch: enrichedBatch })
    } else {
      res.json({ success: false })
    }
  } catch (error) {
    logError('Update batch error', error)
    res.status(500).json({ success: false, error: 'Failed to update batch' })
  }
})

// DELETE /api/batches/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.DELETE), async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && batch.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    // Create snapshot BEFORE delete (preserves entity state even after deletion)
    const snapshotBefore = createAuditSnapshot({
      ...batch,
      product_name: product.name,
      product_barcode: product.barcode
    }, 'batch')
    
    const success = await deleteBatch(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'batch', entity_id: req.params.id,
        details: { product_name: product.name },
        ip_address: req.ip,
        snapshot_before: snapshotBefore,
        snapshot_after: null  // Entity no longer exists
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete batch error', error)
    res.status(500).json({ success: false, error: 'Failed to delete batch' })
  }
})

// POST /api/batches/:id/collect - Сбор/списание партии
router.post('/:id/collect', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.INVENTORY, PermissionAction.COLLECT), async (req, res) => {
  try {
    const { reason, comment } = req.body
    
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    // Check department access
    if (!req.canAccessAllDepartments && batch.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    // Enrich batch with expiry data for snapshot (Single Source of Truth)
    const enrichedBatch = await enrichBatchWithExpiryData(batch, {
      hotelId: req.hotelId,
      departmentId: batch.department_id,
      locale: req.user?.locale || 'ru'
    })
    
    // Create batch snapshot for historical consistency
    const batchSnapshot = {
      id: batch.id,
      product_id: product.id,
      product_name: product.name,
      category_name: batch.category_name || product.category_name,
      department_id: batch.department_id,
      department_name: batch.department_name,
      quantity: batch.quantity,
      expiry_date: batch.expiry_date,
      batch_number: batch.batch_number,
      // Enriched expiry data at collection time
      daysLeft: enrichedBatch.daysLeft,
      expiryStatus: enrichedBatch.expiryStatus,
      statusColor: enrichedBatch.statusColor,
      statusText: enrichedBatch.statusText,
      isExpired: enrichedBatch.isExpired,
      isUrgent: enrichedBatch.isUrgent,
      // Metadata
      snapshot_at: new Date().toISOString(),
      collected_reason: reason || 'manual'
    }
    
    // Создать запись о списании с batch snapshot
    const writeOff = await createWriteOff({
      hotel_id: req.hotelId,
      department_id: batch.department_id || product.department_id || req.departmentId,
      batch_id: batch.id,
      product_id: product.id,
      product_name: product.name,
      quantity: batch.quantity,
      reason: reason || 'manual',
      comment: comment || null,
      user_id: req.user.id,
      // New snapshot fields
      batch_snapshot: batchSnapshot,
      expiry_date: batch.expiry_date,
      expiry_status: enrichedBatch.expiryStatus
    })
    
    // Обновить статус партии на "collected"
    await updateBatch(req.params.id, { 
      quantity: 0,
      status: 'collected'
    })
    
    // Удалить партию после сбора
    await deleteBatch(req.params.id)
    
    await logAudit({
      hotel_id: req.hotelId, 
      user_id: req.user.id, 
      user_name: req.user.name,
      action: 'collect', 
      entity_type: 'batch', 
      entity_id: req.params.id,
      details: { 
        product_name: product.name, 
        quantity: batch.quantity,
        reason: reason || 'manual',
        comment: comment || null
      }, 
      ip_address: req.ip
    })
    
    res.json({ 
      success: true, 
      message: 'Batch collected successfully',
      write_off: writeOff 
    })
  } catch (error) {
    logError('Collect batch error', error)
    res.status(500).json({ success: false, error: 'Failed to collect batch' })
  }
})

export default router




