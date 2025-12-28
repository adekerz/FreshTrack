/**
 * FreshTrack Products API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllBatches,
  getBatchesByProductForFIFO,
  updateBatch,
  deleteBatch,
  createWriteOff,
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
import { enrichBatchWithExpiryData } from '../services/ExpiryService.js'
import { logError } from '../utils/logger.js'
import { sseManager } from '../services/SSEManager.js'
import { SSE_EVENTS } from '../utils/constants.js'

const router = express.Router()

// GET /api/products
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, category_id, status, search, sort_by, sort_order, low_stock } = req.query
    // Use department from isolation middleware if user can't access all departments
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    const filters = {
      department_id: deptId,
      category_id, status, search, sort_by, sort_order, low_stock: low_stock === 'true'
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to get products' })
  }
})

// GET /api/products/expiring
router.get('/expiring', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ), async (req, res) => {
  try {
    const { days = 7, department_id } = req.query
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    const filters = {
      department_id: deptId,
      expiring_days: parseInt(days)
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to get expiring products' })
  }
})

// GET /api/products/low-stock
router.get('/low-stock', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id } = req.query
    const deptId = req.canAccessAllDepartments 
      ? (department_id || null) 
      : req.departmentId
    const filters = {
      department_id: deptId,
      low_stock: true
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to get low stock products' })
  }
})

// GET /api/products/catalog - Get all products for catalog view
router.get('/catalog', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ), async (req, res) => {
  try {
    // Catalog shows all products for the hotel (admins) or department (staff)
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const products = await getAllProducts(req.hotelId, { department_id: deptId })
    res.json({ success: true, products })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to get product catalog' })
  }
})

// GET /api/products/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ), async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access for products with department_id
    if (!req.canAccessAllDepartments && product.department_id && product.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    // Get product batches (filtered by department for non-admins)
    const deptId = req.canAccessAllDepartments ? null : req.departmentId
    const batches = await getAllBatches(req.hotelId, deptId, null)
    const productBatches = batches.filter(b => b.product_id === req.params.id)
    res.json({ success: true, product: { ...product, batches: productBatches } })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to get product' })
  }
})

// POST /api/products
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.CREATE), async (req, res) => {
  try {
    const {
      name, description, sku, barcode, category_id, department_id,
      unit, min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes
    } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }
    
    // Validate department_id - use from request or user's department
    const productDeptId = department_id || req.departmentId
    
    // Non-admin users can only create products in their own department
    if (!req.canAccessAllDepartments && productDeptId && productDeptId !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create product in other department' })
    }
    
    const product = await createProduct({
      hotel_id: req.hotelId,
      name, description, sku, barcode, category_id,
      department_id: productDeptId,
      unit: unit || 'шт', min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'product', entity_id: product.id,
      details: { name, sku, department_id: productDeptId }, ip_address: req.ip
    })
    
    // SSE: Broadcast product-created to all hotel users
    sseManager.broadcast(req.hotelId, SSE_EVENTS.PRODUCT_CREATED, {
      product,
      user: { id: req.user.id, name: req.user.name },
      timestamp: new Date().toISOString()
    })
    
    // SSE: Trigger stats update
    sseManager.broadcast(req.hotelId, SSE_EVENTS.STATS_UPDATE, {
      reason: 'product_created',
      timestamp: new Date().toISOString()
    })
    
    res.status(201).json({ success: true, product })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to create product' })
  }
})

// PUT /api/products/:id
router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && product.department_id && product.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const {
      name, description, sku, barcode, category_id, department_id,
      unit, min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes, is_active
    } = req.body
    
    // Non-admin users cannot change department_id to another department
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot move product to other department' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (sku !== undefined) updates.sku = sku
    if (barcode !== undefined) updates.barcode = barcode
    if (category_id !== undefined) updates.category_id = category_id
    if (department_id !== undefined) updates.department_id = department_id
    if (unit !== undefined) updates.unit = unit
    if (min_quantity !== undefined) updates.min_quantity = min_quantity
    if (max_quantity !== undefined) updates.max_quantity = max_quantity
    if (reorder_point !== undefined) updates.reorder_point = reorder_point
    if (storage_location !== undefined) updates.storage_location = storage_location
    if (storage_conditions !== undefined) updates.storage_conditions = storage_conditions
    if (default_expiry_days !== undefined) updates.default_expiry_days = default_expiry_days
    if (notes !== undefined) updates.notes = notes
    if (is_active !== undefined) updates.is_active = is_active
    
    const success = await updateProduct(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'product', entity_id: req.params.id,
        details: { name: product.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
      
      // SSE: Broadcast product-updated to all hotel users
      sseManager.broadcast(req.hotelId, SSE_EVENTS.PRODUCT_UPDATED, {
        productId: req.params.id,
        productName: product.name,
        updates: Object.keys(updates),
        user: { id: req.user.id, name: req.user.name },
        timestamp: new Date().toISOString()
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to update product' })
  }
})

/**
 * POST /api/products/:id/collect - FIFO Collection
 * User specifies only quantity, backend automatically collects from oldest batches first
 * 
 * @body {number} quantity - Amount to collect
 * @body {string} reason - Collection reason (expired, damaged, manual, etc.)
 * @body {string} comment - Optional comment
 */
router.post('/:id/collect', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.INVENTORY, PermissionAction.COLLECT), async (req, res) => {
  try {
    const { quantity, reason = 'manual', comment } = req.body
    const productId = req.params.id
    
    // Validate quantity
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity must be a positive number' 
      })
    }
    
    // Get product
    const product = await getProductById(productId)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    // Get batches sorted by FIFO (earliest expiry first)
    const departmentId = req.canAccessAllDepartments ? null : req.departmentId
    const batches = await getBatchesByProductForFIFO(productId, req.hotelId, departmentId)
    
    // Calculate total available
    const totalAvailable = batches.reduce((sum, b) => sum + (b.quantity || 0), 0)
    
    if (totalAvailable === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No available batches for this product' 
      })
    }
    
    if (quantity > totalAvailable) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient quantity. Available: ${totalAvailable}, Requested: ${quantity}` 
      })
    }
    
    // FIFO Collection: Process batches from oldest to newest
    let remaining = quantity
    const collectedBatches = []
    const writeOffs = []
    
    for (const batch of batches) {
      if (remaining <= 0) break
      
      const collectFromBatch = Math.min(batch.quantity, remaining)
      const newQuantity = batch.quantity - collectFromBatch
      
      // Enrich batch with expiry data for snapshot
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
        original_quantity: batch.quantity,
        collected_quantity: collectFromBatch,
        remaining_quantity: newQuantity,
        expiry_date: batch.expiry_date,
        batch_number: batch.batch_number,
        // Enriched expiry data at collection time
        daysLeft: enrichedBatch.daysLeft,
        expiryStatus: enrichedBatch.expiryStatus,
        statusColor: enrichedBatch.statusColor,
        statusText: enrichedBatch.statusText,
        isExpired: enrichedBatch.isExpired,
        isUrgent: enrichedBatch.isUrgent,
        snapshot_at: new Date().toISOString(),
        collected_reason: reason
      }
      
      // Create write-off record
      const writeOff = await createWriteOff({
        hotel_id: req.hotelId,
        department_id: batch.department_id || product.department_id || req.departmentId,
        batch_id: batch.id,
        product_id: product.id,
        product_name: product.name,
        quantity: collectFromBatch,
        reason,
        comment: comment || null,
        user_id: req.user.id,
        batch_snapshot: batchSnapshot,
        expiry_date: batch.expiry_date,
        expiry_status: enrichedBatch.expiryStatus
      })
      
      writeOffs.push(writeOff)
      
      // Update or delete batch based on remaining quantity
      if (newQuantity === 0) {
        // Zero quantity - delete batch (cleanup per spec)
        await deleteBatch(batch.id)
        collectedBatches.push({
          ...batchSnapshot,
          action: 'deleted'
        })
      } else {
        // Partial collection - update quantity
        await updateBatch(batch.id, { quantity: newQuantity })
        collectedBatches.push({
          ...batchSnapshot,
          action: 'partial'
        })
      }
      
      remaining -= collectFromBatch
    }
    
    // Log audit
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'fifo_collect',
      entity_type: 'product',
      entity_id: productId,
      details: {
        product_name: product.name,
        requested_quantity: quantity,
        batches_affected: collectedBatches.length,
        reason,
        comment: comment || null
      },
      ip_address: req.ip
    })
    
    // SSE: Broadcast write-off event
    const eventType = collectedBatches.length > 1 ? SSE_EVENTS.BULK_WRITE_OFF : SSE_EVENTS.WRITE_OFF
    sseManager.broadcast(req.hotelId, eventType, {
      productId,
      productName: product.name,
      quantity,
      reason,
      batchesAffected: collectedBatches.length,
      user: { id: req.user.id, name: req.user.name },
      timestamp: new Date().toISOString()
    })
    
    // SSE: Trigger stats update
    sseManager.broadcast(req.hotelId, SSE_EVENTS.STATS_UPDATE, {
      reason: 'write_off',
      timestamp: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: `Collected ${quantity} units using FIFO from ${collectedBatches.length} batch(es)`,
      collected: {
        quantity,
        batches: collectedBatches,
        write_offs: writeOffs
      }
    })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to collect product' })
  }
})

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, hotelIsolation, requirePermission(PermissionResource.PRODUCTS, PermissionAction.DELETE), async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteProduct(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'product', entity_id: req.params.id,
        details: { name: product.name }, ip_address: req.ip
      })
      
      // SSE: Broadcast product-deleted to all hotel users
      sseManager.broadcast(req.hotelId, SSE_EVENTS.PRODUCT_DELETED, {
        productId: req.params.id,
        productName: product.name,
        user: { id: req.user.id, name: req.user.name },
        timestamp: new Date().toISOString()
      })
      
      // SSE: Trigger stats update
      sseManager.broadcast(req.hotelId, SSE_EVENTS.STATS_UPDATE, {
        reason: 'product_deleted',
        timestamp: new Date().toISOString()
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Products', error)
    res.status(500).json({ success: false, error: 'Failed to delete product' })
  }
})

export default router


