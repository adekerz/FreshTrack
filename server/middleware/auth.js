/**
 * FreshTrack Auth Middleware
 * Multi-hotel role-based access control
 * PostgreSQL async version
 */

import jwt from 'jsonwebtoken'
import { getUserById, getHotelById, getDepartmentById, query } from '../db/database.js'
import { logError, logWarn } from '../utils/logger.js'

// SECURITY: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  logError('Auth', new Error('JWT_SECRET environment variable is required!'))
  // In production, throw error. In development, use fallback with warning
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

/**
 * Permission Scopes - defines access boundaries
 */
export const PermissionScope = {
  OWN: 'own',              // Only own records (created by user)
  DEPARTMENT: 'department', // Within user's department
  HOTEL: 'hotel',           // Within user's hotel
  ALL: 'all'               // System-wide (no restrictions)
}

/**
 * Role hierarchy with default permission scopes
 */
export const ROLES = {
  SUPER_ADMIN: {
    name: 'SUPER_ADMIN',
    level: 100,
    defaultScope: PermissionScope.ALL
  },
  HOTEL_ADMIN: {
    name: 'HOTEL_ADMIN',
    level: 80,
    defaultScope: PermissionScope.HOTEL
  },
  DEPARTMENT_MANAGER: {
    name: 'DEPARTMENT_MANAGER',
    level: 50,
    defaultScope: PermissionScope.DEPARTMENT
  },
  STAFF: {
    name: 'STAFF',
    level: 10,
    defaultScope: PermissionScope.DEPARTMENT
  }
}

/**
 * Get permission scope for a role
 */
export function getRoleScope(role) {
  return ROLES[role]?.defaultScope || PermissionScope.OWN
}

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
    logError('Auth', error)
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
 * @deprecated Use requirePermission() instead. This middleware uses hardcoded role checks.
 */
export const hotelAdminOnly = (req, res, next) => {
  console.warn('DEPRECATED: hotelAdminOnly middleware used. Migrate to requirePermission()')
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
 * Department Manager or higher middleware
 * @deprecated Use requirePermission() instead. This middleware uses hardcoded role checks.
 */
export const departmentManagerOnly = (req, res, next) => {
  console.warn('DEPRECATED: departmentManagerOnly middleware used. Migrate to requirePermission()')
  const allowedRoles = ['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Department Manager access required' 
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
        logError('Auth', error)
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
 * Enforces department-level data isolation based on user role
 */
export const departmentIsolation = (req, res, next) => {
  // Super Admin and Hotel Admin can access any department within hotel
  if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(req.user?.role)) {
    req.departmentId = req.query.department_id || req.body?.department_id || req.params?.departmentId || null
    req.canAccessAllDepartments = true
    return next()
  }
  
  // DEPARTMENT_MANAGER can manage their own department
  if (req.user?.role === 'DEPARTMENT_MANAGER') {
    if (!req.user?.department_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'No department assigned to manager' 
      })
    }
    
    req.departmentId = req.user.department_id
    req.canAccessAllDepartments = false
    
    // DEPARTMENT_MANAGER can only access their own department
    const requestedDeptId = req.query.department_id || req.body?.department_id || req.params?.departmentId
    if (requestedDeptId && requestedDeptId !== req.user.department_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this department' 
      })
    }
    
    return next()
  }
  
  // STAFF can only access their own department (read-only for most operations)
  if (!req.user?.department_id) {
    return res.status(403).json({ 
      success: false, 
      error: 'No department assigned to user' 
    })
  }
  
  req.departmentId = req.user.department_id
  req.canAccessAllDepartments = false
  
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
  if (user.role === 'DEPARTMENT_MANAGER') return user.department_id === departmentId
  return user.department_id === departmentId
}

/**
 * Get user's access context for queries
 */
export function getUserContext(req) {
  return {
    hotelId: req.hotelId,
    departmentId: req.departmentId,
    role: req.user?.role,
    userId: req.user?.id,
    canAccessAllDepartments: req.canAccessAllDepartments || false
  }
}

// ═══════════════════════════════════════════════════════════════
// PERMISSION-BASED ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════

/**
 * Permission Resources
 */
export const PermissionResource = {
  INVENTORY: 'inventory',
  PRODUCTS: 'products',
  BATCHES: 'batches',
  CATEGORIES: 'categories',
  COLLECTIONS: 'collections',
  USERS: 'users',
  DEPARTMENTS: 'departments',
  SETTINGS: 'settings',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  WRITE_OFFS: 'write_offs',
  AUDIT: 'audit',
  HOTELS: 'hotels',
  EXPORT: 'export',
  DELIVERY_TEMPLATES: 'delivery_templates'
}

/**
 * Permission Actions
 */
export const PermissionAction = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  EXPORT: 'export',
  MANAGE: 'manage',
  COLLECT: 'collect'
}

// Permission cache
const permissionCache = new Map()
const PERMISSION_CACHE_TTL = 30 * 1000 // 30 seconds - shorter TTL for faster permission updates

/**
 * Get permissions for role (with caching)
 */
async function getRolePermissions(role) {
  const cacheKey = `role:${role}`
  const cached = permissionCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < PERMISSION_CACHE_TTL) {
    return cached.permissions
  }
  
  try {
    const result = await query(`
      SELECT p.resource, p.action, p.scope
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role = $1
    `, [role])
    
    const permissions = result.rows
    permissionCache.set(cacheKey, { permissions, timestamp: Date.now() })
    return permissions
  } catch (error) {
    // If permissions table doesn't exist yet, fall back to role-based check
    console.warn('Permission table not found, using role-based fallback')
    return null
  }
}

/**
 * Check scope validity
 */
function checkScopeValidity(user, scope, targetHotelId, targetDepartmentId, targetUserId) {
  switch (scope) {
    case PermissionScope.ALL:
      return true
    case PermissionScope.HOTEL:
      if (!targetHotelId) return true
      return user.hotel_id === targetHotelId
    case PermissionScope.DEPARTMENT:
      if (targetHotelId && user.hotel_id && user.hotel_id !== targetHotelId) return false
      if (!targetDepartmentId) return true
      if (!user.department_id) return true // User has hotel-level access without department restriction
      return user.department_id === targetDepartmentId
    case PermissionScope.OWN:
      if (!targetUserId) return false
      return user.id === targetUserId
    default:
      return false
  }
}

/**
 * Check if user has permission
 */
export async function hasPermission(user, resource, action, targets = {}) {
  const { targetHotelId, targetDepartmentId, targetUserId } = targets
  
  // Ensure user object has required properties
  if (!user || !user.role) {
    return false
  }
  
  // SUPER_ADMIN always has full access - check first before DB lookup
  if (user.role === 'SUPER_ADMIN') {
    return true
  }
  
  // HOTEL_ADMIN has full access within their hotel
  if (user.role === 'HOTEL_ADMIN') {
    // If no target hotel specified, or it matches user's hotel, grant access
    if (!targetHotelId || targetHotelId === user.hotel_id) {
      return true
    }
  }
  
  // Get role permissions from DB
  const permissions = await getRolePermissions(user.role)
  
  // Fallback to strict deny if permissions not loaded
  if (!permissions) {
    // SUPER_ADMIN always has full access as a safety net
    if (user.role === 'SUPER_ADMIN') {
      console.warn('Permission DB unavailable, SUPER_ADMIN granted fallback access')
      return true
    }
    
    // All other roles: deny access when permission DB is unavailable
    console.error(`Permission DB unavailable, denying access for ${user.role} to ${resource}:${action}`)
    return false
  }
  
  // Check for exact permission or manage permission
  for (const perm of permissions) {
    if (perm.resource === resource && (perm.action === action || perm.action === 'manage')) {
      if (checkScopeValidity(user, perm.scope, targetHotelId, targetDepartmentId, targetUserId)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Middleware factory: require specific permission
 * @param {string} resource - Resource type (from PermissionResource)
 * @param {string} action - Action type (from PermissionAction)
 * @param {Object} options - { getTargetHotelId, getTargetDepartmentId, getTargetUserId }
 */
export function requirePermission(resource, action, options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        })
      }
      
      // Extract target IDs from request
      const targetHotelId = options.getTargetHotelId 
        ? options.getTargetHotelId(req) 
        : req.hotelId || req.query?.hotel_id || req.body?.hotel_id || req.params?.hotelId
      
      const targetDepartmentId = options.getTargetDepartmentId 
        ? options.getTargetDepartmentId(req) 
        : req.departmentId || req.query?.department_id || req.body?.department_id || req.body?.department || req.params?.departmentId
      
      const targetUserId = options.getTargetUserId 
        ? options.getTargetUserId(req) 
        : req.params?.userId || req.params?.id
      
      const allowed = await hasPermission(req.user, resource, action, {
        targetHotelId,
        targetDepartmentId,
        targetUserId
      })
      
      if (!allowed) {
        return res.status(403).json({ 
          success: false, 
          error: `Permission denied: ${resource}:${action}`,
          required: { resource, action }
        })
      }
      
      // Attach permission context to request
      req.permissionContext = {
        resource,
        action,
        targetHotelId,
        targetDepartmentId,
        targetUserId
      }
      
      next()
    } catch (error) {
      logError('Auth', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Permission check failed' 
      })
    }
  }
}

/**
 * Helper: require any of the specified permissions
 */
export function requireAnyPermission(checks) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    
    for (const { resource, action, options = {} } of checks) {
      const targetHotelId = options.getTargetHotelId?.(req) || req.hotelId
      const targetDepartmentId = options.getTargetDepartmentId?.(req) || req.departmentId
      const targetUserId = options.getTargetUserId?.(req)
      
      if (await hasPermission(req.user, resource, action, { targetHotelId, targetDepartmentId, targetUserId })) {
        return next()
      }
    }
    
    return res.status(403).json({ 
      success: false, 
      error: 'Permission denied: none of required permissions granted' 
    })
  }
}

/**
 * Clear permission cache (call after role/permission changes)
 */
export function clearPermissionCache() {
  permissionCache.clear()
}

export default authMiddleware


