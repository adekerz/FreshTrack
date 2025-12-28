/**
 * CollectionService Tests - Phase 8: FIFO Collection Logic
 * 
 * Tests:
 * - FIFO algorithm correctness (earliest expiry first)
 * - Insufficient stock handling
 * - Race condition prevention
 * - Snapshot preservation
 * - Preview functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock postgres client
const mockClient = {
  query: vi.fn(),
  release: vi.fn()
}

// Mock query and getClient
vi.mock('../db/postgres.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(() => Promise.resolve(mockClient))
}))

// Mock AuditService
vi.mock('../services/AuditService.js', () => ({
  logFromRequest: vi.fn(() => Promise.resolve())
}))

import { query, getClient } from '../db/postgres.js'
import * as CollectionService from '../services/CollectionService.js'
import { CollectionError, CollectionReason } from '../services/CollectionService.js'

describe('CollectionService - Phase 8: FIFO Collection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.query.mockReset()
    mockClient.release.mockReset()
  })

  describe('previewCollection()', () => {
    it('should return affected batches sorted by expiry date (FIFO)', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_name: 'Coca-Cola', category_name: 'Drinks' },
          { id: 'batch-2', quantity: 10, expiry_date: '2025-01-15', product_name: 'Coca-Cola', category_name: 'Drinks' },
          { id: 'batch-3', quantity: 8, expiry_date: '2025-01-20', product_name: 'Coca-Cola', category_name: 'Drinks' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: 12,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(true)
      expect(result.affectedBatches).toHaveLength(2)
      
      // First batch (earliest expiry) should be fully consumed
      expect(result.affectedBatches[0].batchId).toBe('batch-1')
      expect(result.affectedBatches[0].collectQuantity).toBe(5)
      expect(result.affectedBatches[0].willBeDeleted).toBe(true)
      
      // Second batch gets remaining
      expect(result.affectedBatches[1].batchId).toBe('batch-2')
      expect(result.affectedBatches[1].collectQuantity).toBe(7)
      expect(result.affectedBatches[1].willBeDeleted).toBe(false)
    })

    it('should return INSUFFICIENT_STOCK when quantity exceeds available', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_name: 'Pepsi', category_name: 'Drinks' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: 20,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(CollectionError.INSUFFICIENT_STOCK)
      expect(result.available).toBe(5)
      expect(result.requested).toBe(20)
    })

    it('should return NO_ACTIVE_BATCHES when no batches found', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      const result = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: 5,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(CollectionError.NO_ACTIVE_BATCHES)
    })

    it('should return INVALID_QUANTITY for zero or negative quantity', async () => {
      const result1 = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: 0,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })
      expect(result1.success).toBe(false)
      expect(result1.error).toBe(CollectionError.INVALID_QUANTITY)

      const result2 = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: -5,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })
      expect(result2.success).toBe(false)
      expect(result2.error).toBe(CollectionError.INVALID_QUANTITY)
    })

    it('should calculate exact remaining quantities', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_name: 'Test', category_name: 'Cat' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'product-1',
        quantity: 3,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.affectedBatches[0].currentQuantity).toBe(10)
      expect(result.affectedBatches[0].collectQuantity).toBe(3)
      expect(result.affectedBatches[0].remainingQuantity).toBe(7)
      expect(result.affectedBatches[0].willBeDeleted).toBe(false)
    })
  })

  describe('collect() - FIFO Execution', () => {
    it('should execute FIFO collection and create history entries', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks', batch_number: 'B001' },
          { id: 'batch-2', quantity: 10, expiry_date: '2025-01-15', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks', batch_number: 'B002' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches) // SELECT batches FOR UPDATE
        .mockResolvedValueOnce({}) // INSERT collection_history (batch-1)
        .mockResolvedValueOnce({}) // DELETE batch-1
        .mockResolvedValueOnce({}) // INSERT collection_history (batch-2)
        .mockResolvedValueOnce({}) // UPDATE batch-2
        .mockResolvedValueOnce({}) // COMMIT

      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 8,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1',
        reason: CollectionReason.MINIBAR
      })

      expect(result.success).toBe(true)
      expect(result.totalCollected).toBe(8)
      expect(result.batchesAffected).toBe(2)
      expect(result.batchesDeleted).toBe(1) // batch-1 fully consumed
      expect(result.historyEntries).toHaveLength(2)

      // Verify first batch fully collected
      expect(result.historyEntries[0].quantityCollected).toBe(5)
      expect(result.historyEntries[0].quantityRemaining).toBe(0)

      // Verify second batch partial
      expect(result.historyEntries[1].quantityCollected).toBe(3)
      expect(result.historyEntries[1].quantityRemaining).toBe(7)
    })

    it('should use FOR UPDATE lock to prevent race conditions', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches) // SELECT with FOR UPDATE
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({}) // UPDATE batch
        .mockResolvedValueOnce({}) // COMMIT

      await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      // Check that SELECT query contains FOR UPDATE
      const selectQuery = mockClient.query.mock.calls[1][0]
      expect(selectQuery).toContain('FOR UPDATE')
    })

    it('should rollback transaction on INSUFFICIENT_STOCK', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches) // SELECT batches

      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 20,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(CollectionError.INSUFFICIENT_STOCK)

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
    })

    it('should delete batch when fully consumed', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches) // SELECT batches
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({}) // DELETE batch
        .mockResolvedValueOnce({}) // COMMIT

      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5, // Exact amount
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(true)
      expect(result.batchesDeleted).toBe(1)

      // Verify DELETE was called
      const deleteCalls = mockClient.query.mock.calls.filter(
        call => call[0] && call[0].includes('DELETE FROM batches')
      )
      expect(deleteCalls.length).toBe(1)
    })

    it('should preserve snapshots in collection_history', async () => {
      const mockBatches = {
        rows: [
          { 
            id: 'batch-1', 
            quantity: 10, 
            expiry_date: '2025-01-10', 
            product_id: 'prod-1', 
            product_name: 'Coca-Cola Original',
            category_name: 'Soft Drinks',
            batch_number: 'BATCH-2025-001'
          }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches)
        .mockResolvedValueOnce({}) // INSERT history
        .mockResolvedValueOnce({}) // UPDATE batch
        .mockResolvedValueOnce({}) // COMMIT

      await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1',
        reason: CollectionReason.CONSUMPTION,
        notes: 'Test note'
      })

      // Find the INSERT INTO collection_history call
      const insertCall = mockClient.query.mock.calls.find(
        call => call[0] && call[0].includes('INSERT INTO collection_history')
      )

      expect(insertCall).toBeDefined()
      const insertParams = insertCall[1]
      
      // Verify snapshot fields are saved
      expect(insertParams).toContain('2025-01-10') // expiry_date
      expect(insertParams).toContain('Coca-Cola Original') // product_name
      expect(insertParams).toContain('Soft Drinks') // category_name
      expect(insertParams).toContain('BATCH-2025-001') // batch_number
      expect(insertParams).toContain('consumption') // reason
      expect(insertParams).toContain('Test note') // notes
    })

    it('should return INVALID_DEPARTMENT when required params missing', async () => {
      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: null, // Missing
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(CollectionError.INVALID_DEPARTMENT)
    })

    it('should handle database errors gracefully', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database connection lost'))

      await expect(CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })).rejects.toThrow('Database connection lost')

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK')
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('getCollectionHistory()', () => {
    it('should return collection history with filters', async () => {
      const mockHistory = {
        rows: [
          { id: 'hist-1', product_name: 'Cola', quantity_collected: 5, collected_at: '2025-01-10' },
          { id: 'hist-2', product_name: 'Pepsi', quantity_collected: 3, collected_at: '2025-01-09' }
        ]
      }
      query.mockResolvedValueOnce(mockHistory)

      const result = await CollectionService.getCollectionHistory('hotel-1', {
        departmentId: 'dept-1',
        limit: 50
      })

      expect(result).toHaveLength(2)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE ch.hotel_id = $1'),
        expect.arrayContaining(['hotel-1', 'dept-1', 50, 0])
      )
    })

    it('should apply date range filters', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      await CollectionService.getCollectionHistory('hotel-1', {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      })

      const queryCall = query.mock.calls[0]
      expect(queryCall[0]).toContain('ch.collected_at >=')
      expect(queryCall[0]).toContain('ch.collected_at <=')
    })
  })

  describe('getCollectionStats()', () => {
    it('should return statistics for given period', async () => {
      const mockTotals = {
        rows: [{ total_transactions: '15', total_quantity: '150', unique_products: '8', unique_users: '3' }]
      }
      const mockTopProducts = {
        rows: [{ product_name: 'Cola', total_collected: '50' }]
      }
      const mockByReason = {
        rows: [{ collection_reason: 'consumption', total_collected: '120' }]
      }
      const mockTrend = {
        rows: [{ date: '2025-01-10', total_collected: '25' }]
      }

      query
        .mockResolvedValueOnce(mockTotals)
        .mockResolvedValueOnce(mockTopProducts)
        .mockResolvedValueOnce(mockByReason)
        .mockResolvedValueOnce(mockTrend)

      const result = await CollectionService.getCollectionStats('hotel-1', 'dept-1', 'week')

      expect(result.period).toBe('week')
      expect(result.totals.transactions).toBe(15)
      expect(result.totals.quantity).toBe(150)
      expect(result.topProducts).toHaveLength(1)
      expect(result.byReason).toHaveLength(1)
      expect(result.dailyTrend).toHaveLength(1)
    })

    it('should apply correct date filter for each period', async () => {
      const mockEmpty = { rows: [{ total_transactions: '0', total_quantity: '0', unique_products: '0', unique_users: '0' }] }
      
      for (const period of ['day', 'week', 'month', 'year']) {
        vi.clearAllMocks()
        query.mockResolvedValue(mockEmpty)

        await CollectionService.getCollectionStats('hotel-1', null, period)

        const totalsQuery = query.mock.calls[0][0]
        
        if (period === 'day') {
          expect(totalsQuery).toContain('CURRENT_DATE')
        } else if (period === 'week') {
          expect(totalsQuery).toContain("'7 days'")
        } else if (period === 'month') {
          expect(totalsQuery).toContain("'30 days'")
        } else if (period === 'year') {
          expect(totalsQuery).toContain("'365 days'")
        }
      }
    })
  })

  describe('CollectionReason Enum', () => {
    it('should have all expected reasons', () => {
      expect(CollectionReason.CONSUMPTION).toBe('consumption')
      expect(CollectionReason.MINIBAR).toBe('minibar')
      expect(CollectionReason.SALE).toBe('sale')
      expect(CollectionReason.DAMAGED).toBe('damaged')
      expect(CollectionReason.OTHER).toBe('other')
    })
  })

  describe('Edge Cases', () => {
    it('should handle single batch exactly matching quantity', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockBatches)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({})

      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 10,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(true)
      expect(result.historyEntries[0].quantityRemaining).toBe(0)
      expect(result.batchesDeleted).toBe(1)
    })

    it('should handle multiple batches with same expiry date', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 5, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' },
          { id: 'batch-2', quantity: 5, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'prod-1',
        quantity: 8,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.success).toBe(true)
      // Should still process in order (first batch fully, then second)
      expect(result.affectedBatches[0].collectQuantity).toBe(5)
      expect(result.affectedBatches[1].collectQuantity).toBe(3)
    })

    it('should collect from only one batch when quantity is small', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 100, expiry_date: '2025-01-10', product_name: 'Cola', category_name: 'Drinks' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'prod-1',
        quantity: 1,
        hotelId: 'hotel-1',
        departmentId: 'dept-1'
      })

      expect(result.affectedBatches).toHaveLength(1)
      expect(result.affectedBatches[0].collectQuantity).toBe(1)
      expect(result.affectedBatches[0].remainingQuantity).toBe(99)
    })
  })

  describe('HOTEL_ADMIN without departmentId', () => {
    it('previewCollection should work without departmentId (hotel-wide access)', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_name: 'Cola', category_name: 'Drinks', department_id: 'dept-1' },
          { id: 'batch-2', quantity: 5, expiry_date: '2025-01-15', product_name: 'Cola', category_name: 'Drinks', department_id: 'dept-2' }
        ]
      }
      query.mockResolvedValueOnce(mockBatches)

      const result = await CollectionService.previewCollection({
        productId: 'prod-1',
        quantity: 12,
        hotelId: 'hotel-1',
        departmentId: null // HOTEL_ADMIN has no department
      })

      expect(result.success).toBe(true)
      expect(result.affectedBatches).toHaveLength(2)
      expect(result.totalAvailable).toBe(15) // Sum from all departments
    })

    it('collect should work without departmentId for HOTEL_ADMIN', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks', department_id: 'dept-1' }
        ]
      }

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce(mockBatches) // SELECT batches
        .mockResolvedValueOnce({}) // INSERT collection_history
        .mockResolvedValueOnce({}) // UPDATE batch
        .mockResolvedValueOnce({}) // COMMIT

      const result = await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: null, // HOTEL_ADMIN
        reason: CollectionReason.CONSUMPTION
      })

      expect(result.success).toBe(true)
      expect(result.totalCollected).toBe(5)
    })

    it('should use batch department_id in history when user has no departmentId', async () => {
      const mockBatches = {
        rows: [
          { id: 'batch-1', quantity: 10, expiry_date: '2025-01-10', product_id: 'prod-1', product_name: 'Cola', category_name: 'Drinks', department_id: 'dept-kitchen' }
        ]
      }

      let insertedDepartmentId = null
      mockClient.query.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO collection_history')) {
          insertedDepartmentId = params[4] // department_id is 5th param (index 4)
        }
        if (sql.includes('SELECT')) return Promise.resolve(mockBatches)
        return Promise.resolve({})
      })

      await CollectionService.collect({
        productId: 'prod-1',
        quantity: 5,
        userId: 'user-1',
        hotelId: 'hotel-1',
        departmentId: null,
        reason: CollectionReason.CONSUMPTION
      })

      // Should use batch's department_id, not null
      expect(insertedDepartmentId).toBe('dept-kitchen')
    })
  })
})

