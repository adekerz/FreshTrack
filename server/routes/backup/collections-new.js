/**
 * FreshTrack Collections API - PostgreSQL Async Version
 * (For product collections/groups management)
 */

import express from 'express'
import {
  getAllCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionProducts,
  addProductToCollection,
  removeProductFromCollection,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/collections
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, include_products } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      include_products: include_products === 'true'
    }
    const collections = await getAllCollections(req.hotelId, filters)
    res.json({ success: true, collections })
  } catch (error) {
    console.error('Get collections error:', error)
    res.status(500).json({ success: false, error: 'Failed to get collections' })
  }
})

// GET /api/collections/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const products = await getCollectionProducts(req.params.id)
    res.json({ success: true, collection: { ...collection, products } })
  } catch (error) {
    console.error('Get collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to get collection' })
  }
})

// POST /api/collections
router.post('/', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { name, description, department_id, product_ids } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Collection name is required' })
    }
    
    const collection = await createCollection({
      hotel_id: req.hotelId,
      name, description,
      department_id: department_id || req.departmentId
    })
    
    // Add products if provided
    if (product_ids && Array.isArray(product_ids)) {
      for (const productId of product_ids) {
        await addProductToCollection(collection.id, productId)
      }
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'collection', entity_id: collection.id,
      details: { name, products_count: product_ids?.length || 0 }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, collection })
  } catch (error) {
    console.error('Create collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to create collection' })
  }
})

// PUT /api/collections/:id
router.put('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { name, description, department_id, is_active } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (department_id !== undefined) updates.department_id = department_id
    if (is_active !== undefined) updates.is_active = is_active
    
    const success = await updateCollection(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'collection', entity_id: req.params.id,
        details: { name: collection.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to update collection' })
  }
})

// POST /api/collections/:id/products
router.post('/:id/products', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { product_id } = req.body
    if (!product_id) {
      return res.status(400).json({ success: false, error: 'Product ID is required' })
    }
    
    const success = await addProductToCollection(req.params.id, product_id)
    res.json({ success })
  } catch (error) {
    console.error('Add product to collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to add product to collection' })
  }
})

// DELETE /api/collections/:id/products/:productId
router.delete('/:id/products/:productId', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await removeProductFromCollection(req.params.id, req.params.productId)
    res.json({ success })
  } catch (error) {
    console.error('Remove product from collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to remove product from collection' })
  }
})

// DELETE /api/collections/:id
router.delete('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteCollection(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'collection', entity_id: req.params.id,
        details: { name: collection.name }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Delete collection error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete collection' })
  }
})

export default router
