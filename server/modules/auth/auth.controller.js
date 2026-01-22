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
 * Проверка MARSHA кода отеля при регистрации (публичный)
 * 
 * ВАЖНО: Поиск ТОЛЬКО по marsha_code — никаких fallback'ов!
 * Это единственный эндпоинт (вместе с /register) где принимается marsha_code извне.
 */
router.get('/validate-hotel-code', async (req, res) => {
  try {
    const { code } = req.query

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MARSHA код отеля обязателен'
      })
    }

    // Нормализация: убираем пробелы, приводим к uppercase
    const normalizedCode = code.trim().toUpperCase()

    // Валидация формата: MARSHA код = 5 символов (буквы и цифры)
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'MARSHA код должен содержать ровно 5 символов (буквы и цифры)'
      })
    }

    // 1. Сначала проверяем, есть ли уже зарегистрированный отель с этим кодом
    const hotelResult = await dbQuery(`
      SELECT h.id, h.name, h.marsha_code
      FROM hotels h
      WHERE UPPER(h.marsha_code) = $1 AND h.is_active = true
    `, [normalizedCode])

    if (hotelResult.rows.length > 0) {
      // Отель уже существует в системе
      const hotel = hotelResult.rows[0]
      return res.json({
        success: true,
        valid: true,
        exists: true,
        hotel: {
          id: hotel.id,
          name: hotel.name,
          code: hotel.marsha_code,
          marshaCode: hotel.marsha_code
        }
      })
    }

    // 2. Если отеля нет, проверяем справочник MARSHA кодов
    const marshaResult = await dbQuery(`
      SELECT code, hotel_name, city, country, brand
      FROM marsha_codes
      WHERE UPPER(code) = $1
    `, [normalizedCode])

    if (marshaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'MARSHA код не найден. Проверьте правильность кода.'
      })
    }

    // MARSHA код найден в справочнике (отель ещё не создан)
    const marsha = marshaResult.rows[0]
    res.json({
      success: true,
      valid: true,
      exists: false,
      marsha: {
        code: marsha.code,
        hotelName: marsha.hotel_name,
        city: marsha.city,
        country: marsha.country,
        brand: marsha.brand
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
      user_name: req.user.name || req.user.login,
      hotel_id: jr.hotel_id,
      action: 'APPROVE',
      entity_type: 'JoinRequest',
      entity_id: id,
      details: { userId: jr.user_id, role, departmentId },
      ip_address: req.ip
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
      user_name: req.user.name || req.user.login,
      hotel_id: jr.hotel_id,
      action: 'REJECT',
      entity_type: 'JoinRequest',
      entity_id: id,
      details: { userId: jr.user_id, notes },
      ip_address: req.ip
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
 * PUT /api/auth/me
 * Обновить свой профиль (имя, email)
 */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body

    // Валидация email если указан
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (email && !emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Неверный формат email адреса'
        })
      }

      // Проверка уникальности email (если указан)
      if (email) {
        const { getUserByLoginOrEmail } = await import('../../db/database.js')
        const existingUser = await getUserByLoginOrEmail(email)
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({
            error: 'Пользователь с таким email уже существует'
          })
        }
      }
    }

    // Подготавливаем данные для обновления
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email || null

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Необходимо указать хотя бы одно поле для обновления'
      })
    }

    // Обновляем пользователя
    const result = await AuthService.updateUser(req.user.id, updateData, req.user, req.ip)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    // logAudit уже вызывается внутри AuthService.updateUser, дублировать не нужно

    res.json({
      success: true,
      user: result.data.user,
      message: 'Профиль обновлен'
    })

  } catch (error) {
    console.error('[Auth] Update me error:', error)
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
      hotel_id: req.user.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: req.user.id,
      details: { field: 'password' },
      ip_address: req.ip
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

    const result = await AuthService.createUser(validation.data, req.user, req.ip)

    if (!result.success) {
      return res.status(result.statusCode).json({
        error: result.error
      })
    }

    // AuthService.createUser already logs audit, so we just return the data
    res.status(201).json(result.data)

  } catch (error) {
    console.error('[Auth] Create user error:', error)
    console.error('[Auth] Error stack:', error.stack)
    res.status(500).json({ 
      error: 'Ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * POST /api/users/:id/resend-password
 * Resend temporary password to user
 */
router.post('/users/:id/resend-password', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
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
    
  } catch (error) {
    console.error('[Auth] Resend password error:', error)
    console.error('[Auth] Error stack:', error.stack)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to resend password',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
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
      hotel_id: req.user.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'UPDATE',
      entity_type: 'user',
      entity_id: userId,
      details: { isActive: result.data.isActive },
      ip_address: req.ip
    })

    res.json(result.data)

  } catch (error) {
    console.error('[Auth] Toggle user error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

export default router
