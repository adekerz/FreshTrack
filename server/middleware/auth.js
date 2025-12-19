/**
 * FreshTrack Auth Middleware
 * Multi-hotel role-based access control
 * 
 * Roles:
 * - SUPER_ADMIN: Full system access, all hotels
 * - HOTEL_ADMIN: Full access to own hotel
 * - STAFF: Access to own department only
 */

import jwt from 'jsonwebtoken'
import { getUserById, getHotelById, getDepartmentById, db } from '../db/database.js'

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
 * Main auth middleware
 * Validates JWT and loads user data
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
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      })
    }
    
    // Load fresh user data
    const user = getUserById(decoded.id)
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
      const hotel = getHotelById(user.hotel_id)
      if (hotel) {
        req.user.hotel = hotel
      }
    }
    
    // Load department info if user has department_id
    if (user.department_id) {
      const department = getDepartmentById(user.department_id)
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
 * Only SUPER_ADMIN can access
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
 * SUPER_ADMIN or HOTEL_ADMIN can access
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
 * SUPER_ADMIN or HOTEL_ADMIN can access
 */
export const adminMiddleware = hotelAdminOnly

/**
 * Hotel isolation middleware
 * Ensures user can only access data from their hotel
 * SUPER_ADMIN bypasses this check
 * 
 * Sets req.hotelId for use in route handlers
 */
export const hotelIsolation = (req, res, next) => {
  // Super Admin can access any hotel
  if (req.user?.role === 'SUPER_ADMIN') {
    // If hotel_id is specified in query/body/params, use it
    req.hotelId = req.query.hotel_id || req.body?.hotel_id || req.params?.hotelId || null
    
    // If no hotel specified, auto-select first active hotel
    if (!req.hotelId) {
      try {
        const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
        if (firstHotel) {
          req.hotelId = firstHotel.id
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
  
  // Set hotel_id for route handlers
  req.hotelId = req.user.hotel_id
  
  // Validate that requested hotel_id matches user's hotel
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
 * Ensures STAFF can only access data from their department
 * SUPER_ADMIN and HOTEL_ADMIN bypass this check
 * 
 * Sets req.departmentId for use in route handlers
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
  
  // Set department_id for route handlers
  req.departmentId = req.user.department_id
  
  // Validate that requested department_id matches user's department
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
  
  // Admins can access any department
  if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(req.user?.role)) {
    return next()
  }
  
  // Staff can only access their own department
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
