/**
 * FreshTrack Departments API
 * Department management with hotel isolation
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
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/departments - Get all departments with hotel isolation
 */
router.get('/', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const departments = getAllDepartments(req.hotelId)
    
    res.json(departments.map(d => ({
      id: d.id,
      name: d.name,
      nameEn: d.name_en,
      nameKk: d.name_kk,
      type: d.type,
      color: d.color,
      icon: d.icon,
      hotelId: d.hotel_id,
      isActive: Boolean(d.is_active),
      createdAt: d.created_at
    })))
  } catch (error) {
    console.error('Error fetching departments:', error)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

/**
 * GET /api/departments/:id - Get department by ID
 */
router.get('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const department = getDepartmentById(id)
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Check hotel access
    if (req.hotelId && department.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this department' })
    }
    
    res.json({
      id: department.id,
      name: department.name,
      nameEn: department.name_en,
      nameKk: department.name_kk,
      type: department.type,
      color: department.color,
      icon: department.icon,
      hotelId: department.hotel_id,
      isActive: Boolean(department.is_active),
      createdAt: department.created_at
    })
  } catch (error) {
    console.error('Error fetching department:', error)
    res.status(500).json({ error: 'Failed to fetch department' })
  }
})

/**
 * POST /api/departments - Create department
 * HOTEL_ADMIN or higher
 */
router.post('/', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { name, nameEn, nameKk, type, color, icon } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }
    
    if (!req.hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required' })
    }
    
    const department = createDepartment({
      hotel_id: req.hotelId,
      name,
      name_en: nameEn || name,
      name_kk: nameKk || name,
      type: type || 'other',
      color: color || '#FF8D6B',
      icon: icon || 'package'
    })
    
    // Log action
    logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'department',
      entity_id: department.id,
      details: { name },
      ip_address: req.ip
    })
    
    res.status(201).json({ 
      success: true, 
      department: {
        id: department.id,
        name: department.name,
        nameEn: department.name_en,
        nameKk: department.name_kk,
        type: department.type,
        color: department.color,
        icon: department.icon,
        hotelId: department.hotel_id
      }
    })
  } catch (error) {
    console.error('Error creating department:', error)
    res.status(500).json({ error: 'Failed to create department' })
  }
})

/**
 * PUT /api/departments/:id - Update department
 * HOTEL_ADMIN or higher
 */
router.put('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const { name, nameEn, nameKk, type, color, icon, isActive } = req.body
    
    const department = getDepartmentById(id)
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Check hotel access
    if (req.hotelId && department.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this department' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (nameEn !== undefined) updates.name_en = nameEn
    if (nameKk !== undefined) updates.name_kk = nameKk
    if (type !== undefined) updates.type = type
    if (color !== undefined) updates.color = color
    if (icon !== undefined) updates.icon = icon
    if (isActive !== undefined) updates.is_active = isActive ? 1 : 0
    
    const success = updateDepartment(id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: department.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'department',
        entity_id: id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error updating department:', error)
    res.status(500).json({ error: 'Failed to update department' })
  }
})

/**
 * DELETE /api/departments/:id - Delete (deactivate) department
 * HOTEL_ADMIN or higher
 */
router.delete('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    
    const department = getDepartmentById(id)
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Check hotel access
    if (req.hotelId && department.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this department' })
    }
    
    const success = deleteDepartment(id)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: department.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'delete',
        entity_type: 'department',
        entity_id: id,
        details: { name: department.name },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error deleting department:', error)
    res.status(500).json({ error: 'Failed to delete department' })
  }
})

export default router
