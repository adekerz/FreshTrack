/**
 * ExpiryService Tests
 * Tests for centralized expiry status calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ExpiryStatus,
  StatusColor,
  calculateDaysUntilExpiry,
  getExpiryStatus,
  getEnrichedExpiryData,
  enrichBatchWithExpiryData,
  enrichBatchesWithExpiryData,
  calculateBatchStats,
  getDefaultThresholds
} from '../services/ExpiryService.js'

// Mock SettingsService
vi.mock('../services/SettingsService.js', () => ({
  getSettings: vi.fn().mockResolvedValue({
    expiryThresholds: { critical: 3, warning: 7 }
  })
}))

describe('ExpiryService', () => {
  
  describe('ExpiryStatus enum', () => {
    it('should have all status types', () => {
      expect(ExpiryStatus.EXPIRED).toBe('expired')
      expect(ExpiryStatus.TODAY).toBe('today')
      expect(ExpiryStatus.CRITICAL).toBe('critical')
      expect(ExpiryStatus.WARNING).toBe('warning')
      expect(ExpiryStatus.GOOD).toBe('good')
    })
  })

  describe('StatusColor mapping', () => {
    it('should map statuses to colors', () => {
      expect(StatusColor[ExpiryStatus.EXPIRED]).toBe('danger')
      expect(StatusColor[ExpiryStatus.TODAY]).toBe('danger')
      expect(StatusColor[ExpiryStatus.CRITICAL]).toBe('danger')
      expect(StatusColor[ExpiryStatus.WARNING]).toBe('warning')
      expect(StatusColor[ExpiryStatus.GOOD]).toBe('success')
    })
  })

  describe('calculateDaysUntilExpiry', () => {
    it('should return negative days for expired items', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const result = calculateDaysUntilExpiry(yesterday.toISOString())
      expect(result).toBe(-1)
    })

    it('should return 0 for items expiring today', () => {
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      const result = calculateDaysUntilExpiry(today.toISOString())
      expect(result).toBe(0)
    })

    it('should return positive days for future expiry', () => {
      const future = new Date()
      future.setDate(future.getDate() + 5)
      const result = calculateDaysUntilExpiry(future.toISOString())
      expect(result).toBe(5)
    })

    it('should return -999 for invalid dates', () => {
      expect(calculateDaysUntilExpiry(null)).toBe(-999)
      expect(calculateDaysUntilExpiry(undefined)).toBe(-999)
      expect(calculateDaysUntilExpiry('invalid')).toBe(-999)
    })
  })

  describe('getExpiryStatus', () => {
    it('should return EXPIRED for negative days', () => {
      expect(getExpiryStatus(-1)).toBe(ExpiryStatus.EXPIRED)
      expect(getExpiryStatus(-10)).toBe(ExpiryStatus.EXPIRED)
    })

    it('should return TODAY for 0 days', () => {
      expect(getExpiryStatus(0)).toBe(ExpiryStatus.TODAY)
    })

    it('should return CRITICAL for 1-3 days', () => {
      expect(getExpiryStatus(1)).toBe(ExpiryStatus.CRITICAL)
      expect(getExpiryStatus(2)).toBe(ExpiryStatus.CRITICAL)
      expect(getExpiryStatus(3)).toBe(ExpiryStatus.CRITICAL)
    })

    it('should return WARNING for 4-7 days', () => {
      expect(getExpiryStatus(4)).toBe(ExpiryStatus.WARNING)
      expect(getExpiryStatus(5)).toBe(ExpiryStatus.WARNING)
      expect(getExpiryStatus(7)).toBe(ExpiryStatus.WARNING)
    })

    it('should return GOOD for more than 7 days', () => {
      expect(getExpiryStatus(8)).toBe(ExpiryStatus.GOOD)
      expect(getExpiryStatus(30)).toBe(ExpiryStatus.GOOD)
      expect(getExpiryStatus(365)).toBe(ExpiryStatus.GOOD)
    })

    it('should respect custom thresholds', () => {
      const customThresholds = { critical: 5, warning: 14 }
      
      expect(getExpiryStatus(4, customThresholds)).toBe(ExpiryStatus.CRITICAL)
      expect(getExpiryStatus(5, customThresholds)).toBe(ExpiryStatus.CRITICAL)
      expect(getExpiryStatus(6, customThresholds)).toBe(ExpiryStatus.WARNING)
      expect(getExpiryStatus(14, customThresholds)).toBe(ExpiryStatus.WARNING)
      expect(getExpiryStatus(15, customThresholds)).toBe(ExpiryStatus.GOOD)
    })
  })

  describe('getEnrichedExpiryData', () => {
    it('should return enriched data with all fields', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      
      const result = await getEnrichedExpiryData(futureDate.toISOString())
      
      expect(result).toHaveProperty('daysLeft')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('color')
      expect(result).toHaveProperty('cssClass')
      expect(result).toHaveProperty('statusText')
      expect(result).toHaveProperty('isExpired')
      expect(result).toHaveProperty('isUrgent')
      expect(result).toHaveProperty('expiryDate')
    })

    it('should mark expired items correctly', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      
      const result = await getEnrichedExpiryData(pastDate.toISOString())
      
      expect(result.status).toBe(ExpiryStatus.EXPIRED)
      expect(result.isExpired).toBe(true)
      expect(result.isUrgent).toBe(true)
    })

    it('should mark good items correctly', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      
      const result = await getEnrichedExpiryData(futureDate.toISOString())
      
      expect(result.status).toBe(ExpiryStatus.GOOD)
      expect(result.isExpired).toBe(false)
      expect(result.isUrgent).toBe(false)
    })

    it('should provide localized status text', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      
      const ruResult = await getEnrichedExpiryData(futureDate.toISOString(), { locale: 'ru' })
      expect(ruResult.statusText).toMatch(/В норме/)
      
      const enResult = await getEnrichedExpiryData(futureDate.toISOString(), { locale: 'en' })
      expect(enResult.statusText).toMatch(/Good/)
    })
  })

  describe('enrichBatchWithExpiryData', () => {
    it('should add expiry fields to batch', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      
      const batch = {
        id: '123',
        product_id: '456',
        expiry_date: futureDate.toISOString(),
        quantity: 10
      }
      
      const enriched = await enrichBatchWithExpiryData(batch)
      
      expect(enriched).toHaveProperty('id', '123')
      expect(enriched).toHaveProperty('quantity', 10)
      expect(enriched).toHaveProperty('daysLeft')
      expect(enriched).toHaveProperty('expiryStatus')
      expect(enriched).toHaveProperty('statusColor')
      expect(enriched).toHaveProperty('statusText')
      expect(enriched).toHaveProperty('isExpired')
      expect(enriched).toHaveProperty('isUrgent')
    })

    it('should handle null batch', async () => {
      const result = await enrichBatchWithExpiryData(null)
      expect(result).toBeNull()
    })

    it('should handle both expiry_date and expiryDate formats', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      
      const batchSnake = { id: '1', expiry_date: futureDate.toISOString() }
      const batchCamel = { id: '2', expiryDate: futureDate.toISOString() }
      
      const enrichedSnake = await enrichBatchWithExpiryData(batchSnake)
      const enrichedCamel = await enrichBatchWithExpiryData(batchCamel)
      
      expect(enrichedSnake.daysLeft).toBe(enrichedCamel.daysLeft)
    })
  })

  describe('enrichBatchesWithExpiryData', () => {
    it('should enrich multiple batches', async () => {
      const today = new Date()
      const batches = [
        { id: '1', expiry_date: new Date(today.getTime() - 86400000).toISOString() }, // expired
        { id: '2', expiry_date: new Date(today.getTime() + 86400000 * 2).toISOString() }, // critical
        { id: '3', expiry_date: new Date(today.getTime() + 86400000 * 10).toISOString() } // good
      ]
      
      const enriched = await enrichBatchesWithExpiryData(batches)
      
      expect(enriched).toHaveLength(3)
      expect(enriched[0].expiryStatus).toBe(ExpiryStatus.EXPIRED)
      expect(enriched[1].expiryStatus).toBe(ExpiryStatus.CRITICAL)
      expect(enriched[2].expiryStatus).toBe(ExpiryStatus.GOOD)
    })

    it('should handle empty array', async () => {
      const result = await enrichBatchesWithExpiryData([])
      expect(result).toEqual([])
    })

    it('should handle null/undefined', async () => {
      expect(await enrichBatchesWithExpiryData(null)).toEqual([])
      expect(await enrichBatchesWithExpiryData(undefined)).toEqual([])
    })
  })

  describe('calculateBatchStats', () => {
    it('should calculate correct statistics', async () => {
      const today = new Date()
      const batches = [
        { expiry_date: new Date(today.getTime() - 86400000).toISOString() }, // expired
        { expiry_date: new Date(today.getTime() - 86400000 * 2).toISOString() }, // expired
        { expiry_date: today.toISOString() }, // today (counts as expired)
        { expiry_date: new Date(today.getTime() + 86400000 * 2).toISOString() }, // critical
        { expiry_date: new Date(today.getTime() + 86400000 * 5).toISOString() }, // warning
        { expiry_date: new Date(today.getTime() + 86400000 * 10).toISOString() }, // good
        { expiry_date: new Date(today.getTime() + 86400000 * 30).toISOString() }, // good
      ]
      
      const stats = await calculateBatchStats(batches)
      
      expect(stats.total).toBe(7)
      expect(stats.expired).toBe(3) // 2 expired + 1 today
      expect(stats.critical).toBe(1)
      expect(stats.warning).toBe(1)
      expect(stats.good).toBe(2)
      expect(stats.healthScore).toBe(Math.round((2/7) * 100))
    })

    it('should return 100 health score for empty batch list', async () => {
      const stats = await calculateBatchStats([])
      
      expect(stats.total).toBe(0)
      expect(stats.healthScore).toBe(100)
    })

    it('should use pre-calculated daysLeft if available', async () => {
      const batches = [
        { daysLeft: -5 },  // expired
        { daysLeft: 10 },  // good
        { daysLeft: 20 }   // good
      ]
      
      const stats = await calculateBatchStats(batches)
      
      expect(stats.expired).toBe(1)
      expect(stats.good).toBe(2)
    })
  })

  describe('getDefaultThresholds', () => {
    it('should return default threshold values', () => {
      const defaults = getDefaultThresholds()
      
      expect(defaults.critical).toBe(3)
      expect(defaults.warning).toBe(7)
    })

    it('should return a copy, not the original object', () => {
      const defaults1 = getDefaultThresholds()
      defaults1.critical = 100
      
      const defaults2 = getDefaultThresholds()
      expect(defaults2.critical).toBe(3)
    })
  })
})
