/**
 * FreshTrack Batches API - PostgreSQL Async Version
 */

import express from 'express'
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
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// GET /api/batches
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, status } = req.query
    const deptId = department_id || req.departmentId || null
    const batches = await getAllBatches(req.hotelId, deptId, status || null)
    res.json({ success: true, batches })
  } catch (error) {
    console.error('Get batches error:', error)
    res.status(500).json({ success: false, error: 'Failed to get batches' })
  }
})

// GET /api/batches/stats - MUST be before /:id
router.get('/stats', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id } = req.query
    const stats = await getBatchStats(req.hotelId, department_id || null)
    res.json({ success: true, stats })
  } catch (error) {
    console.error('Get batch stats error:', error)
    res.status(500).json({ success: false, error: 'Failed to get batch stats' })
  }
})

// GET /api/batches/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, batch })
  } catch (error) {
    console.error('Get batch error:', error)
    res.status(500).json({ success: false, error: 'Failed to get batch' })
  }
})

// POST /api/batches
router.post('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { 
      product_id, productName, department, category,
      quantity, expiry_date, expiryDate,
      supplier, notes, batch_code 
    } = req.body
    
    // Validate hotel_id is available
    if (!req.hotelId) {
      console.error('Create batch error: No hotel_id in request', { user: req.user?.id })
      return res.status(400).json({ success: false, error: 'Hotel ID is required' })
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
    
    // Определить department_id из продукта или запроса
    const departmentId = department || product.department_id || null
    
    const batch = await createBatch({
      hotel_id: req.hotelId,
      department_id: departmentId,
      product_id: productId, 
      quantity: quantity === null || quantity === undefined ? null : parseFloat(quantity),
      expiry_date: expDate,
      added_by: req.user.id
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'batch', entity_id: batch.id,
      details: { product_id: productId, product_name: product.name, quantity }, ip_address: req.ip
    })
    
    // Вернуть данные в формате, ожидаемом фронтендом
    res.status(201).json({ 
      success: true, 
      batch,
      // Дополнительные поля для совместимости
      id: batch.id,
      productId: productId,
      productName: product.name,
      departmentId: department || product.department_id,
      expiryDate: expDate,
      quantity: batch.quantity
    })
  } catch (error) {
    console.error('Create batch error:', error)
    res.status(500).json({ success: false, error: 'Failed to create batch' })
  }
})

// PUT /api/batches/:id
router.put('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
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
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'batch', entity_id: req.params.id,
        details: { updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update batch error:', error)
    res.status(500).json({ success: false, error: 'Failed to update batch' })
  }
})

// DELETE /api/batches/:id
router.delete('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id)
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' })
    }
    const product = await getProductById(batch.product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteBatch(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'batch', entity_id: req.params.id,
        details: { product_name: product.name }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Delete batch error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete batch' })
  }
})

// POST /api/batches/:id/collect - Сбор/списание партии
router.post('/:id/collect', authMiddleware, hotelIsolation, async (req, res) => {
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
    
    // Создать запись о списании
    const writeOff = await createWriteOff({
      hotel_id: req.hotelId,
      batch_id: batch.id,
      product_id: product.id,
      quantity: batch.quantity,
      reason: reason || 'manual',
      notes: comment || null,
      user_id: req.user.id
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
    console.error('Collect batch error:', error)
    res.status(500).json({ success: false, error: 'Failed to collect batch' })
  }
})

export default router
