/**
 * Auth Core Controller
 *
 * Routes: /login, /validate-hotel-code, /register, /logout,
 *         /pending-status, /join-requests, /join-requests/:id/approve,
 *         /join-requests/:id/reject, /me (GET), /me (PUT)
 */

import { Router } from 'express'
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  validate
} from './auth.schemas.js'
import { AuthService } from './auth.service.js'
import { authMiddleware, requirePermission, generateToken } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { logError, logDebug } from '../../utils/logger.js'
import { EmailVerificationService } from '../../services/EmailVerificationService.js'
import jwt from 'jsonwebtoken'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { setTokenCookie, clearTokenCookie } from './auth-cookies.js'

const router = Router()

// ========================================
// Публичные endpoints
// ========================================

/**
 * POST /api/auth/login
 * Авторизация пользователя
 */
router.post('/login', asyncHandler(async (req, res) => {
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

  // Set httpOnly cookie if token is present (not MFA/terms partial flow)
  if (result.data.token) {
    setTokenCookie(res, result.data.token)
  }

  res.json(result.data)
}))

/**
 * GET /api/auth/validate-hotel-code
 * Проверка MARSHA кода отеля при регистрации (публичный)
 *
 * ВАЖНО: Поиск ТОЛЬКО по marsha_code — никаких fallback'ов!
 * Это единственный эндпоинт (вместе с /register) где принимается marsha_code извне.
 */
router.get('/validate-hotel-code', asyncHandler(async (req, res) => {
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
}))

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post('/register', asyncHandler(async (req, res) => {
  const validation = validate(RegisterRequestSchema, req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Ошибка валидации',
      details: validation.errors
    })
  }

  // Email обязателен для регистрации
  if (!validation.data.email) {
    return res.status(400).json({
      success: false,
      error: 'Email обязателен для регистрации'
    })
  }

  const result = await AuthService.register(validation.data)

  if (!result.success) {
    return res.status(result.statusCode).json({
      success: false,
      error: result.error
    })
  }

  // Единый поток OTP: отправляем только письмо с кодом
  if (result.data.needsEmailVerification) {
    try {
      const otpResult = await EmailVerificationService.sendOTP(
        result.data.user.id,
        validation.data.email,
        'REGISTRATION'
      )
      const partialToken = jwt.sign(
        { userId: result.data.user.id, emailVerificationPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      )
      return res.status(201).json({
        success: true,
        partialToken,
        needsEmailVerification: true,
        email: validation.data.email,
        expiresAt: otpResult.expiresAt,
        cooldownSeconds: otpResult.cooldownSeconds,
        message: 'OTP sent to your email'
      })
    } catch (otpError) {
      logError('Register OTP send', otpError)
      const partialToken = jwt.sign(
        { userId: result.data.user.id, emailVerificationPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      )
      return res.status(201).json({
        success: true,
        partialToken,
        needsEmailVerification: true,
        email: validation.data.email,
        otpError: 'Failed to send OTP. Please request resend on verify page.'
      })
    }
  }

  if (result.data.token) {
    setTokenCookie(res, result.data.token)
  }
  res.status(201).json({
    success: true,
    token: result.data.token,
    user: result.data.user,
    message: 'Registration successful'
  })
}))

/**
 * POST /api/auth/logout
 * Выход из системы
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  await logAudit({
    user_id: req.user.id,
    user_name: req.user.name || req.user.login || 'Unknown',
    hotel_id: req.user.hotel_id,
    action: 'LOGOUT',
    entity_type: 'User',
    entity_id: req.user.id,
    details: {}
  })

  clearTokenCookie(res)
  res.json({ message: 'Выход выполнен' })
}))

// ========================================
// Pending Status
// ========================================

/**
 * GET /api/auth/pending-status
 * Получить статус ожидающей заявки пользователя
 */
router.get('/pending-status', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id
  logDebug('Auth', 'Pending status check', { userId })

  const userResult = await dbQuery(`
    SELECT u.id, u.status, u.role, u.hotel_id, u.department_id,
           h.id as hotel_id, h.name as hotel_name, h.marsha_code
    FROM users u
    LEFT JOIN hotels h ON h.id = u.hotel_id
    WHERE u.id = $1
  `, [userId])

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Пользователь не найден'
    })
  }

  const user = userResult.rows[0]
  logDebug('Auth', 'User status', { status: user.status, role: user.role })

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
}))

// ========================================
// Join Requests
// ========================================

/**
 * GET /api/auth/join-requests
 * Получить заявки на присоединение к отелю
 */
router.get('/join-requests', authMiddleware, requirePermission('users', 'read'), asyncHandler(async (req, res) => {
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
}))

/**
 * POST /api/auth/join-requests/:id/approve
 * Одобрить заявку на присоединение
 */
router.post('/join-requests/:id/approve', authMiddleware, requirePermission('users', 'update'), asyncHandler(async (req, res) => {
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
}))

/**
 * POST /api/auth/join-requests/:id/reject
 * Отклонить заявку на присоединение
 */
router.post('/join-requests/:id/reject', authMiddleware, requirePermission('users', 'update'), asyncHandler(async (req, res) => {
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
}))

// ========================================
// Защищённые endpoints
// ========================================

/**
 * GET /api/auth/me
 * Получить текущего пользователя
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const result = await AuthService.getCurrentUser(req.user.id)

  if (!result.success) {
    return res.status(result.statusCode).json({
      error: result.error
    })
  }

  res.json(result.data)
}))

/**
 * PUT /api/auth/me
 * Обновить свой профиль (имя, email)
 */
router.put('/me', authMiddleware, asyncHandler(async (req, res) => {
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
}))

export default router
