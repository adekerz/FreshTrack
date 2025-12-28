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
import { logError } from '../utils/logger.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// GET /api/categories
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.CATEGORIES, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, include_inactive } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = {
      department_id: deptId,
      include_inactive: include_inactive === 'true'
    }
    const categories = await getAllCategories(req.hotelId, filters)
    res.json({ success: true, categories })
  } catch (error) {
    logError('Categories', error)
    res.status(500).json({ success: false, error: 'Failed to get categories' })
  }
})

// GET /api/categories/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.CATEGORIES, PermissionAction.READ), async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    // Allow access to system categories (hotel_id = NULL) or own hotel categories
    if (category.hotel_id !== null && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && category.department_id && category.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    res.json({ success: true, category })
  } catch (error) {
    logError('Categories', error)
    res.status(500).json({ success: false, error: 'Failed to get category' })
  }
})

// POST /api/categories
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.CATEGORIES, PermissionAction.CREATE), async (req, res) => {
  try {
    const { name, description, color, icon, department_id, parent_id, sort_order } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' })
    }
    
    // Use provided department_id or fall back to user's department
    const categoryDeptId = department_id || req.departmentId
    
    // Non-admin users can only create categories for their department
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create category for another department' })
    }
    
    const category = await createCategory({
      hotel_id: req.hotelId,
      name, description, color, icon,
      department_id: categoryDeptId,
      parent_id, sort_order
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'category', entity_id: category.id,
      details: { name }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, category })
  } catch (error) {
    logError('Categories', error)
    res.status(500).json({ success: false, error: 'Failed to create category' })
  }
})

// PUT /api/categories/:id
router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.CATEGORIES, PermissionAction.UPDATE), async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    // System categories (hotel_id = NULL) can only be edited by SUPER_ADMIN
    if (category.hotel_id === null && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'System categories can only be edited by super admin' })
    }
    // Hotel-specific categories must belong to user's hotel
    if (category.hotel_id !== null && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && category.department_id && category.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const { name, description, color, icon, department_id, parent_id, sort_order, is_active } = req.body
    
    // Non-admin users cannot change department to another department
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot move category to another department' })
    }
    
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
    logError('Categories', error)
    res.status(500).json({ success: false, error: 'Failed to update category' })
  }
})

// DELETE /api/categories/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.CATEGORIES, PermissionAction.DELETE), async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id)
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' })
    }
    // System categories (hotel_id = NULL) can only be deleted by SUPER_ADMIN
    if (category.hotel_id === null && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'System categories can only be deleted by super admin' })
    }
    // Hotel-specific categories must belong to user's hotel
    if (category.hotel_id !== null && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && category.department_id && category.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
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
    logError('Categories', error)
    res.status(500).json({ success: false, error: 'Failed to delete category' })
  }
})

export default router


