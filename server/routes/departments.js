/**
 * FreshTrack Departments API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  logAudit
} from '../db/database.js'
import { logError } from '../utils/logger.js'
import { 
  authMiddleware, 
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// GET /api/departments
router.get('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.READ), async (req, res) => {
  try {
    const { include_inactive } = req.query
    const filters = { include_inactive: include_inactive === 'true' }
    const departments = await getAllDepartments(req.hotelId, filters)
    res.json({ success: true, departments })
  } catch (error) {
    logError('Departments', error)
    res.status(500).json({ success: false, error: 'Failed to get departments' })
  }
})

// GET /api/departments/:id
router.get('/:id', authMiddleware, hotelIsolation, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.READ), async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }
    if (department.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, department })
  } catch (error) {
    logError('Departments', error)
    res.status(500).json({ success: false, error: 'Failed to get department' })
  }
})

// POST /api/departments
router.post('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { name, description, code, manager_id, settings } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Department name is required' })
    }
    
    const department = await createDepartment({
      hotel_id: req.hotelId,
      name, description, code, manager_id, settings
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'department', entity_id: department.id,
      details: { name }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, department })
  } catch (error) {
    logError('Departments', error)
    res.status(500).json({ success: false, error: 'Failed to create department' })
  }
})

// PUT /api/departments/:id
router.put('/:id', authMiddleware, hotelIsolation, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }
    if (department.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { name, description, code, manager_id, settings, is_active } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (code !== undefined) updates.code = code
    if (manager_id !== undefined) updates.manager_id = manager_id
    if (settings !== undefined) updates.settings = settings
    if (is_active !== undefined) updates.is_active = is_active
    
    const success = await updateDepartment(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'department', entity_id: req.params.id,
        details: { name: department.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Departments', error)
    res.status(500).json({ success: false, error: 'Failed to update department' })
  }
})

// DELETE /api/departments/:id
router.delete('/:id', authMiddleware, hotelIsolation, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.DELETE), async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }
    if (department.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const success = await deleteDepartment(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'department', entity_id: req.params.id,
        details: { name: department.name }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Departments', error)
    res.status(500).json({ success: false, error: 'Failed to delete department' })
  }
})

export default router


