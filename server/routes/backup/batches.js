/**
 * FreshTrack Batches API
 * Batch (inventory item) management with hotel and department isolation
 */

import express from 'express'
import { 
  getAllBatches, 
  getBatchById, 
  createBatch, 
  updateBatch,
  collectBatch,
  getExpiringBatches,
  getExpiredBatches,
  getBatchStats,
  getProductById,
  getProductByName,
  createProduct,
  getCategoryById,
  getDepartmentById,
  logAudit,
  db 
} from '../db/database.js'
import { authMiddleware, hotelIsolation, departmentIsolation } from '../middleware/auth.js'

const router = express.Router()

// Middleware to require hotel context (with auto-selection for SUPER_ADMIN)
const requireHotelContext = (req, res, next) => {
  if (!req.hotelId) {
    if (req.user?.role === 'SUPER_ADMIN') {
      const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
      if (firstHotel) {
        req.hotelId = firstHotel.id
        // Also get first department if needed
        if (!req.departmentId) {
          const firstDept = db.prepare('SELECT id FROM departments WHERE hotel_id = ? AND is_active = 1 LIMIT 1').get(firstHotel.id)
          if (firstDept) {
            req.departmentId = firstDept.id
          }
        }
        return next()
      }
    }
    return res.status(400).json({ error: 'Hotel context required' })
  }
  next()
}

/**
 * GET /api/batches - Get all batches with isolation
 */
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requireHotelContext, (req, res) => {
  try {
    const { status, category } = req.query
    
    // По умолчанию возвращаем только активные партии (не собранные)
    let batches = getAllBatches(req.hotelId, req.departmentId, status || 'active')
    
    // Filter by status
    if (status && status !== 'active') {
      const today = new Date().toISOString().split('T')[0]
      const threeDays = new Date()
      threeDays.setDate(threeDays.getDate() + 3)
      const threeDaysStr = threeDays.toISOString().split('T')[0]
      const sevenDays = new Date()
      sevenDays.setDate(sevenDays.getDate() + 7)
      const sevenDaysStr = sevenDays.toISOString().split('T')[0]
      
      batches = batches.filter(b => {
        if (status === 'expired') return b.expiry_date < today
        if (status === 'critical') return b.expiry_date >= today && b.expiry_date <= threeDaysStr
        if (status === 'warning') return b.expiry_date > threeDaysStr && b.expiry_date <= sevenDaysStr
        if (status === 'good') return b.expiry_date > sevenDaysStr
        return true
      })
    }
    
    // Calculate days left and status for each batch
    const today = new Date()
    const result = batches.map(b => {
      const expiryDate = new Date(b.expiry_date)
      const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
      
      let batchStatus = 'good'
      if (daysLeft < 0) batchStatus = 'expired'
      else if (daysLeft <= 3) batchStatus = 'critical'
      else if (daysLeft <= 7) batchStatus = 'warning'
      
      return {
        id: b.id,
        productId: b.product_id,
        productName: b.product_name,
        barcode: b.barcode,
        categoryName: b.category_name,
        departmentId: b.department_id,
        departmentName: b.department_name,
        quantity: b.quantity,
        expiryDate: b.expiry_date,
        batchNumber: b.batch_number,
        status: b.status === 'active' ? batchStatus : b.status,
        daysLeft,
        addedAt: b.added_at,
        addedBy: b.added_by
      }
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error fetching batches:', error)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
})

/**
 * GET /api/batches/stats - Get batch statistics
 */
router.get('/stats', authMiddleware, hotelIsolation, departmentIsolation, requireHotelContext, (req, res) => {
  try {
    const stats = getBatchStats(req.hotelId, req.departmentId)
    res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

/**
 * GET /api/batches/expiring - Get expiring batches
 */
router.get('/expiring', authMiddleware, hotelIsolation, departmentIsolation, requireHotelContext, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7
    const batches = getExpiringBatches(req.hotelId, days)
    
    // Filter by department if needed
    let result = batches
    if (req.departmentId) {
      result = batches.filter(b => b.department_id === req.departmentId)
    }
    
    res.json(result.map(b => ({
      id: b.id,
      productId: b.product_id,
      productName: b.product_name,
      departmentName: b.department_name,
      quantity: b.quantity,
      expiryDate: b.expiry_date,
      daysLeft: Math.ceil((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    })))
  } catch (error) {
    console.error('Error fetching expiring batches:', error)
    res.status(500).json({ error: 'Failed to fetch expiring batches' })
  }
})

/**
 * GET /api/batches/expired - Get expired batches
 */
router.get('/expired', authMiddleware, hotelIsolation, departmentIsolation, requireHotelContext, (req, res) => {
  try {
    const batches = getExpiredBatches(req.hotelId)
    
    // Filter by department if needed
    let result = batches
    if (req.departmentId) {
      result = batches.filter(b => b.department_id === req.departmentId)
    }
    
    res.json(result.map(b => ({
      id: b.id,
      productId: b.product_id,
      productName: b.product_name,
      departmentName: b.department_name,
      quantity: b.quantity,
      expiryDate: b.expiry_date,
      daysLeft: Math.ceil((new Date(b.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    })))
  } catch (error) {
    console.error('Error fetching expired batches:', error)
    res.status(500).json({ error: 'Failed to fetch expired batches' })
  }
})

/**
 * GET /api/batches/:id - Get batch by ID
 */
router.get('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const batch = getBatchById(id)
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Check hotel access
    if (req.hotelId && batch.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    res.json({
      id: batch.id,
      productId: batch.product_id,
      productName: batch.product_name,
      departmentId: batch.department_id,
      departmentName: batch.department_name,
      quantity: batch.quantity,
      expiryDate: batch.expiry_date,
      batchNumber: batch.batch_number,
      status: batch.status,
      addedAt: batch.added_at,
      addedBy: batch.added_by
    })
  } catch (error) {
    console.error('Error fetching batch:', error)
    res.status(500).json({ error: 'Failed to fetch batch' })
  }
})

/**
 * POST /api/batches - Create batch
 */
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requireHotelContext, (req, res) => {
  try {
    const { productId, productName, departmentId, department, quantity, expiryDate, batchNumber, category } = req.body
    
    if (!productId && !productName) {
      return res.status(400).json({ error: 'Product ID or Product Name is required' })
    }
    
    if (!expiryDate) {
      return res.status(400).json({ error: 'Expiry date is required' })
    }
    
    // Get product - by ID or by name, or create if not exists
    let product = null
    if (productId) {
      product = getProductById(productId)
    } else if (productName) {
      product = getProductByName(productName, req.hotelId)
      
      // Auto-create product if not found
      if (!product) {
        try {
          // Find category ID if category name/id provided
          let categoryId = category || null
          if (category && typeof category === 'string') {
            // Try to find category by id first
            const catRecord = getCategoryById(category)
            if (catRecord) {
              categoryId = catRecord.id
            }
          }
          
          product = createProduct({
            hotel_id: req.hotelId,
            category_id: categoryId,
            name: productName,
            name_en: productName,
            name_kk: productName
          })
          
          console.log(`Auto-created product: ${productName} (ID: ${product.id})`)
        } catch (createErr) {
          console.error('Error auto-creating product:', createErr)
          return res.status(500).json({ error: 'Failed to create product' })
        }
      }
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found and could not be created' })
    }
    
    if (req.hotelId && product.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Product does not belong to your hotel' })
    }
    
    // Determine department ID (support both 'departmentId' and 'department' field names)
    let batchDepartmentId = departmentId || department || req.departmentId
    if (!batchDepartmentId) {
      return res.status(400).json({ error: 'Department ID is required' })
    }
    
    // Verify department belongs to hotel
    const deptRecord = getDepartmentById(batchDepartmentId)
    if (!deptRecord) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    if (req.hotelId && deptRecord.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Department does not belong to your hotel' })
    }
    
    const batch = createBatch({
      hotel_id: req.hotelId || product.hotel_id,
      department_id: batchDepartmentId,
      product_id: product.id,
      quantity: quantity === null ? null : (quantity || 1),
      expiry_date: expiryDate,
      batch_number: batchNumber,
      added_by: req.user.id
    })
    
    // Log action
    logAudit({
      hotel_id: batch.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'batch',
      entity_id: batch.id,
      details: { productId: product.id, productName: product.name, quantity, expiryDate },
      ip_address: req.ip
    })
    
    res.status(201).json({ 
      success: true,
      batch: {
        id: batch.id,
        productId: batch.product_id,
        departmentId: batch.department_id,
        quantity: batch.quantity,
        expiryDate: batch.expiry_date,
        batchNumber: batch.batch_number,
        status: batch.status
      }
    })
  } catch (error) {
    console.error('Error creating batch:', error)
    res.status(500).json({ error: 'Failed to create batch' })
  }
})

/**
 * PUT /api/batches/:id - Update batch
 */
router.put('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const { quantity, expiryDate, batchNumber } = req.body
    
    const batch = getBatchById(id)
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Check hotel access
    if (req.hotelId && batch.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    // Check department access for staff
    if (req.user.role === 'STAFF' && batch.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    const updates = {}
    if (quantity !== undefined) updates.quantity = quantity
    if (expiryDate !== undefined) updates.expiry_date = expiryDate
    if (batchNumber !== undefined) updates.batch_number = batchNumber
    
    const success = updateBatch(id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: batch.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'batch',
        entity_id: id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error updating batch:', error)
    res.status(500).json({ error: 'Failed to update batch' })
  }
})

/**
 * POST /api/batches/:id/collect - Collect (write-off) batch
 */
router.post('/:id/collect', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const { reason, comment } = req.body
    
    const batch = getBatchById(id)
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Check hotel access
    if (req.hotelId && batch.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    // Check department access for staff
    if (req.user.role === 'STAFF' && batch.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    if (batch.status === 'collected') {
      return res.status(400).json({ error: 'Batch already collected' })
    }
    
    const result = collectBatch(id, req.user.id, reason || 'expired', comment)
    
    if (result) {
      // Log action
      logAudit({
        hotel_id: batch.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'collect',
        entity_type: 'batch',
        entity_id: id,
        details: { reason, productName: batch.product_name, quantity: batch.quantity },
        ip_address: req.ip
      })
      
      res.json({ 
        success: true, 
        writeOffId: result.writeOffId,
        message: 'Batch collected successfully' 
      })
    } else {
      res.status(500).json({ error: 'Failed to collect batch' })
    }
  } catch (error) {
    console.error('Error collecting batch:', error)
    res.status(500).json({ error: 'Failed to collect batch' })
  }
})

/**
 * POST /api/batches/collect-multiple - Collect multiple batches
 */
router.post('/collect-multiple', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { batchIds, reason, comment } = req.body
    
    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ error: 'Batch IDs are required' })
    }
    
    const results = []
    const errors = []
    
    for (const batchId of batchIds) {
      try {
        const batch = getBatchById(batchId)
        if (!batch) {
          errors.push({ batchId, error: 'Batch not found' })
          continue
        }
        
        // Check hotel access
        if (req.hotelId && batch.hotel_id !== req.hotelId) {
          errors.push({ batchId, error: 'Access denied' })
          continue
        }
        
        // Check department access for staff
        if (req.user.role === 'STAFF' && batch.department_id !== req.user.department_id) {
          errors.push({ batchId, error: 'Access denied' })
          continue
        }
        
        if (batch.status === 'collected') {
          errors.push({ batchId, error: 'Already collected' })
          continue
        }
        
        const result = collectBatch(batchId, req.user.id, reason || 'expired', comment)
        if (result) {
          results.push({ batchId, writeOffId: result.writeOffId })
          
          // Log action
          logAudit({
            hotel_id: batch.hotel_id,
            user_id: req.user.id,
            user_name: req.user.name,
            action: 'collect',
            entity_type: 'batch',
            entity_id: batchId,
            details: { reason, productName: batch.product_name, quantity: batch.quantity },
            ip_address: req.ip
          })
        } else {
          errors.push({ batchId, error: 'Collection failed' })
        }
      } catch (e) {
        errors.push({ batchId, error: e.message })
      }
    }
    
    res.json({
      success: true,
      collected: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error) {
    console.error('Error collecting batches:', error)
    res.status(500).json({ error: 'Failed to collect batches' })
  }
})

/**
 * DELETE /api/batches/:id - Delete batch (only if not collected)
 */
router.delete('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    
    const batch = getBatchById(id)
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Check hotel access
    if (req.hotelId && batch.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this batch' })
    }
    
    // Only admins can delete batches
    if (!['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admins can delete batches' })
    }
    
    // Cannot delete collected batches (for audit trail)
    if (batch.status === 'collected') {
      return res.status(400).json({ error: 'Cannot delete collected batches' })
    }
    
    const success = updateBatch(id, { status: 'deleted' })
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: batch.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'delete',
        entity_type: 'batch',
        entity_id: id,
        details: { productName: batch.product_name },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error deleting batch:', error)
    res.status(500).json({ error: 'Failed to delete batch' })
  }
})

export default router
