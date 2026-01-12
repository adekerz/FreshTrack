/**
 * Auth Controller
 * 
 * HTTP обработчики для auth endpoints.
 * Использует Zod схемы для валидации и AuthService для бизнес-логики.
 */

import { Router } from 'express'
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  ChangePasswordSchema,
  GetUsersQuerySchema,
  validate,
  canAssignRole,
  canEditUser
} from './auth.schemas.js'
import { AuthService } from './auth.service.js'
import { authMiddleware, requirePermission } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'

const router = Router()

// ========================================
// Публичные endpoints
// ========================================

/**
 * POST /api/auth/login
 * Авторизация пользователя
 */
router.post('/login', async (req, res) => {
  try {
    const validation = validate(LoginRequestSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const { email, password } = validation.data
    const result = await AuthService.login(email, password, req.ip)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    // Audit log (AuthService already logs, this is redundant - remove)
    // Login audit is already handled in AuthService.login()

    res.json(result.data)

  } catch (error) {
    console.error('[Auth] Login error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * GET /api/auth/validate-hotel-code
 * Проверка кода отеля при регистрации (публичный)
 */
router.get('/validate-hotel-code', async (req, res) => {
  try {
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Код отеля обязателен'
      })
    }

    // Search in marsha_codes table and join with hotels
    const result = await dbQuery(`
      SELECT h.id, h.name, mc.code as marsha_code
      FROM hotels h
      INNER JOIN marsha_codes mc ON h.marsha_code_id = mc.id
      WHERE UPPER(mc.code) = UPPER($1) AND h.is_active = true
    `, [code.trim()])

    if (result.rows.length === 0) {
      // Also check if MARSHA code exists but not assigned to any hotel
      const marshaResult = await dbQuery(
        'SELECT code, hotel_name FROM marsha_codes WHERE UPPER(code) = UPPER($1)',
        [code.trim()]
      )

      if (marshaResult.rows.length > 0) {
        return res.status(404).json({
          success: false,
          valid: false,
          error: 'Этот MARSHA код еще не привязан к отелю в системе',
          marshaCode: marshaResult.rows[0]
        })
      }

      return res.status(404).json({
        success: false,
        valid: false,
        error: 'Отель с таким кодом не найден'
      })
    }

    const hotel = result.rows[0]

    res.json({
      success: true,
      valid: true,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        code: hotel.marsha_code
      }
    })
  } catch (error) {
    console.error('[Auth] Validate hotel code error:', error)
    res.status(500).json({ success: false, error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res) => {
  try {
    const validation = validate(RegisterRequestSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const result = await AuthService.register(validation.data)

    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        error: result.error
      })
    }

    // Возвращаем с success: true для фронтенда
    res.status(201).json({
      success: true,
      ...result.data
    })

  } catch (error) {
    console.error('[Auth] Register error:', error)
    res.status(500).json({ success: false, error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/auth/logout
 * Выход из системы
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await logAudit({
      user_id: req.user.id,
      user_name: req.user.name || req.user.login || 'Unknown',
      hotel_id: req.user.hotel_id,
      action: 'LOGOUT',
      entity_type: 'User',
      entity_id: req.user.id,
      details: {}
    })

    res.json({ message: 'Выход выполнен' })

  } catch (error) {
    console.error('[Auth] Logout error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ========================================
// Pending Status
// ========================================

/**
 * GET /api/auth/pending-status
 * Получить статус ожидающей заявки пользователя
 */
router.get('/pending-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    console.log('[Auth] Checking pending status for user:', userId)

    // Сначала проверяем статус самого пользователя
    const userResult = await dbQuery(`
      SELECT u.id, u.status, u.role, u.hotel_id, u.department_id,
             h.id as hotel_id, h.name as hotel_name, h.marsha_code
      FROM users u
      LEFT JOIN hotels h ON h.id = u.hotel_id
      WHERE u.id = $1
    `, [userId])

    console.log('[Auth] User result:', userResult.rows.length, 'rows')

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      })
    }

    const user = userResult.rows[0]
    console.log('[Auth] User status:', user.status, 'role:', user.role)

    // Если пользователь уже активен - вернуть полные данные
    if (user.status === 'active') {
      // Получаем permissions для активного пользователя
      const permResult = await dbQuery(`
        SELECT p.resource, p.action
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = $1
      `, [user.role])

      return res.json({
        success: true,
        status: 'active',
        role: user.role,
        hotel_id: user.hotel_id,
        department_id: user.department_id,
        hotel: user.hotel_id ? {
          id: user.hotel_id,
          name: user.hotel_name,
          marsha_code: user.marsha_code
        } : null,
        permissions: permResult.rows.map(p => `${p.resource}:${p.action}`)
      })
    }

    // Ищем заявку пользователя
    const result = await dbQuery(`
      SELECT jr.id, jr.status, jr.notes, jr.requested_at as created_at, jr.processed_at as updated_at,
             h.name as hotel_name
      FROM join_requests jr
      LEFT JOIN hotels h ON h.id = jr.hotel_id
      WHERE jr.user_id = $1
      ORDER BY jr.requested_at DESC
      LIMIT 1
    `, [userId])

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        status: user.status,
        hasPendingRequest: false,
        message: 'Нет активных заявок'
      })
    }

    const request = result.rows[0]

    res.json({
      success: true,
      status: request.status === 'approved' ? 'active' : request.status,
      hasPendingRequest: request.status === 'pending',
      hotel: request.hotel_name,
      notes: request.notes,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
      message: request.status === 'pending'
        ? 'Ваша заявка ожидает рассмотрения'
        : request.status === 'approved'
          ? 'Ваша заявка одобрена'
          : 'Ваша заявка отклонена'
    })
  } catch (error) {
    console.error('[Auth] Pending status error:', error)
    res.status(500).json({ success: false, error: 'Ошибка получения статуса' })
  }
})

// ========================================
// Join Requests
// ========================================

/**
 * GET /api/auth/join-requests
 * Получить заявки на присоединение к отелю
 */
router.get('/join-requests', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
  try {
    const hotelId = req.user.hotel_id

    // SUPER_ADMIN видит все заявки, HOTEL_ADMIN - только своего отеля
    let sql = `
      SELECT jr.*, 
             u.name as user_name, 
             u.email as user_email,
             u.login as user_login,
             h.name as hotel_name,
             pb.name as processed_by_name
      FROM join_requests jr
      JOIN users u ON jr.user_id = u.id
      JOIN hotels h ON jr.hotel_id = h.id
      LEFT JOIN users pb ON jr.processed_by = pb.id
      WHERE jr.status = 'pending'
    `
    const params = []

    if (req.user.role !== 'SUPER_ADMIN' && hotelId) {
      sql += ` AND jr.hotel_id = $1`
      params.push(hotelId)
    }

    sql += ` ORDER BY jr.requested_at DESC`

    const result = await dbQuery(sql, params)

    res.json({
      success: true,
      requests: result.rows
    })
  } catch (error) {
    console.error('[Auth] Get join requests error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/auth/join-requests/:id/approve
 * Одобрить заявку на присоединение
 */
router.post('/join-requests/:id/approve', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
    const { id } = req.params
    const { departmentId, role = 'STAFF' } = req.body

    // Проверяем существование заявки
    const request = await dbQuery(
      'SELECT * FROM join_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    )

    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена или уже обработана' })
    }

    const jr = request.rows[0]

    // Проверяем права на этот отель
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== jr.hotel_id) {
      return res.status(403).json({ error: 'Нет прав на обработку этой заявки' })
    }

    // Обновляем заявку
    await dbQuery(`
      UPDATE join_requests
      SET status = 'approved', processed_at = NOW(), processed_by = $1
      WHERE id = $2
    `, [req.user.id, id])

    // Обновляем пользователя
    await dbQuery(`
      UPDATE users
      SET hotel_id = $1, department_id = $2, role = $3, status = 'active'
      WHERE id = $4
    `, [jr.hotel_id, departmentId || null, role, jr.user_id])

    await logAudit({
      user_id: req.user.id,
      user_name: req.user.name,
      hotel_id: jr.hotel_id,
      action: 'APPROVE',
      entity_type: 'JoinRequest',
      entity_id: id,
      details: { userId: jr.user_id, role, departmentId }
    })

    res.json({ success: true, message: 'Заявка одобрена' })
  } catch (error) {
    console.error('[Auth] Approve join request error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/auth/join-requests/:id/reject
 * Отклонить заявку на присоединение
 */
router.post('/join-requests/:id/reject', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
    const { id } = req.params
    const { notes } = req.body

    // Проверяем существование заявки
    const request = await dbQuery(
      'SELECT * FROM join_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    )

    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена или уже обработана' })
    }

    const jr = request.rows[0]

    // Проверяем права на этот отель
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== jr.hotel_id) {
      return res.status(403).json({ error: 'Нет прав на обработку этой заявки' })
    }

    // Обновляем заявку
    await dbQuery(`
      UPDATE join_requests
      SET status = 'rejected', processed_at = NOW(), processed_by = $1, notes = $2
      WHERE id = $3
    `, [req.user.id, notes || null, id])

    await logAudit({
      user_id: req.user.id,
      user_name: req.user.name,
      hotel_id: jr.hotel_id,
      action: 'REJECT',
      entity_type: 'JoinRequest',
      entity_id: id,
      details: { userId: jr.user_id, notes }
    })

    res.json({ success: true, message: 'Заявка отклонена' })
  } catch (error) {
    console.error('[Auth] Reject join request error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ========================================
// Защищённые endpoints
// ========================================

/**
 * GET /api/auth/me
 * Получить текущего пользователя
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await AuthService.getCurrentUser(req.user.id)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    res.json(result.data)

  } catch (error) {
    console.error('[Auth] Get me error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PUT /api/auth/password
 * Смена пароля текущего пользователя
 */
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const validation = validate(ChangePasswordSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const result = await AuthService.changePassword(
      req.user.id,
      validation.data.currentPassword,
      validation.data.newPassword
    )

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    await logAudit({
      userId: req.user.id,
      action: 'UPDATE',
      resource: 'User',
      resourceId: req.user.id,
      details: { field: 'password' }
    })

    res.json({ message: 'Пароль изменён' })

  } catch (error) {
    console.error('[Auth] Change password error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ========================================
// Управление пользователями (admin)
// ========================================

/**
 * GET /api/users
 * Получить список пользователей
 */
router.get('/users', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
  try {
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

  } catch (error) {
    console.error('[Auth] Get users error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/users
 * Создать нового пользователя (admin)
 */
router.post('/users', authMiddleware, requirePermission('users', 'create'), async (req, res) => {
  try {
    const validation = validate(CreateUserRequestSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    // Проверка права назначать роль
    if (!canAssignRole(req.user.role, validation.data.role)) {
      return res.status(403).json({
        error: `Вы не можете создавать пользователей с ролью ${validation.data.role}`
      })
    }

    const result = await AuthService.createUser(validation.data, req.user)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    await logAudit({
      userId: req.user.id,
      action: 'CREATE',
      resource: 'User',
      resourceId: result.data.id,
      details: {
        login: result.data.login,
        role: result.data.role
      }
    })

    res.status(201).json(result.data)

  } catch (error) {
    console.error('[Auth] Create user error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PUT /api/users/:id
 * Обновить пользователя
 */
router.put('/users/:id', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
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

    // Проверка смены роли
    if (validation.data.role && !canAssignRole(req.user.role, validation.data.role)) {
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
      userId: req.user.id,
      action: 'UPDATE',
      resource: 'User',
      resourceId: userId,
      details: { changes: Object.keys(validation.data) }
    })

    res.json(result.data)

  } catch (error) {
    console.error('[Auth] Update user error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * DELETE /api/users/:id
 * Удалить пользователя
 */
router.delete('/users/:id', authMiddleware, requirePermission('users', 'delete'), async (req, res) => {
  try {
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
      userId: req.user.id,
      action: 'DELETE',
      resource: 'User',
      resourceId: userId,
      details: {}
    })

    res.json({ message: 'Пользователь удалён' })

  } catch (error) {
    console.error('[Auth] Delete user error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PATCH /api/users/:id/toggle
 * Активировать/деактивировать пользователя
 */
router.patch('/users/:id/toggle', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
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
      userId: req.user.id,
      action: 'UPDATE',
      resource: 'User',
      resourceId: userId,
      details: { isActive: result.data.isActive }
    })

    res.json(result.data)

  } catch (error) {
    console.error('[Auth] Toggle user error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

export default router
