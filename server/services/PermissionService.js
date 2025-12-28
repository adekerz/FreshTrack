/**
 * FreshTrack Permission Service
 * Granular permission checking with scope validation
 * 
 * Resources: inventory, products, batches, users, departments, settings, reports, notifications, write_offs, audit, hotels
 * Actions: read, create, update, delete, export, manage, collect
 * Scopes: own, department, hotel, all
 */

import { query } from '../db/database.js'

/**
 * Permission Resources
 */
export const PermissionResource = {
  INVENTORY: 'inventory',
  PRODUCTS: 'products',
  BATCHES: 'batches',
  CATEGORIES: 'categories',
  USERS: 'users',
  DEPARTMENTS: 'departments',
  SETTINGS: 'settings',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
  WRITE_OFFS: 'write_offs',
  AUDIT: 'audit',
  HOTELS: 'hotels'
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

/**
 * Permission Scopes (already defined in auth.js, re-exported here)
 */
export const PermissionScope = {
  OWN: 'own',
  DEPARTMENT: 'department',
  HOTEL: 'hotel',
  ALL: 'all'
}

// Cache for role permissions (TTL-based)
const permissionCache = new Map()
const CACHE_TTL = 30 * 1000 // 30 seconds - short TTL for permission changes to propagate quickly

/**
 * Get permissions for a role (with caching)
 */
async function getRolePermissions(role) {
  const cacheKey = `role:${role}`
  const cached = permissionCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions
  }
  
  const result = await query(`
    SELECT p.resource, p.action, p.scope
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role = $1
  `, [role])
  
  const permissions = result.rows
  permissionCache.set(cacheKey, { permissions, timestamp: Date.now() })
  
  return permissions
}

/**
 * Clear permission cache (call after permission changes)
 */
export function clearPermissionCache() {
  permissionCache.clear()
}

/**
 * Permission Service
 */
export class PermissionService {
  
  /**
   * Check if user has permission for resource/action
   * @param {Object} context - { user, targetHotelId, targetDepartmentId, targetUserId }
   * @param {string} resource - Resource type
   * @param {string} action - Action type
   * @returns {Promise<boolean>}
   */
  static async hasPermission(context, resource, action) {
    const { user, targetHotelId, targetDepartmentId, targetUserId } = context
    
    if (!user || !user.role) {
      return false
    }
    
    // Get all permissions for user's role
    const permissions = await getRolePermissions(user.role)
    
    // Find matching permission
    for (const permission of permissions) {
      if (permission.resource === resource && permission.action === action) {
        // Check if scope allows access
        const scopeValid = await this.checkScope(user, permission.scope, {
          targetHotelId,
          targetDepartmentId,
          targetUserId
        })
        
        if (scopeValid) {
          return true
        }
      }
    }
    
    // Check for 'manage' permission which grants all actions
    for (const permission of permissions) {
      if (permission.resource === resource && permission.action === 'manage') {
        const scopeValid = await this.checkScope(user, permission.scope, {
          targetHotelId,
          targetDepartmentId,
          targetUserId
        })
        
        if (scopeValid) {
          return true
        }
      }
    }
    
    return false
  }
  
  /**
   * Check if scope allows access based on context
   * @param {Object} user - User object with hotel_id, department_id
   * @param {string} scope - Permission scope
   * @param {Object} target - { targetHotelId, targetDepartmentId, targetUserId }
   * @returns {Promise<boolean>}
   */
  static async checkScope(user, scope, target) {
    const { targetHotelId, targetDepartmentId, targetUserId } = target
    
    switch (scope) {
      case PermissionScope.ALL:
        // System-wide access - always allowed
        return true
        
      case PermissionScope.HOTEL:
        // Must be same hotel
        if (!targetHotelId) return true // No target specified, allow
        return user.hotel_id === targetHotelId
        
      case PermissionScope.DEPARTMENT:
        // Must be same hotel AND same department
        if (targetHotelId && user.hotel_id !== targetHotelId) {
          return false
        }
        if (!targetDepartmentId) return true // No target specified, allow
        return user.department_id === targetDepartmentId
        
      case PermissionScope.OWN:
        // Must be own record (for user profile updates)
        if (!targetUserId) return false
        return user.id === targetUserId
        
      default:
        return false
    }
  }
  
  /**
   * Get user's permission scope for a resource/action
   * Returns the highest scope level granted
   */
  static async getPermissionScope(user, resource, action) {
    const permissions = await getRolePermissions(user.role)
    
    // Priority: all > hotel > department > own
    const scopePriority = {
      [PermissionScope.ALL]: 4,
      [PermissionScope.HOTEL]: 3,
      [PermissionScope.DEPARTMENT]: 2,
      [PermissionScope.OWN]: 1
    }
    
    let highestScope = null
    let highestPriority = 0
    
    for (const permission of permissions) {
      if (permission.resource === resource && 
          (permission.action === action || permission.action === 'manage')) {
        const priority = scopePriority[permission.scope] || 0
        if (priority > highestPriority) {
          highestPriority = priority
          highestScope = permission.scope
        }
      }
    }
    
    return highestScope
  }
  
  /**
   * Get all permissions for a user's role
   */
  static async getUserPermissions(user) {
    return getRolePermissions(user.role)
  }
  
  /**
   * Check multiple permissions at once
   */
  static async hasAnyPermission(context, checks) {
    for (const { resource, action } of checks) {
      if (await this.hasPermission(context, resource, action)) {
        return true
      }
    }
    return false
  }
  
  /**
   * Check all permissions must pass
   */
  static async hasAllPermissions(context, checks) {
    for (const { resource, action } of checks) {
      if (!await this.hasPermission(context, resource, action)) {
        return false
      }
    }
    return true
  }
}

export default PermissionService
