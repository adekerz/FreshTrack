/**
 * Collections Controller
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
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
} from '../../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { CreateCollectionSchema, UpdateCollectionSchema, AddProductSchema, validate } from './collections.schemas.js'

const router = Router()

router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, include_products } = req.query
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = {
      department_id: deptId,
      include_products: include_products === 'true'
    }
    const collections = await getAllCollections(req.hotelId, filters)
    res.json({ success: true, collections })
  } catch (error) {
    logError('Get collections error', error)
    res.status(500).json({ success: false, error: 'Failed to get collections' })
  }
})

router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.READ), async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!req.canAccessAllDepartments && collection.department_id && collection.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const products = await getCollectionProducts(req.params.id)
    res.json({ success: true, collection: { ...collection, products } })
  } catch (error) {
    logError('Get collection error', error)
    res.status(500).json({ success: false, error: 'Failed to get collection' })
  }
})

router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.CREATE), async (req, res) => {
  try {
    const validation = validate(CreateCollectionSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }
    
    const { name, description, department_id, product_ids } = validation.data
    const collectionDeptId = department_id || req.departmentId
    
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create collection for another department' })
    }
    
    const collection = await createCollection({
      hotel_id: req.hotelId,
      name, description,
      department_id: collectionDeptId
    })
    
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
    logError('Create collection error', error)
    res.status(500).json({ success: false, error: 'Failed to create collection' })
  }
})

router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!req.canAccessAllDepartments && collection.department_id && collection.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const validation = validate(UpdateCollectionSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }
    
    const { name, description, department_id, is_active } = validation.data
    
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot move collection to another department' })
    }
    
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
    logError('Update collection error', error)
    res.status(500).json({ success: false, error: 'Failed to update collection' })
  }
})

router.post('/:id/products', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!req.canAccessAllDepartments && collection.department_id && collection.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const validation = validate(AddProductSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }
    
    const success = await addProductToCollection(req.params.id, validation.data.product_id)
    res.json({ success })
  } catch (error) {
    logError('Add product to collection error', error)
    res.status(500).json({ success: false, error: 'Failed to add product to collection' })
  }
})

router.delete('/:id/products/:productId', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!req.canAccessAllDepartments && collection.department_id && collection.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const success = await removeProductFromCollection(req.params.id, req.params.productId)
    res.json({ success })
  } catch (error) {
    logError('Remove product from collection error', error)
    res.status(500).json({ success: false, error: 'Failed to remove product from collection' })
  }
})

router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.COLLECTIONS, PermissionAction.DELETE), async (req, res) => {
  try {
    const collection = await getCollectionById(req.params.id)
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' })
    }
    if (collection.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (!req.canAccessAllDepartments && collection.department_id && collection.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
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
    logError('Delete collection error', error)
    res.status(500).json({ success: false, error: 'Failed to delete collection' })
  }
})

export default router
