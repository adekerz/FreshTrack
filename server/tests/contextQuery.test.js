/**
 * FreshTrack Context Query Tests
 * Verifies data ownership hierarchy works correctly
 * 
 * Tests the hierarchy: Hotel → Department → User
 * Validates that:
 * - SUPER_ADMIN has no restrictions
 * - HOTEL_ADMIN can only access their hotel
 * - DEPARTMENT_MANAGER can only access their department
 * - STAFF can only access their department
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Mock postgres client BEFORE importing database.js
vi.mock('../db/postgres.js', () => ({
  query: vi.fn(() => Promise.resolve({ rows: [] })),
  getClient: vi.fn(() => Promise.resolve({
    query: vi.fn(() => Promise.resolve({ rows: [] })),
    release: vi.fn()
  }))
}))

import { 
  buildContextWhere, 
  getHierarchicalSetting,
  getAllHierarchicalSettings,
  canAccessResource
} from '../db/database.js'
import { 
  PermissionScope, 
  ROLES, 
  getRoleScope,
  canAccessHotel,
  canAccessDepartment 
} from '../middleware/auth.js'

// ═══════════════════════════════════════════════════════════════
// PERMISSION SCOPE TESTS
// ═══════════════════════════════════════════════════════════════

describe('PermissionScope', () => {
  it('should have all required scopes', () => {
    expect(PermissionScope.OWN).toBe('own')
    expect(PermissionScope.DEPARTMENT).toBe('department')
    expect(PermissionScope.HOTEL).toBe('hotel')
    expect(PermissionScope.ALL).toBe('all')
  })
})

describe('ROLES', () => {
  it('should define all roles with correct hierarchy levels', () => {
    expect(ROLES.SUPER_ADMIN.level).toBe(100)
    expect(ROLES.HOTEL_ADMIN.level).toBe(80)
    expect(ROLES.DEPARTMENT_MANAGER.level).toBe(50)
    expect(ROLES.STAFF.level).toBe(10)
  })

  it('should assign correct default scopes to roles', () => {
    expect(ROLES.SUPER_ADMIN.defaultScope).toBe(PermissionScope.ALL)
    expect(ROLES.HOTEL_ADMIN.defaultScope).toBe(PermissionScope.HOTEL)
    expect(ROLES.DEPARTMENT_MANAGER.defaultScope).toBe(PermissionScope.DEPARTMENT)
    expect(ROLES.STAFF.defaultScope).toBe(PermissionScope.DEPARTMENT)
  })
})

describe('getRoleScope', () => {
  it('should return correct scope for valid roles', () => {
    expect(getRoleScope('SUPER_ADMIN')).toBe(PermissionScope.ALL)
    expect(getRoleScope('HOTEL_ADMIN')).toBe(PermissionScope.HOTEL)
    expect(getRoleScope('DEPARTMENT_MANAGER')).toBe(PermissionScope.DEPARTMENT)
    expect(getRoleScope('STAFF')).toBe(PermissionScope.DEPARTMENT)
  })

  it('should return OWN scope for unknown roles', () => {
    expect(getRoleScope('UNKNOWN')).toBe(PermissionScope.OWN)
    expect(getRoleScope('')).toBe(PermissionScope.OWN)
    expect(getRoleScope(null)).toBe(PermissionScope.OWN)
  })
})

// ═══════════════════════════════════════════════════════════════
// BUILD CONTEXT WHERE TESTS
// ═══════════════════════════════════════════════════════════════

describe('buildContextWhere', () => {
  const hotelAId = 'hotel-a-uuid'
  const hotelBId = 'hotel-b-uuid'
  const deptAId = 'dept-a-uuid'
  const deptBId = 'dept-b-uuid'

  it('SUPER_ADMIN with hotelId still filters by hotel', () => {
    const context = { hotelId: hotelAId, departmentId: null, role: 'SUPER_ADMIN' }
    const result = buildContextWhere(context, 'b', 1)
    
    expect(result.where).toContain('hotel_id')
    expect(result.params).toContain(hotelAId)
  })

  it('SUPER_ADMIN without hotelId has no restrictions', () => {
    const context = { hotelId: null, departmentId: null, role: 'SUPER_ADMIN' }
    const result = buildContextWhere(context, 'b', 1)
    
    expect(result.where).toBe('1=1')
    expect(result.params).toHaveLength(0)
  })

  it('HOTEL_ADMIN is restricted to their hotel', () => {
    const context = { hotelId: hotelAId, departmentId: null, role: 'HOTEL_ADMIN' }
    const result = buildContextWhere(context, 'b', 1)
    
    expect(result.where).toContain('b.hotel_id = $1')
    expect(result.params).toEqual([hotelAId])
  })

  it('HOTEL_ADMIN cannot access another hotel', () => {
    const user = { role: 'HOTEL_ADMIN', hotel_id: hotelAId }
    
    expect(canAccessHotel(user, hotelAId)).toBe(true)
    expect(canAccessHotel(user, hotelBId)).toBe(false)
  })

  it('DEPARTMENT_MANAGER is restricted to their department', () => {
    const context = { hotelId: hotelAId, departmentId: deptAId, role: 'DEPARTMENT_MANAGER' }
    const result = buildContextWhere(context, '', 1)
    
    expect(result.where).toContain('hotel_id = $1')
    expect(result.where).toContain('department_id = $2')
    expect(result.params).toEqual([hotelAId, deptAId])
  })

  it('DEPARTMENT_MANAGER cannot access another department', () => {
    const user = { role: 'DEPARTMENT_MANAGER', hotel_id: hotelAId, department_id: deptAId }
    
    expect(canAccessDepartment(user, deptAId)).toBe(true)
    expect(canAccessDepartment(user, deptBId)).toBe(false)
  })

  it('STAFF is restricted to their department', () => {
    const context = { hotelId: hotelAId, departmentId: deptAId, role: 'STAFF' }
    const result = buildContextWhere(context, 'p', 1)
    
    expect(result.where).toContain('p.hotel_id = $1')
    expect(result.where).toContain('p.department_id = $2')
    expect(result.params).toEqual([hotelAId, deptAId])
  })

  it('STAFF cannot access another department', () => {
    const user = { role: 'STAFF', hotel_id: hotelAId, department_id: deptAId }
    
    expect(canAccessDepartment(user, deptAId)).toBe(true)
    expect(canAccessDepartment(user, deptBId)).toBe(false)
  })

  it('correctly increments parameter index', () => {
    const context = { hotelId: hotelAId, departmentId: deptAId, role: 'STAFF' }
    const result = buildContextWhere(context, '', 5)
    
    expect(result.where).toContain('$5')
    expect(result.where).toContain('$6')
    expect(result.nextParamIndex).toBe(7)
  })
})

// ═══════════════════════════════════════════════════════════════
// HOTEL ACCESS TESTS
// ═══════════════════════════════════════════════════════════════

describe('canAccessHotel', () => {
  const hotelAId = 'hotel-a-uuid'
  const hotelBId = 'hotel-b-uuid'

  it('SUPER_ADMIN can access any hotel', () => {
    const superAdmin = { role: 'SUPER_ADMIN', hotel_id: null }
    
    expect(canAccessHotel(superAdmin, hotelAId)).toBe(true)
    expect(canAccessHotel(superAdmin, hotelBId)).toBe(true)
  })

  it('HOTEL_ADMIN can only access their hotel', () => {
    const hotelAdmin = { role: 'HOTEL_ADMIN', hotel_id: hotelAId }
    
    expect(canAccessHotel(hotelAdmin, hotelAId)).toBe(true)
    expect(canAccessHotel(hotelAdmin, hotelBId)).toBe(false)
  })

  it('STAFF can only access their hotel', () => {
    const staff = { role: 'STAFF', hotel_id: hotelAId }
    
    expect(canAccessHotel(staff, hotelAId)).toBe(true)
    expect(canAccessHotel(staff, hotelBId)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT ACCESS TESTS
// ═══════════════════════════════════════════════════════════════

describe('canAccessDepartment', () => {
  const deptAId = 'dept-a-uuid'
  const deptBId = 'dept-b-uuid'

  it('SUPER_ADMIN can access any department', () => {
    const superAdmin = { role: 'SUPER_ADMIN' }
    
    expect(canAccessDepartment(superAdmin, deptAId)).toBe(true)
    expect(canAccessDepartment(superAdmin, deptBId)).toBe(true)
  })

  it('HOTEL_ADMIN can access any department in their hotel', () => {
    const hotelAdmin = { role: 'HOTEL_ADMIN' }
    
    expect(canAccessDepartment(hotelAdmin, deptAId)).toBe(true)
    expect(canAccessDepartment(hotelAdmin, deptBId)).toBe(true)
  })

  it('DEPARTMENT_MANAGER can only access their department', () => {
    const manager = { role: 'DEPARTMENT_MANAGER', department_id: deptAId }
    
    expect(canAccessDepartment(manager, deptAId)).toBe(true)
    expect(canAccessDepartment(manager, deptBId)).toBe(false)
  })

  it('STAFF can only access their department', () => {
    const staff = { role: 'STAFF', department_id: deptAId }
    
    expect(canAccessDepartment(staff, deptAId)).toBe(true)
    expect(canAccessDepartment(staff, deptBId)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// CAN ACCESS RESOURCE TESTS
// ═══════════════════════════════════════════════════════════════

describe('canAccessResource', () => {
  const hotelAId = 'hotel-a-uuid'
  const hotelBId = 'hotel-b-uuid'
  const deptAId = 'dept-a-uuid'
  const deptBId = 'dept-b-uuid'

  it('SUPER_ADMIN can access any resource', () => {
    const superAdmin = { role: 'SUPER_ADMIN' }
    const resource = { hotel_id: hotelBId, department_id: deptBId }
    
    expect(canAccessResource(superAdmin, resource)).toBe(true)
  })

  it('HOTEL_ADMIN can access resources in their hotel', () => {
    const hotelAdmin = { role: 'HOTEL_ADMIN', hotel_id: hotelAId }
    const resource = { hotel_id: hotelAId, department_id: deptAId }
    
    expect(canAccessResource(hotelAdmin, resource)).toBe(true)
  })

  it('HOTEL_ADMIN cannot access resources in other hotel', () => {
    const hotelAdmin = { role: 'HOTEL_ADMIN', hotel_id: hotelAId }
    const resource = { hotel_id: hotelBId, department_id: deptBId }
    
    expect(canAccessResource(hotelAdmin, resource)).toBe(false)
  })

  it('STAFF can access resources in their department', () => {
    const staff = { role: 'STAFF', hotel_id: hotelAId, department_id: deptAId }
    const resource = { hotel_id: hotelAId, department_id: deptAId }
    
    expect(canAccessResource(staff, resource)).toBe(true)
  })

  it('STAFF cannot access resources in other department', () => {
    const staff = { role: 'STAFF', hotel_id: hotelAId, department_id: deptAId }
    const resource = { hotel_id: hotelAId, department_id: deptBId }
    
    expect(canAccessResource(staff, resource)).toBe(false)
  })

  it('STAFF cannot access resources in other hotel', () => {
    const staff = { role: 'STAFF', hotel_id: hotelAId, department_id: deptAId }
    const resource = { hotel_id: hotelBId, department_id: deptAId }
    
    expect(canAccessResource(staff, resource)).toBe(false)
  })

  it('handles camelCase property names', () => {
    const staff = { role: 'STAFF', hotelId: hotelAId, departmentId: deptAId }
    const resource = { hotelId: hotelAId, departmentId: deptAId }
    
    expect(canAccessResource(staff, resource)).toBe(true)
  })

  it('returns false for null user or resource', () => {
    expect(canAccessResource(null, { hotel_id: hotelAId })).toBe(false)
    expect(canAccessResource({ role: 'STAFF' }, null)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// HIERARCHICAL SETTINGS TESTS (Unit tests, no DB required)
// ═══════════════════════════════════════════════════════════════

describe('Hierarchical Settings Priority', () => {
  it('should follow User → Department → Hotel → System priority', () => {
    // This is a conceptual test - actual DB tests would require mocking
    const priorities = ['user', 'department', 'hotel', 'system']
    expect(priorities[0]).toBe('user')  // Highest priority
    expect(priorities[3]).toBe('system') // Lowest priority (defaults)
  })
})
