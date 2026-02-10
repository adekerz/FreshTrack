/**
 * Auth Users Controller
 *
 * Routes: /users/export, /users (GET), /users (POST),
 *         /users/:id/resend-password, /users/:id (PUT),
 *         /users/:id (DELETE), /users/:id/toggle (PATCH)
 */

import { Router } from 'express'
import {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  GetUsersQuerySchema,
  validate,
  canAssignRole,
  canEditUser
} from './auth.schemas.js'
import { AuthService } from './auth.service.js'
import { authMiddleware, requirePermission } from '../../middleware/auth.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

const router = Router()

// ========================================
// Управление пользователями (admin)
// ========================================

/**
 * GET /api/users/export
 * Экспорт списка пользователей в CSV/XLSX/JSON
 */
router.get('/users/export', authMiddleware, requirePermission('users', 'read'), asyncHandler(async (req, res) => {
  const { format = 'xlsx', search, role, isActive, departmentId, hotelId } = req.query

  // Get users without pagination for export
  const result = await AuthService.getUsers({
    search,
    role,
    isActive,
    departmentId,
    hotelId,
    page: 1,
    limit: 10000 // Max for export
  }, req.user)

  if (!result.success) {
    return res.status(result.statusCode).json({ error: result.error })
  }

  // Transform data for export
  const exportData = result.data.users.map(user => ({
    name: user.name,
    email: user.email,
    login: user.login,
    role: user.role,
    hotel_name: user.hotel?.name || '',
    department_name: user.department?.name || '',
    is_active: user.is_active,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt
  }))

  const { ExportService } = await import('../../services/ExportService.js')

  await ExportService.sendExport(res, exportData, 'users', format, {
    filename: `users_export_${new Date().toISOString().split('T')[0]}`,
    user: req.user,
    ipAddress: req.ip,
    filters: { search, role, isActive, departmentId, hotelId }
  })
}))

/**
 * GET /api/users
 * Получить список пользователей
 */
router.get('/users', authMiddleware, requirePermission('users', 'read'), asyncHandler(async (req, res) => {
  const validation = validate(GetUsersQuerySchema, req.query)

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: validation.errors
    })
  }

  const result = await AuthService.getUsers(validation.data, req.user)

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  res.json(result.data)
}))

/**
 * POST /api/users
 * Создать нового пользователя (admin)
 */
router.post('/users', authMiddleware, requirePermission('users', 'create'), asyncHandler(async (req, res) => {
  const validation = validate(CreateUserRequestSchema, req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: validation.errors
    })
  }

  // Проверка права назначать роль (is_owner требуется для создания SUPER_ADMIN)
  if (!canAssignRole(req.user.role, validation.data.role, req.user.is_owner)) {
    // Специальное сообщение для SUPER_ADMIN
    if (validation.data.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Только основной супер-администратор может создавать других супер-администраторов'
      })
    }
    return res.status(403).json({
      error: `Вы не можете создавать пользователей с ролью ${validation.data.role}`
    })
  }

  const result = await AuthService.createUser(validation.data, req.user, req.ip)

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  // AuthService.createUser already logs audit, so we just return the data
  res.status(201).json(result.data)
}))

/**
 * POST /api/users/:id/resend-password
 * Resend temporary password to user
 */
router.post('/users/:id/resend-password', authMiddleware, requirePermission('users', 'update'), asyncHandler(async (req, res) => {
  const { id } = req.params

  // Get user using dbQuery (already imported)
  const userResult = await dbQuery(`
    SELECT id, name, email, hotel_id, must_change_password
    FROM users
    WHERE id = $1
  `, [id])

  if (userResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' })
  }

  const user = userResult.rows[0]

  // Check hotel isolation
  if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== user.hotel_id) {
    return res.status(403).json({ success: false, error: 'Access denied' })
  }

  // Generate new temporary password
  const { generateTemporaryPassword } = await import('../../utils/passwordGenerator.js')
  const temporaryPassword = generateTemporaryPassword(12)
  const bcrypt = await import('bcryptjs')
  const hashedPassword = bcrypt.hashSync(temporaryPassword, 10)

  // Update user password and set must_change_password flag
  await dbQuery(`
    UPDATE users
    SET password = $1, must_change_password = true, updated_at = NOW()
    WHERE id = $2
  `, [hashedPassword, id])

  // Get hotel name
  const hotelResult = await dbQuery('SELECT name FROM hotels WHERE id = $1', [user.hotel_id])
  const hotelName = hotelResult.rows[0]?.name || 'FreshTrack'

  const loginUrl = process.env.APP_URL || 'http://localhost:5173/login'

  // Send email
  const { sendWelcomeEmailWithPassword } = await import('../../services/EmailService.js')
  await sendWelcomeEmailWithPassword({
    to: user.email,
    userName: user.name,
    temporaryPassword,
    hotelName,
    loginUrl
  })

  await logAudit({
    hotel_id: user.hotel_id,
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    action: 'resend_password',
    entity_type: 'user',
    entity_id: id,
    details: { userEmail: user.email },
    ip_address: req.ip
  })

  res.json({
    success: true,
    message: `Temporary password sent to ${user.email}`
  })
}))

/**
 * PUT /api/users/:id
 * Обновить пользователя
 */
router.put('/users/:id', authMiddleware, requirePermission('users', 'update'), asyncHandler(async (req, res) => {
  const userId = req.params.id

  // Проверка UUID формата
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return res.status(400).json({ error: 'Неверный ID пользователя' })
  }

  const validation = validate(UpdateUserRequestSchema, req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: validation.errors
    })
  }

  // Получаем целевого пользователя
  const targetUser = await AuthService.getCurrentUser(userId)
  if (!targetUser.success) {
    return res.status(404).json({ error: 'Пользователь не найден' })
  }

  // Проверка прав редактирования
  if (!canEditUser(req.user, targetUser.data)) {
    return res.status(403).json({
      error: 'Недостаточно прав для редактирования этого пользователя'
    })
  }

  // Проверка смены роли (is_owner требуется для назначения SUPER_ADMIN)
  if (validation.data.role && !canAssignRole(req.user.role, validation.data.role, req.user.is_owner)) {
    if (validation.data.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Только основной супер-администратор может назначать роль супер-администратора'
      })
    }
    return res.status(403).json({
      error: `Вы не можете назначить роль ${validation.data.role}`
    })
  }

  const result = await AuthService.updateUser(userId, validation.data, req.user)

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  await logAudit({
    hotel_id: req.user.hotel_id,
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    action: 'UPDATE',
    entity_type: 'user',
    entity_id: userId,
    details: { changes: Object.keys(validation.data) },
    ip_address: req.ip
  })

  res.json(result.data)
}))

/**
 * DELETE /api/users/:id
 * Удалить пользователя
 */
router.delete('/users/:id',
  authMiddleware,
  requirePermission('users', 'delete'),
  requireMFA, // MFA required for SUPER_ADMIN
  asyncHandler(async (req, res) => {
    const userId = req.params.id

    // Проверка UUID формата
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ error: 'Неверный ID пользователя' })
    }

    // Нельзя удалить себя
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' })
    }

    const result = await AuthService.deleteUser(userId, req.user)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'DELETE',
      entity_type: 'user',
      entity_id: userId,
      details: {},
      ip_address: req.ip
    })

    res.json({ message: 'Пользователь удалён' })
  })
)

/**
 * PATCH /api/users/:id/toggle
 * Активировать/деактивировать пользователя
 */
router.patch('/users/:id/toggle', authMiddleware, requirePermission('users', 'update'), asyncHandler(async (req, res) => {
  const userId = req.params.id

  // Проверка UUID формата
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return res.status(400).json({ error: 'Неверный ID пользователя' })
  }

  // Нельзя деактивировать себя
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Нельзя деактивировать собственный аккаунт' })
  }

  const result = await AuthService.toggleUserStatus(userId, req.user)

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  await logAudit({
    hotel_id: req.user.hotel_id,
    user_id: req.user.id,
    user_name: req.user.name || req.user.login,
    action: result.data.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity_type: 'user',
    entity_id: userId,
    details: { isActive: result.data.isActive, targetUser: result.data.login },
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  })

  res.json(result.data)
}))

export default router
