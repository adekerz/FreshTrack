/**
 * FreshTrack Auth API
 * Авторизация пользователей
 */

import express from 'express'
import jwt from 'jsonwebtoken'
import { getUserByEmail, getUserByLoginOrEmail, createUser, verifyPassword, getAllUsers } from '../db/database.js'
import { logAction } from './audit-logs.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'freshtrack_secret_key_2024'

/**
 * POST /api/auth/login - Авторизация
 * Поддерживает вход по email ИЛИ логину
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Login/email and password are required' 
      })
    }
    
    // Ищем пользователя по логину или email
    const user = getUserByLoginOrEmail(email)
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      })
    }
    
    // Проверяем пароль
    const isValidPassword = verifyPassword(password, user.password)
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      })
    }
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        login: user.login,
        role: user.role,
        departments: user.departments
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // Возвращаем пользователя без пароля
    
    // Логируем вход
    logAction(user.id, user.name || user.login, 'login', null, null, 'Успешный вход в систему', req.ip)
    
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role,
        departments: user.departments,
        telegram_chat_id: user.telegram_chat_id
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    })
  }
})

/**
 * POST /api/auth/logout - Выход из системы (для логирования)
 */
router.post('/logout', authMiddleware, (req, res) => {
  try {
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    
    // Логируем выход
    logAction(userId, userName, 'logout', null, null, 'Выход из системы', req.ip)
    
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ success: false, error: 'Logout failed' })
  }
})

/**
 * POST /api/auth/register - Регистрация
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department } = req.body
    
    // Валидация
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email and password are required' 
      })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      })
    }
    
    // Проверяем существует ли пользователь
    const existingUser = getUserByEmail(email)
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email already exists' 
      })
    }
    
    // Создаём пользователя
    const newUser = createUser({
      name,
      email,
      password,
      department,
      role: 'Staff'
    })
    
    // Генерируем токен
    const token = jwt.sign(
      { 
        id: newUser.id, 
        email: newUser.email, 
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    res.status(201).json({
      success: true,
      user: newUser,
      token
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed' 
    })
  }
})

/**
 * GET /api/auth/me - Получить текущего пользователя по токену
 */
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      })
    }
    
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    
    const user = getUserByLoginOrEmail(decoded.email)
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role,
        departments: user.departments,
        telegram_chat_id: user.telegram_chat_id
      }
    })
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    })
  }
})

/**
 * GET /api/auth/users - Получить всех пользователей (только для admin)
 */
router.get('/users', (req, res) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }
    
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // Проверяем права админа (роль может быть 'admin' или 'Administrator')
    if (decoded.role !== 'admin' && decoded.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const users = getAllUsers()
    res.json({ success: true, users })
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
})

export default router
