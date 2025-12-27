/**
 * FreshTrack Categories API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/categories
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, include_inactive } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      include_inactive: include_inactive === 'true'
    }
    const categories = await getAllCategories(req.hotelId, filters)
    res.json({ success: true, categories })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ success: false, error: 'Failed to get categories' })
  }
})

// GET /api/categories/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    if (category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, category })
  } catch (error) {
    console.error('Get category error:', error)
    res.status(500).json({ success: false, error: 'Failed to get category' })
  }
})

// POST /api/categories
router.post('/', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { name, description, color, icon, department_id, parent_id, sort_order } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' })
    }
    
    const category = await createCategory({
      hotel_id: req.hotelId,
      name, description, color, icon,
      department_id: department_id || req.departmentId,
      parent_id, sort_order
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'category', entity_id: category.id,
      details: { name }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, category })
  } catch (error) {
    console.error('Create category error:', error)
    res.status(500).json({ success: false, error: 'Failed to create category' })
  }
})

// PUT /api/categories/:id
router.put('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    if (category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { name, description, color, icon, department_id, parent_id, sort_order, is_active } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (color !== undefined) updates.color = color
    if (icon !== undefined) updates.icon = icon
    if (department_id !== undefined) updates.department_id = department_id
    if (parent_id !== undefined) updates.parent_id = parent_id
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (is_active !== undefined) updates.is_active = is_active
    
    const success = await updateCategory(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'category', entity_id: req.params.id,
        details: { name: category.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({ success: false, error: 'Failed to update category' })
  }
})

// DELETE /api/categories/:id
router.delete('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    if (category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteCategory(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'category', entity_id: req.params.id,
        details: { name: category.name }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete category' })
  }
})

export default router
