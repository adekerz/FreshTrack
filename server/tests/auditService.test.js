/**
 * AuditService Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database module
vi.mock('../db/database.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  createAuditSnapshot: vi.fn((entity, type) => ({
    ...entity,
    _snapshot_type: type,
    _snapshot_time: '2024-01-15T10:00:00.000Z'
  })),
  getAuditLogs: vi.fn().mockResolvedValue([]),
  query: vi.fn().mockResolvedValue({ rows: [] })
}))

import AuditService, { auditService, AuditAction, AuditEntityType } from '../services/AuditService.js'
import { logAudit, createAuditSnapshot, getAuditLogs, query } from '../db/database.js'

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AuditAction constants', () => {
    it('should have all CRUD actions', () => {
      expect(AuditAction.CREATE).toBe('create')
      expect(AuditAction.UPDATE).toBe('update')
      expect(AuditAction.DELETE).toBe('delete')
      expect(AuditAction.VIEW).toBe('view')
    })

    it('should have authentication actions', () => {
      expect(AuditAction.LOGIN).toBe('login')
      expect(AuditAction.LOGOUT).toBe('logout')
      expect(AuditAction.LOGIN_FAILED).toBe('login_failed')
      expect(AuditAction.PASSWORD_CHANGE).toBe('password_change')
    })

    it('should have batch-specific actions', () => {
      expect(AuditAction.COLLECT).toBe('collect')
      expect(AuditAction.WRITE_OFF).toBe('write_off')
      expect(AuditAction.RESTORE).toBe('restore')
    })

    it('should have bulk operation actions', () => {
      expect(AuditAction.IMPORT).toBe('import')
      expect(AuditAction.EXPORT).toBe('export')
      expect(AuditAction.BULK_UPDATE).toBe('bulk_update')
      expect(AuditAction.BULK_DELETE).toBe('bulk_delete')
    })
  })

  describe('AuditEntityType constants', () => {
    it('should have all entity types', () => {
      expect(AuditEntityType.USER).toBe('user')
      expect(AuditEntityType.HOTEL).toBe('hotel')
      expect(AuditEntityType.DEPARTMENT).toBe('department')
      expect(AuditEntityType.CATEGORY).toBe('category')
      expect(AuditEntityType.PRODUCT).toBe('product')
      expect(AuditEntityType.BATCH).toBe('batch')
      expect(AuditEntityType.WRITE_OFF).toBe('write_off')
      expect(AuditEntityType.COLLECTION).toBe('collection')
      expect(AuditEntityType.NOTIFICATION).toBe('notification')
      expect(AuditEntityType.SETTINGS).toBe('settings')
    })
  })

  describe('log()', () => {
    it('should call logAudit with mapped parameters', async () => {
      await auditService.log({
        hotelId: 'hotel-1',
        userId: 'user-1',
        userName: 'Test User',
        action: AuditAction.CREATE,
        entityType: AuditEntityType.PRODUCT,
        entityId: 'product-1',
        details: { name: 'New Product' },
        ipAddress: '192.168.1.1'
      })

      expect(logAudit).toHaveBeenCalledWith({
        hotel_id: 'hotel-1',
        user_id: 'user-1',
        user_name: 'Test User',
        action: 'create',
        entity_type: 'product',
        entity_id: 'product-1',
        details: { name: 'New Product' },
        ip_address: '192.168.1.1',
        snapshot_before: null,
        snapshot_after: null
      })
    })

    it('should include snapshots when provided', async () => {
      const before = { name: 'Old Name', quantity: 10 }
      const after = { name: 'New Name', quantity: 10 }

      await auditService.log({
        hotelId: 'hotel-1',
        userId: 'user-1',
        userName: 'Test User',
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.BATCH,
        entityId: 'batch-1',
        snapshotBefore: before,
        snapshotAfter: after
      })

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        snapshot_before: before,
        snapshot_after: after
      }))
    })
  })

  describe('logFromRequest()', () => {
    it('should extract user info from request object', async () => {
      const mockReq = {
        hotelId: 'hotel-1',
        user: { id: 'user-1', name: 'John Doe', login: 'john' },
        ip: '10.0.0.1'
      }

      await auditService.logFromRequest(mockReq, {
        action: AuditAction.DELETE,
        entityType: AuditEntityType.NOTIFICATION,
        entityId: 'notif-1'
      })

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        hotel_id: 'hotel-1',
        user_id: 'user-1',
        user_name: 'John Doe',
        action: 'delete',
        entity_type: 'notification',
        entity_id: 'notif-1',
        ip_address: '10.0.0.1'
      }))
    })

    it('should fallback to login if name is not present', async () => {
      const mockReq = {
        hotelId: 'hotel-1',
        user: { id: 'user-1', login: 'john' },
        ip: '10.0.0.1'
      }

      await auditService.logFromRequest(mockReq, {
        action: AuditAction.VIEW,
        entityType: AuditEntityType.REPORT,
        entityId: 'report-1'
      })

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
        user_name: 'john'
      }))
    })
  })

  describe('createSnapshot()', () => {
    it('should delegate to createAuditSnapshot', () => {
      const entity = { id: '1', name: 'Test', quantity: 100 }
      
      const snapshot = auditService.createSnapshot(entity, 'batch')

      expect(createAuditSnapshot).toHaveBeenCalledWith(entity, 'batch')
      expect(snapshot._snapshot_type).toBe('batch')
      expect(snapshot._snapshot_time).toBeDefined()
    })
  })

  describe('getLogs()', () => {
    it('should call getAuditLogs with hotelId and filters', async () => {
      const filters = { action: 'create', limit: 50 }
      
      await auditService.getLogs('hotel-1', filters)

      expect(getAuditLogs).toHaveBeenCalledWith('hotel-1', filters)
    })
  })

  describe('getEntityHistory()', () => {
    it('should query audit logs for specific entity', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { 
            id: '1', 
            action: 'update', 
            details: '{"name":"Updated"}',
            snapshot_before: '{"name":"Old"}',
            snapshot_after: '{"name":"Updated"}',
            changes_diff: '{"name":{"before":"Old","after":"Updated"}}'
          }
        ]
      })

      const history = await auditService.getEntityHistory('hotel-1', 'product', 'product-1')

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE al.hotel_id = $1'),
        ['hotel-1', 'product', 'product-1', 50]
      )
      
      expect(history[0].details).toEqual({ name: 'Updated' })
      expect(history[0].changes_diff).toEqual({ name: { before: 'Old', after: 'Updated' } })
    })
  })

  describe('getUserActivity()', () => {
    it('should query audit logs for specific user', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: '1', action: 'login', details: '{"method":"password"}' }
        ]
      })

      const activity = await auditService.getUserActivity('hotel-1', 'user-1', 25)

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE hotel_id = $1 AND user_id = $2'),
        ['hotel-1', 'user-1', 25]
      )
      
      expect(activity[0].details).toEqual({ method: 'password' })
    })
  })

  describe('getStats()', () => {
    it('should return aggregated statistics', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ action: 'create', count: 100 }] })
        .mockResolvedValueOnce({ rows: [{ entity_type: 'batch', count: 50 }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'u1', user_name: 'John', count: 30 }] })

      const stats = await auditService.getStats('hotel-1')

      expect(stats.byAction).toEqual([{ action: 'create', count: 100 }])
      expect(stats.byEntityType).toEqual([{ entity_type: 'batch', count: 50 }])
      expect(stats.topUsers).toEqual([{ user_id: 'u1', user_name: 'John', count: 30 }])
    })

    it('should apply date filters when provided', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })

      await auditService.getStats('hotel-1', '2024-01-01', '2024-01-31')

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DATE(created_at) >='),
        ['hotel-1', '2024-01-01', '2024-01-31']
      )
    })
  })

  describe('searchSnapshots()', () => {
    it('should search in snapshot content using ILIKE', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: '1', action: 'update' }]
      })

      await auditService.searchSnapshots('hotel-1', 'important-product')

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('snapshot_before::text ILIKE'),
        ['hotel-1', '%important-product%', 50]
      )
    })

    it('should filter by entity type when provided', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      await auditService.searchSnapshots('hotel-1', 'test', 'batch', 100)

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('AND entity_type = $3'),
        ['hotel-1', '%test%', 'batch', 100]
      )
    })
  })

  describe('cleanOldLogs()', () => {
    it('should delete logs older than retention period', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: '1' }, { id: '2' }, { id: '3' }]
      })

      const result = await auditService.cleanOldLogs('hotel-1', 90)

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("NOW() - INTERVAL '1 day' * $2"),
        ['hotel-1', 90]
      )
      
      expect(result.deletedCount).toBe(3)
      expect(result.retentionDays).toBe(90)
    })

    it('should use default retention of 365 days', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      await auditService.cleanOldLogs('hotel-1')

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['hotel-1', 365]
      )
    })
  })

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(auditService).toBeInstanceOf(AuditService)
    })
  })
})
