/**
 * StatisticsService Tests - Phase 3: Centralized Statistics
 * Verifies:
 * - Context filtering (hotelId/departmentId)
 * - byStatus breakdown with colors from backend
 * - byCategory aggregation (no "Other" category)
 * - Trends calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatisticsService } from '../services/StatisticsService.js'
import { ExpiryStatus, StatusColor } from '../services/ExpiryService.js'

// Mock database module
vi.mock('../db/database.js', () => ({
  getAllBatches: vi.fn(),
  getAllProducts: vi.fn(),
  getAllCategories: vi.fn()
}))

// Mock ExpiryService enrichment
vi.mock('../services/ExpiryService.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    enrichBatchesWithExpiryData: vi.fn((batches) => Promise.resolve(batches))
  }
})

import { getAllBatches, getAllProducts, getAllCategories } from '../db/database.js'
import { enrichBatchesWithExpiryData } from '../services/ExpiryService.js'

describe('StatisticsService - Phase 3: Centralized Statistics', () => {
  const mockHotelId = 'hotel-123'
  const mockDepartmentId = 'dept-456'
  
  const mockCategories = [
    { id: 'cat-1', name: 'Молочные продукты', name_en: 'Dairy', color: '#3B82F6', hotel_id: mockHotelId },
    { id: 'cat-2', name: 'Мясо', name_en: 'Meat', color: '#EF4444', hotel_id: mockHotelId },
    { id: 'cat-3', name: 'Овощи', name_en: 'Vegetables', color: '#22C55E', hotel_id: mockHotelId }
  ]
  
  const mockProducts = [
    { id: 'prod-1', name: 'Молоко', category_id: 'cat-1', hotel_id: mockHotelId },
    { id: 'prod-2', name: 'Говядина', category_id: 'cat-2', hotel_id: mockHotelId },
    { id: 'prod-3', name: 'Морковь', category_id: 'cat-3', hotel_id: mockHotelId }
  ]
  
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  beforeEach(() => {
    vi.clearAllMocks()
    getAllCategories.mockResolvedValue(mockCategories)
    getAllProducts.mockResolvedValue(mockProducts)
  })
  
  describe('getStatistics() - Context Filtering', () => {
    it('should require hotelId', async () => {
      await expect(StatisticsService.getStatistics({}))
        .rejects.toThrow('hotelId required for statistics')
    })
    
    it('should pass hotelId to database queries', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      // Verify hotelId is passed
      expect(getAllBatches).toHaveBeenCalled()
      expect(getAllBatches.mock.calls[0][0]).toBe(mockHotelId)
      expect(getAllProducts).toHaveBeenCalled()
      expect(getAllProducts.mock.calls[0][0]).toBe(mockHotelId)
      expect(getAllCategories).toHaveBeenCalledWith(mockHotelId)
    })
    
    it('should filter by departmentId when user cannot access all departments', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      await StatisticsService.getStatistics({
        hotelId: mockHotelId,
        departmentId: mockDepartmentId,
        canAccessAllDepartments: false
      })
      
      expect(getAllBatches).toHaveBeenCalledWith(mockHotelId, { department_id: mockDepartmentId })
    })
    
    it('should not filter by departmentId when user can access all departments', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      await StatisticsService.getStatistics({
        hotelId: mockHotelId,
        departmentId: mockDepartmentId,
        canAccessAllDepartments: true
      })
      
      expect(getAllBatches).toHaveBeenCalledWith(mockHotelId, { department_id: null })
    })
  })
  
  describe('byStatus - Expiry Status Breakdown', () => {
    it('should return all status categories with colors from backend', async () => {
      const mockBatches = [
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiryStatus: ExpiryStatus.WARNING, quantity: 5, category_id: 'cat-1' },
        { id: 'b3', expiryStatus: ExpiryStatus.CRITICAL, quantity: 3, category_id: 'cat-2' },
        { id: 'b4', expiryStatus: ExpiryStatus.EXPIRED, quantity: 2, category_id: 'cat-2' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.byStatus).toHaveLength(5) // EXPIRED, TODAY, CRITICAL, WARNING, GOOD
      
      // Verify colors come from backend StatusColor map
      const goodStatus = result.byStatus.find(s => s.status === ExpiryStatus.GOOD)
      expect(goodStatus.color).toBe(StatusColor[ExpiryStatus.GOOD])
      expect(goodStatus.count).toBe(1)
      expect(goodStatus.quantity).toBe(10)
      
      const expiredStatus = result.byStatus.find(s => s.status === ExpiryStatus.EXPIRED)
      expect(expiredStatus.color).toBe(StatusColor[ExpiryStatus.EXPIRED])
      expect(expiredStatus.count).toBe(1)
    })
    
    it('should calculate percentages correctly', async () => {
      const mockBatches = [
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b3', expiryStatus: ExpiryStatus.WARNING, quantity: 5, category_id: 'cat-1' },
        { id: 'b4', expiryStatus: ExpiryStatus.EXPIRED, quantity: 2, category_id: 'cat-2' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      const goodStatus = result.byStatus.find(s => s.status === ExpiryStatus.GOOD)
      expect(goodStatus.percentage).toBe(50) // 2 out of 4 = 50%
      
      const warningStatus = result.byStatus.find(s => s.status === ExpiryStatus.WARNING)
      expect(warningStatus.percentage).toBe(25) // 1 out of 4 = 25%
    })
    
    it('should include localized labels', async () => {
      getAllBatches.mockResolvedValue([
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' }
      ])
      enrichBatchesWithExpiryData.mockResolvedValue([
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' }
      ])
      
      const resultRu = await StatisticsService.getStatistics({ hotelId: mockHotelId }, { locale: 'ru' })
      expect(resultRu.byStatus.find(s => s.status === ExpiryStatus.GOOD).label).toBe('В норме')
      
      const resultEn = await StatisticsService.getStatistics({ hotelId: mockHotelId }, { locale: 'en' })
      expect(resultEn.byStatus.find(s => s.status === ExpiryStatus.GOOD).label).toBe('Good')
    })
  })
  
  describe('byCategory - No "Other" Category', () => {
    it('should group by category_id from batch (not product lookup)', async () => {
      const mockBatches = [
        { id: 'b1', product_id: 'prod-1', category_id: 'cat-1', expiryStatus: ExpiryStatus.GOOD, quantity: 10 },
        { id: 'b2', product_id: 'prod-1', category_id: 'cat-1', expiryStatus: ExpiryStatus.WARNING, quantity: 5 },
        { id: 'b3', product_id: 'prod-2', category_id: 'cat-2', expiryStatus: ExpiryStatus.CRITICAL, quantity: 3 }
      ]
      
      // Only return categories that are used in batches
      getAllCategories.mockResolvedValue([
        { id: 'cat-1', name: 'Молочные продукты', name_en: 'Dairy', color: '#3B82F6', hotel_id: mockHotelId },
        { id: 'cat-2', name: 'Мясо', name_en: 'Meat', color: '#EF4444', hotel_id: mockHotelId }
      ])
      getAllProducts.mockResolvedValue([
        { id: 'prod-1', name: 'Молоко', category_id: 'cat-1', hotel_id: mockHotelId },
        { id: 'prod-2', name: 'Говядина', category_id: 'cat-2', hotel_id: mockHotelId }
      ])
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.byCategory).toHaveLength(2) // cat-1 and cat-2
      
      // No "Other" category
      expect(result.byCategory.find(c => c.categoryName === 'Другое')).toBeUndefined()
      expect(result.byCategory.find(c => c.categoryName === 'Other')).toBeUndefined()
    })
    
    it('should include category color from database', async () => {
      const mockBatches = [
        { id: 'b1', category_id: 'cat-1', expiryStatus: ExpiryStatus.GOOD, quantity: 10 }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      const dairyCategory = result.byCategory.find(c => c.categoryId === 'cat-1')
      expect(dairyCategory.color).toBe('#3B82F6') // From mockCategories
      expect(dairyCategory.categoryName).toBe('Молочные продукты')
    })
    
    it('should calculate byStatus breakdown within each category', async () => {
      const mockBatches = [
        { id: 'b1', category_id: 'cat-1', expiryStatus: ExpiryStatus.GOOD, quantity: 10 },
        { id: 'b2', category_id: 'cat-1', expiryStatus: ExpiryStatus.WARNING, quantity: 5 },
        { id: 'b3', category_id: 'cat-1', expiryStatus: ExpiryStatus.EXPIRED, quantity: 2 }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      const dairyCategory = result.byCategory.find(c => c.categoryId === 'cat-1')
      expect(dairyCategory.byStatus.good).toBe(1)
      expect(dairyCategory.byStatus.warning).toBe(1)
      expect(dairyCategory.byStatus.expired).toBe(1)
      expect(dairyCategory.batchCount).toBe(3)
      expect(dairyCategory.totalQuantity).toBe(17)
    })
    
    it('should skip batches without category_id (not add to "Other")', async () => {
      const mockBatches = [
        { id: 'b1', category_id: 'cat-1', expiryStatus: ExpiryStatus.GOOD, quantity: 10 },
        { id: 'b2', category_id: null, expiryStatus: ExpiryStatus.WARNING, quantity: 5 }, // No category
        { id: 'b3', category_id: undefined, expiryStatus: ExpiryStatus.WARNING, quantity: 3 } // No category
      ]
      
      // Only return the one category used
      getAllCategories.mockResolvedValue([
        { id: 'cat-1', name: 'Молочные продукты', name_en: 'Dairy', color: '#3B82F6', hotel_id: mockHotelId }
      ])
      getAllProducts.mockResolvedValue([
        { id: 'prod-1', name: 'Молоко', category_id: 'cat-1', hotel_id: mockHotelId }
      ])
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      // Only cat-1 should be in results
      expect(result.byCategory).toHaveLength(1)
      expect(result.byCategory[0].categoryId).toBe('cat-1')
    })
  })
  
  describe('trends - Time Series Data', () => {
    it('should return trend data for specified number of days', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      const result = await StatisticsService.getStatistics(
        { hotelId: mockHotelId },
        { trendDays: 14 }
      )
      
      expect(result.trends).toHaveLength(14)
    })
    
    it('should default to 30 days', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.trends).toHaveLength(30)
    })
    
    it('should group batches by expiry date', async () => {
      const todayStr = new Date().toISOString().split('T')[0]
      const mockBatches = [
        { id: 'b1', expiry_date: todayStr, expiryStatus: ExpiryStatus.TODAY, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiry_date: todayStr, expiryStatus: ExpiryStatus.TODAY, quantity: 5, category_id: 'cat-1' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      const todayTrend = result.trends.find(t => t.date === todayStr)
      expect(todayTrend.total).toBe(2)
    })
  })
  
  describe('total - Aggregate Counts', () => {
    it('should return correct totals', async () => {
      const mockBatches = [
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiryStatus: ExpiryStatus.WARNING, quantity: 5, category_id: 'cat-1' },
        { id: 'b3', expiryStatus: ExpiryStatus.GOOD, quantity: 3, category_id: 'cat-2' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.total.batches).toBe(3)
      expect(result.total.products).toBe(3) // from mockProducts
      expect(result.total.categories).toBe(3) // from mockCategories
      expect(result.total.totalQuantity).toBe(18)
    })
    
    it('should calculate health score correctly', async () => {
      const mockBatches = [
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b3', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b4', expiryStatus: ExpiryStatus.WARNING, quantity: 5, category_id: 'cat-1' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.total.healthScore).toBe(75) // 3 good out of 4 = 75%
    })
    
    it('should return 100% health score when no batches', async () => {
      getAllBatches.mockResolvedValue([])
      enrichBatchesWithExpiryData.mockResolvedValue([])
      
      const result = await StatisticsService.getStatistics({ hotelId: mockHotelId })
      
      expect(result.total.healthScore).toBe(100)
    })
  })
  
  describe('getQuickStats() - Dashboard Widget', () => {
    it('should return summary stats', async () => {
      const mockBatches = [
        { id: 'b1', expiryStatus: ExpiryStatus.GOOD, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiryStatus: ExpiryStatus.EXPIRED, quantity: 5, category_id: 'cat-1' },
        { id: 'b3', expiryStatus: ExpiryStatus.CRITICAL, quantity: 3, category_id: 'cat-2' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      const result = await StatisticsService.getQuickStats({ hotelId: mockHotelId })
      
      expect(result.totalBatches).toBe(3)
      expect(result.totalProducts).toBe(3)
      expect(result.expired).toBe(1)
      expect(result.urgentItems).toBe(2) // expired + critical
    })
  })
  
  describe('Date Range Filtering', () => {
    it('should filter batches by date range', async () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0) // Midday to avoid edge cases
      const todayStr = today.toISOString().split('T')[0]
      
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      const futureStr = futureDate.toISOString().split('T')[0]
      
      const mockBatches = [
        { id: 'b1', expiry_date: todayStr, expiryStatus: ExpiryStatus.TODAY, quantity: 10, category_id: 'cat-1' },
        { id: 'b2', expiry_date: futureStr, expiryStatus: ExpiryStatus.GOOD, quantity: 5, category_id: 'cat-1' }
      ]
      
      getAllBatches.mockResolvedValue(mockBatches)
      enrichBatchesWithExpiryData.mockResolvedValue(mockBatches)
      
      // Filter for today only - use date strings for cleaner comparison
      const startOfToday = new Date(todayStr + 'T00:00:00')
      const endOfToday = new Date(todayStr + 'T23:59:59.999')
      
      const result = await StatisticsService.getStatistics(
        { hotelId: mockHotelId },
        { dateRange: { from: startOfToday, to: endOfToday } }
      )
      
      // Only today's batch should be included
      expect(result.total.batches).toBe(1)
    })
  })
})
