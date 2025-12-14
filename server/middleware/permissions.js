/**
 * FreshTrack Enterprise Permissions Middleware
 * Role-based access control (RBAC)
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
    const userRole = req.user.role?.toLowerCase()
    
    // Super admin and admin have all permissions
    if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'administrator') {
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

    const userRole = req.user.role?.toLowerCase()
    const normalizedRoles = roles.map(r => r.toLowerCase())
    
    // Always allow super_admin
    if (userRole === 'super_admin') {
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
 * Require admin role
 */
export function requireAdmin() {
  return requireRole('admin', 'administrator', 'super_admin')
}

/**
 * Require manager or higher role
 */
export function requireManager() {
  return requireRole('admin', 'administrator', 'super_admin', 'manager')
}

/**
 * Check if user has access to specific property
 */
export function requirePropertyAccess(propertyIdParam = 'propertyId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const userRole = req.user.role?.toLowerCase()
    
    // Super admin and chain admin have access to all properties
    if (['super_admin', 'chain_admin', 'admin', 'administrator'].includes(userRole)) {
      return next()
    }
    
    const propertyId = req.params[propertyIdParam] || req.body?.property_id || req.query?.property_id
    
    if (!propertyId) {
      return next() // No specific property required
    }
    
    // Check if user has access to this property
    const userProperties = req.user.properties || []
    const hasAccess = userProperties.some(p => 
      p.property_id === parseInt(propertyId) || p.property_id === propertyId
    )
    
    if (!hasAccess && req.user.property_id !== parseInt(propertyId)) {
      return res.status(403).json({ 
        error: 'Property access denied',
        message: `You don't have access to this property`
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

    const userRole = req.user.role?.toLowerCase()
    
    // Admin roles have access to all departments
    if (['super_admin', 'admin', 'administrator', 'property_admin'].includes(userRole)) {
      return next()
    }
    
    const departmentId = req.params[departmentIdParam] || req.body?.department_id || req.query?.department_id
    
    if (!departmentId) {
      return next() // No specific department required
    }
    
    // Check if user has access to this department
    const userDepartments = req.user.departments || []
    const hasAccess = userDepartments.includes(departmentId) || 
                      req.user.department_id === departmentId
    
    if (!hasAccess) {
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
  requirePropertyAccess,
  requireDepartmentAccess
}
