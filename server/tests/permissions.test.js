/**
 * Permission System Tests
 * Tests for granular permission-based access control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the postgres module BEFORE importing auth
vi.mock('../db/postgres.js', () => ({
  query: vi.fn().mockRejectedValue(new Error('Table not found')),
  getClient: vi.fn()
}))

// Import enums and functions directly
import { 
  PermissionResource, 
  PermissionAction,
  requirePermission,
  clearPermissionCache
} from '../middleware/auth.js'

describe('Permission System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPermissionCache()
  })

  describe('PermissionResource enum', () => {
    it('should contain all resource types', () => {
      expect(PermissionResource.INVENTORY).toBe('inventory')
      expect(PermissionResource.PRODUCTS).toBe('products')
      expect(PermissionResource.BATCHES).toBe('batches')
      expect(PermissionResource.CATEGORIES).toBe('categories')
      expect(PermissionResource.USERS).toBe('users')
      expect(PermissionResource.DEPARTMENTS).toBe('departments')
      expect(PermissionResource.SETTINGS).toBe('settings')
      expect(PermissionResource.REPORTS).toBe('reports')
      expect(PermissionResource.NOTIFICATIONS).toBe('notifications')
      expect(PermissionResource.WRITE_OFFS).toBe('write_offs')
      expect(PermissionResource.AUDIT).toBe('audit')
      expect(PermissionResource.HOTELS).toBe('hotels')
    })
  })

  describe('PermissionAction enum', () => {
    it('should contain all action types', () => {
      expect(PermissionAction.READ).toBe('read')
      expect(PermissionAction.CREATE).toBe('create')
      expect(PermissionAction.UPDATE).toBe('update')
      expect(PermissionAction.DELETE).toBe('delete')
      expect(PermissionAction.EXPORT).toBe('export')
      expect(PermissionAction.MANAGE).toBe('manage')
      expect(PermissionAction.COLLECT).toBe('collect')
    })
  })

  describe('requirePermission middleware', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    it('should return 401 when user is not authenticated', async () => {
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ)
      
      const req = { user: null }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow SUPER_ADMIN to access any resource', async () => {
      const middleware = requirePermission(PermissionResource.HOTELS, PermissionAction.DELETE)
      
      const req = {
        user: { id: 1, role: 'SUPER_ADMIN', hotel_id: null, department_id: null },
        hotelId: null,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('should allow HOTEL_ADMIN to access hotel resources', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ)
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    // Note: STAFF permissions require database lookup.
    // Without DB, access is denied for security (fail-closed).
    // Integration tests verify actual permissions with real DB.
    
    it('should deny STAFF when DB unavailable (fail-closed security)', async () => {
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ)
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      // Without DB permissions, STAFF is denied (secure fallback)
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('should deny STAFF from deleting products', async () => {
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.DELETE)
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('should deny STAFF from reading users', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ)
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('should deny HOTEL_ADMIN from accessing other hotel', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ, {
        getTargetHotelId: () => 999 // Different hotel
      })
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Hotel Isolation', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    it('HOTEL_ADMIN should access own hotel users', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ)
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('HOTEL_ADMIN should be blocked from other hotel', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ, {
        getTargetHotelId: () => 999 // Different hotel
      })
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('SUPER_ADMIN can access any hotel', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.READ, {
        getTargetHotelId: () => 999
      })
      
      const req = {
        user: { id: 1, role: 'SUPER_ADMIN', hotel_id: null, department_id: null },
        hotelId: null,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Department Isolation', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    // Note: STAFF and DEPARTMENT_MANAGER tests require database permissions.
    // These are handled by falling back to deny when DB is unavailable.
    // This is tested via res.status(403) expectations.

    it('STAFF without DB permissions should be denied (security fallback)', async () => {
      const middleware = requirePermission(PermissionResource.BATCHES, PermissionAction.READ)
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      // Without DB, should deny for security
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('DEPARTMENT_MANAGER without DB permissions should be denied (security fallback)', async () => {
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.UPDATE)
      
      const req = {
        user: { id: 3, role: 'DEPARTMENT_MANAGER', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      // Without DB, should deny for security
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('STAFF should be blocked from accessing other department in same hotel', async () => {
      // QA requirement: USER cannot see data from neighboring department even within own hotel
      const middleware = requirePermission(PermissionResource.BATCHES, PermissionAction.READ, {
        getTargetDepartmentId: () => 999 // Different department in same hotel
      })
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('STAFF should be blocked from accessing other hotel entirely', async () => {
      // Double isolation: hotel + department check
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ, {
        getTargetHotelId: () => 999 // Different hotel
      })
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('HOTEL_ADMIN should access all departments within own hotel', async () => {
      // HOTEL scope allows access to any department within hotel
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ, {
        getTargetDepartmentId: () => 999 // Any department in own hotel
      })
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Scope Hierarchy - canManageUser scenarios', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    it('HOTEL_ADMIN can manage users within own hotel', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.UPDATE, {
        getTargetHotelId: () => 1 // Same hotel
      })
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('HOTEL_ADMIN cannot manage users in other hotels', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.UPDATE, {
        getTargetHotelId: () => 999 // Different hotel
      })
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('DEPARTMENT_MANAGER cannot manage users', async () => {
      // Managers can view/update inventory but not create/delete users
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.CREATE)
      
      const req = {
        user: { id: 3, role: 'DEPARTMENT_MANAGER', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('Permission Error Messages', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    it('should return 403 with resource and action info', async () => {
      const middleware = requirePermission(PermissionResource.USERS, PermissionAction.DELETE)
      
      const req = {
        user: { id: 3, role: 'STAFF', hotel_id: 1, department_id: 10 },
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        required: { resource: 'users', action: 'delete' }
      }))
    })
  })

  describe('Advanced Permission Scenarios', () => {
    const createMockRes = () => ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    })

    it('HOTEL_ADMIN should access FIFO collection without departmentId', async () => {
      const middleware = requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE)
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null // No department - hotel-wide access
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    // Note: DEPARTMENT_MANAGER and STAFF tests require database permissions
    // which are not available in the mock. These roles are tested via integration tests.
    // The key role-based access is tested above with SUPER_ADMIN and HOTEL_ADMIN.

    it('should handle missing user.role gracefully', async () => {
      const middleware = requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ)
      
      const req = {
        user: { id: 7 }, // No role
        hotelId: 1,
        departmentId: 10
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('HOTEL_ADMIN should manage settings', async () => {
      const middleware = requirePermission(PermissionResource.SETTINGS, PermissionAction.MANAGE)
      
      const req = {
        user: { id: 2, role: 'HOTEL_ADMIN', hotel_id: 1, department_id: null },
        hotelId: 1,
        departmentId: null
      }
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })
})

