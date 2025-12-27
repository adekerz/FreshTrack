/**
 * FreshTrack Write-offs API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllWriteOffs,
  getWriteOffById,
  createWriteOff,
  updateWriteOff,
  deleteWriteOff,
  getBatchById,
  updateBatch,
  getProductById,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/write-offs
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, start_date, end_date, reason, product_id } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      start_date, end_date, reason, product_id
    }
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    res.json({ success: true, write_offs: writeOffs })
  } catch (error) {
    console.error('Get write-offs error:', error)
    res.status(500).json({ success: false, error: 'Failed to get write-offs' })
  }
})

// GET /api/write-offs/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, write_off: writeOff })
  } catch (error) {
    console.error('Get write-off error:', error)
    res.status(500).json({ success: false, error: 'Failed to get write-off' })
  }
})

// POST /api/write-offs
router.post('/', authMiddleware, hotelIsolation, async (req, res) => {
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
      if (quantity > batchInfo.quantity) {
        return res.status(400).json({ success: false, error: 'Write-off quantity exceeds batch quantity' })
      }
    } else if (product_id) {
      productInfo = await getProductById(product_id)
      if (!productInfo || productInfo.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Product access denied' })
      }
    } else {
      return res.status(400).json({ success: false, error: 'Either batch_id or product_id is required' })
    }
    
    const writeOff = await createWriteOff({
      hotel_id: req.hotelId,
      batch_id: batch_id || null,
      product_id: productInfo.id,
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
    console.error('Create write-off error:', error)
    res.status(500).json({ success: false, error: 'Failed to create write-off' })
  }
})

// PUT /api/write-offs/:id
router.put('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
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
    console.error('Update write-off error:', error)
    res.status(500).json({ success: false, error: 'Failed to update write-off' })
  }
})

// DELETE /api/write-offs/:id
router.delete('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const writeOff = await getWriteOffById(req.params.id)
    if (!writeOff) {
      return res.status(404).json({ success: false, error: 'Write-off not found' })
    }
    if (writeOff.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
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
    console.error('Delete write-off error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete write-off' })
  }
})

export default router
