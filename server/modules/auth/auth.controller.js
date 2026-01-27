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
import { authMiddleware, requirePermission, generateToken } from '../../middleware/auth.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { sendVerificationEmail } from '../../services/EmailService.js'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { logInfo, logError, logWarn } from '../../utils/logger.js'
import { MFAService } from '../../services/MFAService.js'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { superAdminOnly } from '../../middleware/auth.js'

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
router.delete('/users/:id', 
  authMiddleware, 
  requirePermission('users', 'delete'),
  requireMFA, // MFA required for SUPER_ADMIN
  async (req, res) => {
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

// ═══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Rate limiter for verification code sending (3 per hour per user)
const resendCodeLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60 // Block for 1 hour if exceeded
})

// Rate limiter for verification attempts (5 per 15 minutes per user)
const verifyCodeLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60, // 15 minutes
  blockDuration: 60 * 60 // Block for 1 hour if exceeded
})

/**
 * GET /api/auth/verify-email
 * Verify user email with token from confirmation link
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query
    
    if (!token || typeof token !== 'string') {
      return res.redirect('/verify-email?status=invalid')
    }
    
    // Verify token and mark email as verified
    const result = await dbQuery(`
      UPDATE users 
      SET email_verified = TRUE,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE email_verification_token = $1
        AND email_verification_expires > NOW()
      RETURNING id, email
    `, [token])
    
    if (result.rows.length === 0) {
      return res.redirect('/verify-email?status=expired')
    }
    
    const user = result.rows[0]
    
    // Create join request if hotel_id was set during registration
    const userResult = await dbQuery('SELECT hotel_id FROM users WHERE id = $1', [user.id])
    if (userResult.rows[0]?.hotel_id) {
      try {
        const { createJoinRequest } = await import('../../db/database.js')
        await createJoinRequest(user.id, userResult.rows[0].hotel_id)
        logInfo('Auth', `Created join request for user ${user.id} after email verification`)
      } catch (error) {
        logWarn('Auth', `Failed to create join request for user ${user.id}`, error)
      }
    }
    
    await logAudit({
      hotel_id: userResult.rows[0]?.hotel_id,
      user_id: user.id,
      user_name: 'User',
      action: 'verify_email',
      entity_type: 'user',
      entity_id: user.id,
      details: { email: user.email, method: 'confirmation_link' },
      ip_address: req.ip
    })
    
    res.redirect('/verify-email?status=success')
  } catch (error) {
    logError('Verify email error', error)
    res.redirect('/verify-email?status=error')
  }
})

/**
 * POST /api/auth/verify-email (DEPRECATED - kept for backward compatibility)
 * Verify user email with 6-digit code
 */
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
    }

    const userId = req.user.id

    // Rate limiting
    try {
      await verifyCodeLimiter.consume(`user_verify_${userId}`)
    } catch (rejRes) {
      return res.status(429).json({
        success: false,
        error: 'Too many verification attempts. Please try again later.',
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
      })
    }

    // Get user with verification data
    const userResult = await dbQuery(`
      SELECT id, email, email_verification_code, email_verification_expires, email_verification_attempts, hotel_id
      FROM users WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const user = userResult.rows[0]

    // Check if code exists and is not expired
    if (!user.email_verification_code) {
      return res.status(400).json({ success: false, error: 'No verification code found. Please request a new code.' })
    }

    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(400).json({ success: false, error: 'Verification code expired. Please request a new code.' })
    }

    // Check attempts (max 5)
    if (user.email_verification_attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please request a new code after 1 hour.'
      })
    }

    // Verify code
    if (user.email_verification_code !== code) {
      // Increment attempts
      await dbQuery(`
        UPDATE users 
        SET email_verification_attempts = email_verification_attempts + 1
        WHERE id = $1
      `, [userId])

      const attemptsLeft = 5 - (user.email_verification_attempts + 1)
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
        attemptsLeft: Math.max(0, attemptsLeft)
      })
    }

    // Success - mark as verified and clear code
    await dbQuery(`
      UPDATE users 
      SET email_verified = true,
          email_verification_code = NULL,
          email_verification_expires = NULL,
          email_verification_attempts = 0
      WHERE id = $1
    `, [userId])

    // Create join request if hotel_id was set during registration
    if (user.hotel_id) {
      try {
        const { createJoinRequest } = await import('../../db/database.js')
        await createJoinRequest(userId, user.hotel_id)
        logInfo('Auth', `Created join request for user ${userId} after email verification`)
      } catch (error) {
        logWarn('Auth', `Failed to create join request for user ${userId}`, error)
        // Don't fail verification if join request creation fails
      }
    }

    await logAudit({
      hotel_id: user.hotel_id,
      user_id: userId,
      user_name: req.user.name || req.user.login,
      action: 'verify_email',
      entity_type: 'user',
      entity_id: userId,
      details: { email: user.email },
      ip_address: req.ip
    })

    // Get updated user data
    const updatedUser = await AuthService.getCurrentUser(userId)
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
      user: updatedUser.data?.user
    })
  } catch (error) {
    logError('Verify email error', error)
    res.status(500).json({ success: false, error: 'Failed to verify email' })
  }
})

/**
 * POST /api/auth/resend-verification-code
 * Resend verification link to user email (simplified - uses links, not codes)
 */
router.post('/resend-verification-code', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    // Rate limiting
    try {
      await resendCodeLimiter.consume(`user_resend_${userId}`)
    } catch (rejRes) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
      })
    }

    // Get user
    const userResult = await dbQuery(`
      SELECT id, email, name FROM users WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const user = userResult.rows[0]

    if (!user.email) {
      return res.status(400).json({ success: false, error: 'User email is not set' })
    }

    // Generate new verification token
    const crypto = await import('crypto')
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Save token to database
    await dbQuery(`
      UPDATE users 
      SET email_verification_token = $1,
          email_verification_expires = $2
      WHERE id = $3
    `, [verificationToken, expiresAt, userId])

    // Send email with link
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const verificationLink = `${appUrl}/verify-email?token=${verificationToken}`
      
      await sendVerificationEmail({
        user: { name: user.name, email: user.email },
        verificationLink,
        target: 'USER'
      })
      logInfo('Auth', `Verification link resent to ${user.email} for user ${user.name}`)
    } catch (emailError) {
      logError('Auth', `Failed to send verification email to ${user.email}`, emailError)
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email'
      })
    }

    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: userId,
      user_name: req.user.name || req.user.login,
      action: 'resend_verification_link',
      entity_type: 'user',
      entity_id: userId,
      details: { email: user.email },
      ip_address: req.ip
    })

    res.json({
      success: true,
      message: 'Verification link sent',
      expiresAt: expiresAt.toISOString()
    })
  } catch (error) {
    logError('Resend verification link error', error)
    res.status(500).json({ success: false, error: 'Failed to resend verification link' })
  }
})

/**
 * GET /api/auth/verification-status
 * Get email verification status for current user
 */
router.get('/verification-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id

    const userResult = await dbQuery(`
      SELECT email, email_verified, email_verification_code, email_verification_expires, email_verification_attempts
      FROM users WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const user = userResult.rows[0]

    const now = new Date()
    const expiresAt = user.email_verification_expires ? new Date(user.email_verification_expires) : null
    const isExpired = expiresAt && now > expiresAt
    const canResend = !user.email_verification_code || isExpired || user.email_verification_attempts >= 5

    res.json({
      success: true,
      verified: user.email_verified || false,
      email: user.email,
      canResend,
      attemptsLeft: Math.max(0, 5 - (user.email_verification_attempts || 0)),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isExpired
    })
  } catch (error) {
    logError('Get verification status error', error)
    res.status(500).json({ success: false, error: 'Failed to get verification status' })
  }
})

// ═══════════════════════════════════════════════════════════════
// MFA ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/mfa/setup
 * Setup MFA (только для залогиненных юзеров)
 */
router.post('/mfa/setup', authMiddleware, async (req, res) => {
  try {
    const { id: userId, login, mfa_enabled } = req.user
    
    if (mfa_enabled) {
      return res.status(400).json({ success: false, error: 'MFA already enabled' })
    }
    
    const result = await MFAService.setupMFA(userId, login)
    
    res.json({
      success: true,
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: 'Save backup codes securely. They cannot be retrieved later.'
    })
  } catch (error) {
    logError('MFA setup error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/auth/mfa/verify-setup
 * Verify and enable MFA
 */
router.post('/mfa/verify-setup', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body
    const { id: userId } = req.user
    const ipAddress = req.ip
    const userAgent = req.get('user-agent')
    
    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
    }
    
    // Проверяем код
    await MFAService.verifyTOTP(userId, token, ipAddress, userAgent)
    
    // Активируем MFA
    await MFAService.enableMFA(userId)
    
    res.json({ success: true, message: 'MFA enabled successfully' })
  } catch (error) {
    logError('MFA verify-setup error', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/auth/mfa/verify
 * Verify MFA и завершить login
 */
router.post('/mfa/verify', async (req, res) => {
  try {
    const { partialToken, code, useBackup } = req.body
    const ipAddress = req.ip
    const userAgent = req.get('user-agent')
    
    if (!partialToken || !code) {
      return res.status(400).json({ success: false, error: 'Token and code required' })
    }
    
    // Декодируем partial token
    let decoded
    try {
      decoded = jwt.verify(partialToken, process.env.JWT_SECRET)
    } catch (error) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' })
    }
    
    if (!decoded.mfaPending) {
      return res.status(400).json({ success: false, error: 'Invalid token' })
    }
    
    const userId = decoded.userId
    
    // Верификация
    if (useBackup) {
      await MFAService.verifyBackupCode(userId, code, ipAddress, userAgent)
    } else {
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
      }
      await MFAService.verifyTOTP(userId, code, ipAddress, userAgent)
    }
    
    // Получаем полные данные пользователя
    const userResult = await dbQuery('SELECT * FROM users WHERE id = $1', [userId])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const user = userResult.rows[0]
    
    // Выдаем полный token
    const token = generateToken(user)
    
    // Форматируем ответ
    const userData = await AuthService.formatUserResponse(user, true)
    
    res.json({
      success: true,
      token,
      user: userData
    })
  } catch (error) {
    logError('MFA verify error', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/auth/mfa/disable
 * Disable MFA
 */
router.post('/mfa/disable', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body
    const { id: userId } = req.user
    const ipAddress = req.ip
    const userAgent = req.get('user-agent')
    
    if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token)) {
      return res.status(400).json({ success: false, error: 'Invalid code format. Must be 6 digits.' })
    }
    
    await MFAService.disableMFA(userId, token, ipAddress, userAgent)
    
    res.json({ success: true, message: 'MFA disabled' })
  } catch (error) {
    logError('MFA disable error', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/auth/mfa/status
 * Get MFA status
 */
router.get('/mfa/status', authMiddleware, async (req, res) => {
  try {
    const userResult = await dbQuery(
      'SELECT mfa_enabled, mfa_required, mfa_backup_codes, mfa_grace_period_ends FROM users WHERE id = $1',
      [req.user.id]
    )
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const { mfa_enabled, mfa_required, mfa_backup_codes, mfa_grace_period_ends } = userResult.rows[0]
    
    const now = new Date()
    const graceEnds = mfa_grace_period_ends ? new Date(mfa_grace_period_ends) : null
    const daysLeft = graceEnds && now < graceEnds 
      ? Math.ceil((graceEnds - now) / (1000 * 60 * 60 * 24))
      : null
    
    res.json({
      success: true,
      enabled: mfa_enabled || false,
      required: mfa_required || false,
      backupCodesCount: mfa_backup_codes ? mfa_backup_codes.length : 0,
      gracePeriodEnds: graceEnds ? graceEnds.toISOString() : null,
      gracePeriodDaysLeft: daysLeft
    })
  } catch (error) {
    logError('MFA status error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/auth/mfa/request-recovery
 * Request MFA recovery assistance (creates ticket for admin)
 * If user is the ONLY active SUPER_ADMIN, provides emergency email recovery
 */
router.post('/mfa/request-recovery', async (req, res) => {
  try {
    const { email, login, reason } = req.body
    
    if (!email || !login) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and login are required' 
      })
    }
    
    // Verify user exists
    const userResult = await dbQuery(
      'SELECT id, name, role FROM users WHERE email = $1 AND login = $2',
      [email, login]
    )
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    const user = userResult.rows[0]
    
    // Check if this is the ONLY active SUPER_ADMIN (emergency case)
    const activeAdminsResult = await dbQuery(`
      SELECT COUNT(*) as count FROM users 
      WHERE role = 'SUPER_ADMIN' 
        AND is_active = TRUE 
        AND email IS NOT NULL
        AND id != $1
    `, [user.id])
    
    const otherActiveAdmins = parseInt(activeAdminsResult.rows[0].count)
    const isOnlySuperAdmin = user.role === 'SUPER_ADMIN' && otherActiveAdmins === 0
    
    // Create recovery request
    const requestId = uuidv4()
    await dbQuery(`
      INSERT INTO mfa_recovery_requests 
      (id, email, login, reason, status, created_at)
      VALUES ($1, $2, $3, $4, 'PENDING', NOW())
    `, [requestId, email, login, reason || null])
    
    // Emergency recovery: if this is the ONLY SUPER_ADMIN, send email recovery link
    if (isOnlySuperAdmin) {
      const recoveryToken = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24) // 24 hours validity
      
      // Store recovery token
      await dbQuery(`
        INSERT INTO mfa_emergency_recovery (user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET token = $2, expires_at = $3, created_at = NOW()
      `, [user.id, recoveryToken, expiresAt])
      
      const appUrl = process.env.APP_URL || 'http://localhost:5173'
      const recoveryLink = `${appUrl}/api/auth/mfa/emergency-recover?token=${recoveryToken}`
      
      // Send emergency recovery email
      try {
        const { sendEmail } = await import('../../services/EmailService.js')
        await sendEmail({
          to: email,
          subject: '🚨 EMERGENCY: MFA Recovery - FreshTrack',
          html: `
            <h2>Emergency MFA Recovery</h2>
            <p><strong>You are the only active SUPER_ADMIN.</strong></p>
            <p>Use this secure link to reset your MFA (valid for 24 hours):</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${recoveryLink}" 
                 style="display: inline-block; padding: 16px 32px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Reset MFA
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">
              If you did not request this, please contact support immediately.
            </p>
            <p style="color: #dc2626; font-size: 14px; margin-top: 24px;">
              ⚠️ This link will be logged in audit trail for security.
            </p>
          `
        })
        
        // Log emergency recovery request
        await logAudit({
          hotel_id: null,
          user_id: user.id,
          user_name: user.name || login,
          action: 'mfa_emergency_recovery_requested',
          entity_type: 'user',
          entity_id: user.id,
          details: {
            requestId,
            isOnlySuperAdmin: true,
            email,
            timestamp: new Date().toISOString()
          },
          ip_address: req.ip
        })
        
        return res.json({
          success: true,
          message: 'Emergency recovery email sent. Check your email for recovery link.',
          requestId,
          emergencyRecovery: true,
          note: 'You are the only active SUPER_ADMIN. Recovery link sent to your email.'
        })
      } catch (emailError) {
        logError('MFA Recovery', 'Failed to send emergency recovery email', emailError)
        return res.status(500).json({
          success: false,
          error: 'Failed to send recovery email. Please contact support.'
        })
      }
    }
    
    // Normal recovery: notify other SUPER_ADMINs
    const adminsResult = await dbQuery(`
      SELECT email, name FROM users 
      WHERE role = 'SUPER_ADMIN' 
        AND is_active = TRUE 
        AND email IS NOT NULL
    `)
    
    // Send notification emails to admins
    for (const admin of adminsResult.rows) {
      try {
        const { sendEmail } = await import('../../services/EmailService.js')
        await sendEmail({
          to: admin.email,
          subject: 'MFA Recovery Request - FreshTrack',
          html: `
            <h2>MFA Recovery Request</h2>
            <p>A user has requested MFA recovery assistance:</p>
            <ul>
              <li><strong>User:</strong> ${user.name} (${login})</li>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Reason:</strong> ${reason || 'Not specified'}</li>
              <li><strong>Request ID:</strong> ${requestId}</li>
            </ul>
            <p>Please review and assist the user with MFA recovery.</p>
          `
        })
      } catch (emailError) {
        logError('MFA Recovery', `Failed to notify admin ${admin.email}`, emailError)
      }
    }
    
    res.json({
      success: true,
      message: 'Recovery request submitted. Administrator will contact you.',
      requestId
    })
  } catch (error) {
    logError('MFA recovery request error', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/auth/mfa/emergency-recover
 * Emergency MFA recovery via email link (only for ONLY SUPER_ADMIN)
 */
router.get('/mfa/emergency-recover', async (req, res) => {
  try {
    const { token } = req.query
    
    if (!token) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Invalid Recovery Link</h2>
            <p>Missing recovery token.</p>
          </body>
        </html>
      `)
    }
    
    // Verify token
    const tokenResult = await dbQuery(`
      SELECT er.user_id, er.expires_at, u.email, u.name, u.login
      FROM mfa_emergency_recovery er
      JOIN users u ON u.id = er.user_id
      WHERE er.token = $1 AND er.expires_at > NOW()
    `, [token])
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>Invalid or Expired Recovery Link</h2>
            <p>The recovery link is invalid or has expired.</p>
            <p>Please request a new recovery link.</p>
          </body>
        </html>
      `)
    }
    
    const { user_id, email, name, login } = tokenResult.rows[0]
    
    // Reset MFA
    await dbQuery(`
      UPDATE users
      SET mfa_enabled = FALSE,
          mfa_secret = NULL,
          mfa_backup_codes = NULL
      WHERE id = $1
    `, [user_id])
    
    // Delete used token
    await dbQuery(`
      DELETE FROM mfa_emergency_recovery WHERE token = $1
    `, [token])
    
    // Audit log
    await logAudit({
      hotel_id: null,
      user_id: user_id,
      user_name: name || login,
      action: 'mfa_emergency_recovery_completed',
      entity_type: 'user',
      entity_id: user_id,
      details: {
        method: 'email_link',
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip
    })
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2 style="color: #059669;">✓ MFA Reset Successful</h2>
          <p>Your multi-factor authentication has been reset.</p>
          <p>You can now log in without MFA and set up MFA again in account settings.</p>
          <p style="margin-top: 30px;">
            <a href="/login" style="color: #FF8D6B; text-decoration: underline;">Go to Login</a>
          </p>
        </body>
      </html>
    `)
  } catch (error) {
    logError('Emergency MFA recovery error', error)
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Error</h2>
          <p>An error occurred while processing your recovery request.</p>
        </body>
      </html>
    `)
  }
})

/**
 * POST /api/auth/mfa/admin-reset/:userId
 * SUPER_ADMIN can reset MFA for another user
 */
router.post('/mfa/admin-reset/:userId',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const { userId } = req.params
      const { reason } = req.body
      
      // Get target user
      const userResult = await dbQuery(
        'SELECT id, login, email, name FROM users WHERE id = $1',
        [userId]
      )
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }
      
      const targetUser = userResult.rows[0]
      
      // Reset MFA
      await dbQuery(`
        UPDATE users
        SET mfa_enabled = FALSE,
            mfa_secret = NULL,
            mfa_backup_codes = NULL
        WHERE id = $1
      `, [userId])
      
      // Audit log
      await logAudit({
        hotel_id: req.user.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'mfa_admin_reset',
        entity_type: 'user',
        entity_id: userId,
        details: {
          targetUserId: userId,
          targetLogin: targetUser.login,
          reason: reason || 'Admin-assisted recovery',
          resetBy: req.user.id
        },
        ip_address: req.ip
      })
      
      // MFA audit log
      await MFAService.logMFAEvent(userId, 'admin_reset', req.ip, req.get('user-agent'), true)
      
      // Send notification to user
      if (targetUser.email) {
        try {
          const { sendEmail } = await import('../../services/EmailService.js')
          await sendEmail({
            to: targetUser.email,
            subject: 'MFA Reset - FreshTrack',
            html: `
              <h2>MFA Reset Notification</h2>
              <p>Your multi-factor authentication has been reset by an administrator.</p>
              <p><strong>Reset by:</strong> ${req.user.name || req.user.login}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>Please set up MFA again in your account settings.</p>
            `
          })
        } catch (emailError) {
          logWarn('MFA Recovery', `Failed to notify user ${targetUser.email}`, emailError)
        }
      }
      
      res.json({ 
        success: true, 
        message: 'MFA reset successfully. User has been notified.' 
      })
    } catch (error) {
      logError('MFA admin reset error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/auth/mfa/recovery-requests
 * Get pending MFA recovery requests (SUPER_ADMIN only)
 */
router.get('/mfa/recovery-requests',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const { status = 'PENDING' } = req.query
      
      const result = await dbQuery(`
        SELECT 
          r.id, r.email, r.login, r.reason, r.status, 
          r.created_at, r.resolved_at,
          u.id as user_id, u.name as user_name,
          resolved_by.name as resolved_by_name
        FROM mfa_recovery_requests r
        LEFT JOIN users u ON u.email = r.email AND u.login = r.login
        LEFT JOIN users resolved_by ON resolved_by.id = r.resolved_by
        WHERE r.status = $1
        ORDER BY r.created_at DESC
      `, [status])
      
      res.json({
        success: true,
        requests: result.rows
      })
    } catch (error) {
      logError('Get recovery requests error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
