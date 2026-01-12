/**
 * Departments Controller
 * 
 * HTTP handlers для управления департаментами.
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import { query as dbQuery } from '../../db/postgres.js'
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  logAudit
} from '../../db/database.js'
import {
  authMiddleware,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { CreateDepartmentSchema, UpdateDepartmentSchema, validate } from './departments.schemas.js'

const router = Router()

/**
 * GET /api/departments
 */
router.get('/', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.READ), async (req, res) => {
  try {
    let departments

    // Support query parameters: hotel_id or hotelId
    const queryHotelId = req.query.hotel_id || req.query.hotelId

    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can filter by hotel_id or get all
      departments = await getAllDepartments(queryHotelId || null)
    } else if (req.user.hotel_id) {
      // Regular users only see their hotel's departments
      departments = await getAllDepartments(req.user.hotel_id)
    } else {
      departments = []
    }
    res.json({ success: true, departments })
  } catch (error) {
    logError('Get departments error', error)
    res.status(500).json({ success: false, error: 'Failed to get departments' })
  }
})

/**
 * GET /api/departments/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== department.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, department })
  } catch (error) {
    logError('Get department error', error)
    res.status(500).json({ success: false, error: 'Failed to get department' })
  }
})

/**
 * POST /api/departments
 */
router.post('/', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.CREATE), async (req, res) => {
  try {
    const validation = validate(CreateDepartmentSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }

    const { name, description, settings } = validation.data

    // hotel_id: из header X-Hotel-Id, query, body, или из пользователя
    const hotel_id = req.headers['x-hotel-id'] ||
      req.query.hotel_id ||
      validation.data.hotel_id ||
      req.user.hotel_id

    if (!hotel_id) {
      return res.status(400).json({ success: false, error: 'hotel_id is required' })
    }

    // Генерируем уникальный код департамента
    const code = await generateDepartmentCode(hotel_id)

    const department = await createDepartment({
      name, description, settings, hotel_id, code
    })

    await logAudit({
      hotel_id, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'department', entity_id: department.id,
      details: { name, code }, ip_address: req.ip
    })

    res.status(201).json({ success: true, department })
  } catch (error) {
    logError('Create department error', error)
    res.status(500).json({ success: false, error: 'Failed to create department' })
  }
})

/**
 * PUT /api/departments/:id
 */
router.put('/:id', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.UPDATE, {
  getTargetHotelId: async (req) => {
    const dept = await getDepartmentById(req.params.id)
    return dept?.hotel_id
  }
}), async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== department.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const validation = validate(UpdateDepartmentSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }

    const { name, description, settings, is_active } = validation.data
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (settings !== undefined) updates.settings = settings
    if (is_active !== undefined) updates.is_active = is_active

    const success = await updateDepartment(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: department.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'department', entity_id: req.params.id,
        details: { name: department.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Update department error', error)
    res.status(500).json({ success: false, error: 'Failed to update department' })
  }
})

/**
 * DELETE /api/departments/:id
 */
router.delete('/:id', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.DELETE), async (req, res) => {
  try {
    const department = await getDepartmentById(req.params.id)
    if (!department) {
      return res.status(404).json({ success: false, error: 'Department not found' })
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== department.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const success = await deleteDepartment(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: department.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'department', entity_id: req.params.id,
        details: { name: department.name, code: department.code }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete department error', error)
    res.status(500).json({ success: false, error: 'Failed to delete department' })
  }
})

/**
 * Генерирует уникальный код департамента
 */
async function generateDepartmentCode(hotelId) {
  const result = await dbQuery(`
    SELECT COUNT(*)::int as count FROM departments WHERE hotel_id = $1
  `, [hotelId])
  const count = result.rows[0]?.count || 0
  return `DEPT-${String(count + 1).padStart(3, '0')}`
}

export default router
