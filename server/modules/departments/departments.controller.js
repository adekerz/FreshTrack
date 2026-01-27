/**
 * Departments Controller
 * 
 * HTTP handlers для управления департаментами.
 */

import { Router } from 'express'
import { logError, logInfo, logWarn } from '../../utils/logger.js'
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
import { sendVerificationEmail } from '../../services/EmailService.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import crypto from 'crypto'

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

    const { name, description, settings, email } = validation.data

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

    // Handle empty string as null for description
    const departmentDescription = description === '' ? null : description

    const department = await createDepartment({
      name,
      description: departmentDescription,
      settings,
      hotel_id,
      code,
      email: email && String(email).trim() ? String(email).trim() : null
    })

    await logAudit({
      hotel_id, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'department', entity_id: department.id,
      details: { name, code }, ip_address: req.ip
    })

    res.status(201).json({ success: true, department })
  } catch (error) {
    logError('Create department error', error)
    console.error('[Departments] Create error details:', {
      name,
      description: departmentDescription,
      hotel_id,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create department',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
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

    const { name, description, settings, is_active, email } = validation.data
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) {
      updates.description = description === '' ? null : description
    }
    if (settings !== undefined) updates.settings = settings
    if (is_active !== undefined) updates.is_active = is_active
    if (email !== undefined) {
      updates.email = email === '' || email === null ? null : String(email).trim()
    }

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
    console.error('[Departments] Update error details:', {
      departmentId: req.params.id,
      updates,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update department',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
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

    // Check if department has active batches
    const activeBatchesResult = await dbQuery(
      `SELECT COUNT(*) as count FROM batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.department_id = $1 AND b.status = 'active'`,
      [req.params.id]
    )
    
    const activeBatchesCount = parseInt(activeBatchesResult.rows[0].count)
    if (activeBatchesCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete department with active batches',
        activeBatches: activeBatchesCount
      })
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
    console.error('[Departments] Delete error details:', {
      departmentId: req.params.id,
      error: error.message,
      stack: error.stack
    })
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete department',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
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

// ═══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Rate limiter for verification code sending (3 per hour per department)
const sendCodeLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60 // Block for 1 hour if exceeded
})

// Rate limiter for verification attempts (5 per 15 minutes per department)
const verifyCodeLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 60 * 60 // Block for 1 hour if exceeded
})

/**
 * POST /api/departments/:id/send-verification-code
 * @deprecated Use POST /api/departments/:id/send-confirmation instead
 * Code-based verification was removed in migration 043.
 * Use simplified confirmation flow via /send-confirmation endpoint.
 */
router.post('/:id/send-verification-code', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.UPDATE, {
  getTargetHotelId: async (req) => {
    const dept = await getDepartmentById(req.params.id)
    return dept?.hotel_id
  }
}), async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'DEPRECATED',
    message: 'This endpoint is deprecated. Use POST /api/departments/:id/send-confirmation instead.',
    deprecated: true,
    alternative: '/api/departments/:id/send-confirmation'
  })
})

/**
 * POST /api/departments/:id/verify-email
 * @deprecated Use simplified confirmation flow via /send-confirmation instead
 * Code-based verification was removed in migration 043.
 */
router.post('/:id/verify-email', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.UPDATE, {
  getTargetHotelId: async (req) => {
    const dept = await getDepartmentById(req.params.id)
    return dept?.hotel_id
  }
}), async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'DEPRECATED',
    message: 'This endpoint is deprecated. Use simplified confirmation flow via /send-confirmation instead.',
    deprecated: true,
    alternative: '/api/departments/:id/send-confirmation'
  })
})

/**
 * GET /api/departments/:id/verification-status
 * Get email verification status for department
 */
router.get('/:id/verification-status', authMiddleware, requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.READ, {
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

    res.json({
      success: true,
      verified: department.email_confirmed || false,
      email: department.email,
      email_confirmed: department.email_confirmed || false,
      email_confirmed_at: department.email_confirmed_at ? new Date(department.email_confirmed_at).toISOString() : null
    })
  } catch (error) {
    logError('Get verification status error', error)
    res.status(500).json({ success: false, error: 'Failed to get verification status' })
  }
})

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT EMAIL CONFIRMATION (Simplified)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/departments/:id/send-confirmation
 * Send confirmation email to department (no codes, just confirmation)
 */
router.post('/:id/send-confirmation',
  authMiddleware,
  requirePermission(PermissionResource.DEPARTMENTS, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const { id } = req.params
      const department = await getDepartmentById(id)
      
      if (!department) {
        return res.status(404).json({ success: false, error: 'Department not found' })
      }
      
      if (!department.email) {
        return res.status(400).json({ success: false, error: 'No email configured for this department' })
      }
      
      // Генерация unsubscribe token
      const unsubToken = crypto.randomBytes(32).toString('hex')
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const unsubscribeLink = `${appUrl}/api/departments/${id}/unsubscribe?token=${unsubToken}`
      
      // Обновляем department
      await dbQuery(
        `UPDATE departments 
         SET email_unsubscribe_token = $1,
             email_confirmed = TRUE,
             email_confirmed_at = NOW()
         WHERE id = $2`,
        [unsubToken, id]
      )
      
      // Получаем hotel name
      const hotelResult = await dbQuery('SELECT name FROM hotels WHERE id = $1', [department.hotel_id])
      const hotelName = hotelResult.rows[0]?.name || 'Hotel'
      
      // Отправка простого confirmation email
      await sendVerificationEmail({
        user: { name: department.name },
        verificationLink: null,
        target: 'DEPARTMENT',
        email: department.email,
        departmentName: department.name,
        hotelName: hotelName,
        unsubscribeLink: unsubscribeLink
      })
      
      await logAudit({
        hotel_id: department.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'send_confirmation',
        entity_type: 'department',
        entity_id: id,
        details: { email: department.email },
        ip_address: req.ip
      })
      
      res.json({ success: true, message: 'Confirmation email sent' })
    } catch (error) {
      logError('Send department confirmation error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/departments/:id/unsubscribe
 * Unsubscribe from department emails
 */
router.get('/:id/unsubscribe',
  async (req, res) => {
    try {
      const { id } = req.params
      const { token } = req.query
      
      if (!token) {
        return res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>Invalid Request</h2>
              <p>Missing unsubscribe token.</p>
            </body>
          </html>
        `)
      }
      
      const result = await dbQuery(
        `UPDATE departments
         SET email_confirmed = FALSE,
             email_confirmed_at = NULL
         WHERE id = $1 AND email_unsubscribe_token = $2
         RETURNING id, name`,
        [id, token]
      )
      
      if (result.rows.length === 0) {
        return res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>Invalid or Expired Link</h2>
              <p>The unsubscribe link is invalid or has expired.</p>
            </body>
          </html>
        `)
      }
      
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #059669;">✓ Unsubscribed</h2>
            <p>You will no longer receive daily reports at this email address.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Contact your hotel administrator to re-enable email notifications.
            </p>
          </body>
        </html>
      `)
    } catch (error) {
      logError('Unsubscribe error', error)
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Error</h2>
            <p>An error occurred while processing your request.</p>
          </body>
        </html>
      `)
    }
  }
)

export default router
