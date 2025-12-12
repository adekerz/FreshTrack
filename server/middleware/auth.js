/**
 * Auth Middleware
 * Middleware для проверки JWT токена
 */

import jwt from 'jsonwebtoken'
import { getUserByLoginOrEmail } from '../db/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'freshtrack_secret_key_2024'

/**
 * Middleware для проверки аутентификации
 * Добавляет req.user если токен валиден
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authorization required' 
      })
    }
    
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    
    const user = getUserByLoginOrEmail(decoded.email)
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    // Добавляем пользователя в request
    req.user = {
      id: user.id,
      email: user.email,
      login: user.login,
      name: user.name,
      role: user.role,
      departments: user.departments
    }
    
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired' 
      })
    }
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    })
  }
}

/**
 * Middleware для проверки роли администратора
 */
export const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'Administrator') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    })
  }
  next()
}

/**
 * Middleware для проверки доступа к отделу
 */
export const departmentAccessMiddleware = (req, res, next) => {
  const { departmentId } = req.params
  
  if (req.user?.role === 'admin' || req.user?.role === 'Administrator') {
    return next()
  }
  
  const userDepts = req.user?.departments || []
  if (!userDepts.includes(departmentId)) {
    return res.status(403).json({ 
      success: false, 
      error: 'No access to this department' 
    })
  }
  
  next()
}

export default authMiddleware
