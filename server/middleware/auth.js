/**
 * FreshTrack Auth Middleware
 * Multi-hotel role-based access control
 * PostgreSQL async version
 */

import jwt from 'jsonwebtoken'
import { getUserById, getHotelById, getDepartmentById, query } from '../db/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'freshtrack_pilot_secret_2024'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

/**
 * Generate JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id,
      login: user.login,
      role: user.role,
      hotel_id: user.hotel_id,
      department_id: user.department_id
    }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

/**
 * Main auth middleware - ASYNC
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authorization required' 
      })
    }
    
    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      })
    }
    
    // Load fresh user data (async)
    const user = await getUserById(decoded.id)
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        error: 'User account is disabled' 
      })
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      role: user.role,
      hotel_id: user.hotel_id,
      department_id: user.department_id
    }
    
    // Load hotel info if user has hotel_id
    if (user.hotel_id) {
      const hotel = await getHotelById(user.hotel_id)
      if (hotel) {
        req.user.hotel = hotel
      }
    }
    
    // Load department info if user has department_id
    if (user.department_id) {
      const department = await getDepartmentById(user.department_id)
      if (department) {
        req.user.department = department
      }
    }
    
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    })
  }
}

/**
 * Super Admin only middleware
 */
export const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      success: false, 
      error: 'Super Admin access required' 
    })
  }
  next()
}

/**
 * Hotel Admin or higher middleware
 */
export const hotelAdminOnly = (req, res, next) => {
  const allowedRoles = ['SUPER_ADMIN', 'HOTEL_ADMIN']
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Hotel Admin access required' 
    })
  }
  next()
}

/**
 * Admin middleware (for backward compatibility)
 */
export const adminMiddleware = hotelAdminOnly

/**
 * Hotel isolation middleware - ASYNC
 */
export const hotelIsolation = async (req, res, next) => {
  // Super Admin can access any hotel
  if (req.user?.role === 'SUPER_ADMIN') {
    req.hotelId = req.query.hotel_id || req.body?.hotel_id || req.params?.hotelId || null
    
    // If no hotel specified, auto-select first active hotel
    if (!req.hotelId) {
      try {
        const result = await query('SELECT id FROM hotels WHERE is_active = TRUE LIMIT 1')
        if (result.rows.length > 0) {
          req.hotelId = result.rows[0].id
        }
      } catch (error) {
        console.error('Error auto-selecting hotel for SUPER_ADMIN:', error)
      }
    }
    return next()
  }
  
  // Other users can only access their own hotel
  if (!req.user?.hotel_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'No hotel assigned to user' 
    })
  }
  
  req.hotelId = req.user.hotel_id
  
  const requestedHotelId = req.query.hotel_id || req.body?.hotel_id || req.params?.hotelId
  if (requestedHotelId && requestedHotelId !== req.user.hotel_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied to this hotel' 
    })
  }
  
  next()
}

/**
 * Department isolation middleware
 */
export const departmentIsolation = (req, res, next) => {
  // Super Admin and Hotel Admin can access any department within hotel
  if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(req.user?.role)) {
    req.departmentId = req.query.department_id || req.body?.department_id || req.params?.departmentId || null
    return next()
  }
  
  // Staff can only access their own department
  if (!req.user?.department_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'No department assigned to user' 
    })
  }
  
  req.departmentId = req.user.department_id
  
  const requestedDeptId = req.query.department_id || req.body?.department_id || req.params?.departmentId
  if (requestedDeptId && requestedDeptId !== req.user.department_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied to this department' 
    })
  }
  
  next()
}

/**
 * Department access middleware (for backward compatibility)
 */
export const departmentAccessMiddleware = (req, res, next) => {
  const { departmentId } = req.params
  
  if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(req.user?.role)) {
    return next()
  }
  
  if (req.user?.department_id !== departmentId) {
    return res.status(403).json({ 
      success: false, 
      error: 'No access to this department' 
    })
  }
  
  next()
}

/**
 * Check if user has specific role
 */
export function hasRole(user, roles) {
  if (typeof roles === 'string') {
    roles = [roles]
  }
  return roles.includes(user?.role)
}

/**
 * Check if user can access hotel
 */
export function canAccessHotel(user, hotelId) {
  if (user.role === 'SUPER_ADMIN') return true
  return user.hotel_id === hotelId
}

/**
 * Check if user can access department
 */
export function canAccessDepartment(user, departmentId) {
  if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(user.role)) return true
  return user.department_id === departmentId
}

export default authMiddleware
