/**
 * FreshTrack Role Constants
 * Centralized role definitions to avoid hardcoding
 */

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOTEL_ADMIN: 'HOTEL_ADMIN',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  STAFF: 'STAFF'
}

// Roles that have hotel-wide access
export const HOTEL_WIDE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOTEL_ADMIN
]

// Roles that can manage users
export const USER_MANAGEMENT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOTEL_ADMIN
]

// All available roles for selection
export const ALL_ROLES = Object.values(UserRole)

/**
 * Helper functions for role checking
 * Use these instead of hardcoded role comparisons
 */
export function isSuperAdmin(user) {
  return user?.role?.toUpperCase() === UserRole.SUPER_ADMIN
}

export function isHotelAdmin(user) {
  return user?.role?.toUpperCase() === UserRole.HOTEL_ADMIN
}

export function isAdmin(user) {
  const role = user?.role?.toUpperCase()
  return role === UserRole.SUPER_ADMIN || role === UserRole.HOTEL_ADMIN
}

export function isDepartmentManager(user) {
  return user?.role?.toUpperCase() === UserRole.DEPARTMENT_MANAGER
}

export function isStaff(user) {
  return user?.role?.toUpperCase() === UserRole.STAFF
}

export function hasHotelWideAccess(user) {
  const role = user?.role?.toUpperCase()
  return HOTEL_WIDE_ROLES.includes(role)
}

export function canManageUsers(user) {
  const role = user?.role?.toUpperCase()
  return USER_MANAGEMENT_ROLES.includes(role)
}

export function canAccessAllDepartments(user) {
  return user?.canAccessAllDepartments || hasHotelWideAccess(user)
}

/**
 * SSE Event Types
 * Centralized event type definitions for real-time updates
 */
export const SSE_EVENTS = {
  // System events
  CONNECTED: 'connected',
  INIT: 'init',

  // Branding & Settings
  BRANDING_UPDATE: 'branding-update',
  SETTINGS_UPDATE: 'settings-update',

  // Inventory (Products)
  PRODUCT_CREATED: 'product-created',
  PRODUCT_UPDATED: 'product-updated',
  PRODUCT_DELETED: 'product-deleted',

  // Batches
  BATCH_ADDED: 'batch-added',
  BATCH_UPDATED: 'batch-updated',

  // Write-offs
  WRITE_OFF: 'write-off',
  BULK_WRITE_OFF: 'bulk-write-off',

  // Expiry alerts
  EXPIRING_CRITICAL: 'expiring-critical',
  EXPIRING_WARNING: 'expiring-warning',
  EXPIRED: 'expired',

  // Users (admins only)
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',

  // Dashboard
  STATS_UPDATE: 'stats-update',

  // Generic notifications
  NOTIFICATION: 'notification'
}

/**
 * SSE Audience types
 */
export const SSE_AUDIENCE = {
  ALL_HOTEL: 'all',      // All users in hotel
  ADMINS_ONLY: 'admins', // Only admins
  USER: 'user'           // Specific user
}

export default UserRole
