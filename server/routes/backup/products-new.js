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
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/products
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, category_id, status, search, sort_by, sort_order, low_stock } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      category_id, status, search, sort_by, sort_order, low_stock: low_stock === 'true'
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    console.error('Get products error:', error)
    res.status(500).json({ success: false, error: 'Failed to get products' })
  }
})

// GET /api/products/expiring
router.get('/expiring', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { days = 7, department_id } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      expiring_days: parseInt(days)
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    console.error('Get expiring products error:', error)
    res.status(500).json({ success: false, error: 'Failed to get expiring products' })
  }
})

// GET /api/products/low-stock
router.get('/low-stock', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      low_stock: true
    }
    const products = await getAllProducts(req.hotelId, filters)
    res.json({ success: true, products })
  } catch (error) {
    console.error('Get low stock products error:', error)
    res.status(500).json({ success: false, error: 'Failed to get low stock products' })
  }
})

// GET /api/products/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    // Get product batches
    const batches = await getAllBatches(req.hotelId, { product_id: req.params.id })
    res.json({ success: true, product: { ...product, batches } })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ success: false, error: 'Failed to get product' })
  }
})

// POST /api/products
router.post('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const {
      name, description, sku, barcode, category_id, department_id,
      unit, min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes
    } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }
    
    const product = await createProduct({
      hotel_id: req.hotelId,
      name, description, sku, barcode, category_id,
      department_id: department_id || req.departmentId,
      unit: unit || 'шт', min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'product', entity_id: product.id,
      details: { name, sku }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, product })
  } catch (error) {
    console.error('Create product error:', error)
    res.status(500).json({ success: false, error: 'Failed to create product' })
  }
})

// PUT /api/products/:id
router.put('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const product = await getProductById(req.params.id)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }
    if (product.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const {
      name, description, sku, barcode, category_id, department_id,
      unit, min_quantity, max_quantity, reorder_point,
      storage_location, storage_conditions, default_expiry_days, notes, is_active
    } = req.body
    
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
    }
    res.json({ success })
  } catch (error) {
    console.error('Update product error:', error)
    res.status(500).json({ success: false, error: 'Failed to update product' })
  }
})

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
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
    }
    res.json({ success })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete product' })
  }
})

export default router
