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
  getProductById,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// GET /api/batches
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, category_id, status, search, sort_by, sort_order, product_id } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      category_id, status, search, sort_by, sort_order, product_id
    }
    const batches = await getAllBatches(req.hotelId, filters)
    res.json({ success: true, batches })
  } catch (error) {
    console.error('Get batches error:', error)
    res.status(500).json({ success: false, error: 'Failed to get batches' })
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
    const { product_id, quantity, production_date, expiry_date, supplier, notes, batch_code } = req.body
    if (!product_id || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'Product ID and quantity are required' })
    }
    
    const product = await getProductById(product_id)
    if (!product || product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Product access denied' })
    }
    
    const batch = await createBatch({
      product_id, quantity: parseFloat(quantity),
      production_date: production_date || null,
      expiry_date: expiry_date || null,
      supplier: supplier || null,
      notes: notes || null,
      batch_code: batch_code || null
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'batch', entity_id: batch.id,
      details: { product_id, product_name: product.name, quantity }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, batch })
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

export default router
