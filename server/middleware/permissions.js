/**
 * FreshTrack Enterprise Permissions Middleware
 * Role-based access control (RBAC)
 * Roles: SUPER_ADMIN, HOTEL_ADMIN, STAFF (uppercase)
 */

/**
 * Check if user has required permission
 */
export function checkPermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userPermissions = req.user.permissions || []
    const userRole = req.user.role?.toUpperCase()
    
    // Super admin and hotel admin have all permissions
    if (userRole === 'SUPER_ADMIN' || userRole === 'HOTEL_ADMIN') {
      return next()
    }
    
    // Check for wildcard permission
    if (userPermissions.includes('*')) {
      return next()
    }
    
    // Check specific permission
    const hasPermission = userPermissions.some(p => {
      if (p === requiredPermission) return true
      
      // Check wildcard patterns (e.g., 'inventory.*' matches 'inventory.view')
      if (p.endsWith('.*')) {
        const prefix = p.slice(0, -2)
        return requiredPermission.startsWith(prefix)
      }
      return false
    })
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Access denied',
        required: requiredPermission,
        message: `You don't have permission to perform this action`
      })
    }
    
    next()
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userRole = req.user.role?.toUpperCase()
    const normalizedRoles = roles.map(r => r.toUpperCase())
    
    // Always allow SUPER_ADMIN
    if (userRole === 'SUPER_ADMIN') {
      return next()
    }
    
    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient role',
        required: roles,
        current: req.user.role
      })
    }
    
    next()
  }
}

/**
 * Require admin role (SUPER_ADMIN or HOTEL_ADMIN)
 */
export function requireAdmin() {
  return requireRole('SUPER_ADMIN', 'HOTEL_ADMIN')
}

/**
 * Require manager or higher role
 */
export function requireManager() {
  return requireRole('SUPER_ADMIN', 'HOTEL_ADMIN')
}

/**
 * Check if user has access to specific hotel
 */
export function requireHotelAccess(hotelIdParam = 'hotelId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userRole = req.user.role?.toUpperCase()
    
    // Super admin has access to all hotels
    if (userRole === 'SUPER_ADMIN') {
      return next()
    }
    
    const hotelId = req.params[hotelIdParam] || req.body?.hotel_id || req.query?.hotel_id
    
    if (!hotelId) {
      return next() // No specific hotel required
    }
    
    // Check if user has access to this hotel
    if (req.user.hotel_id !== hotelId) {
      return res.status(403).json({ 
        error: 'Hotel access denied',
        message: `You don't have access to this hotel`
      })
    }
    
    next()
  }
}

/**
 * Check if user has access to specific department
 */
export function requireDepartmentAccess(departmentIdParam = 'departmentId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userRole = req.user.role?.toUpperCase()
    
    // Admin roles have access to all departments
    if (['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(userRole)) {
      return next()
    }
    
    const departmentId = req.params[departmentIdParam] || req.body?.department_id || req.query?.department_id
    
    if (!departmentId) {
      return next() // No specific department required
    }
    
    // STAFF can only access their own department
    if (req.user.department_id !== departmentId) {
      return res.status(403).json({ 
        error: 'Department access denied',
        message: `You don't have access to this department`
      })
    }
    
    next()
  }
}

export default {
  checkPermission,
  requireRole,
  requireAdmin,
  requireManager,
  requireHotelAccess,
  requireDepartmentAccess
}
