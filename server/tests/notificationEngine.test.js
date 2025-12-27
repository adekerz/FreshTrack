/**
 * NotificationEngine Unit Tests
 * Phase 5: Notification Engine testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database and services
vi.mock('../db/database.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] })
}))

vi.mock('../services/TelegramService.js', () => ({
  TelegramService: {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    sendBatchNotification: vi.fn().mockResolvedValue({ success: true, sentTo: 1 })
  }
}))

vi.mock('../services/ExpiryService.js', () => ({
  calculateExpiryStatus: vi.fn().mockReturnValue({ status: 'warning', color: 'yellow' }),
  enrichBatchWithExpiryData: vi.fn((batch) => ({ ...batch, expiryStatus: 'warning' }))
}))

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash-12345')
  }))
}))

import { 
  NotificationEngine, 
  NotificationChannel, 
  NotificationType, 
  DeliveryStatus,
  Priority 
} from '../services/NotificationEngine.js'
import { query } from '../db/database.js'
import { TelegramService } from '../services/TelegramService.js'

describe('NotificationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Constants', () => {
    it('should have all notification channels', () => {
      expect(NotificationChannel.APP).toBe('app')
      expect(NotificationChannel.TELEGRAM).toBe('telegram')
      expect(NotificationChannel.EMAIL).toBe('email')
    })

    it('should have all notification types', () => {
      expect(NotificationType.EXPIRY_WARNING).toBe('expiry_warning')
      expect(NotificationType.EXPIRY_CRITICAL).toBe('expiry_critical')
      expect(NotificationType.EXPIRED).toBe('expired')
      expect(NotificationType.LOW_STOCK).toBe('low_stock')
    })

    it('should have all delivery statuses', () => {
      expect(DeliveryStatus.PENDING).toBe('pending')
      expect(DeliveryStatus.SENDING).toBe('sending')
      expect(DeliveryStatus.DELIVERED).toBe('delivered')
      expect(DeliveryStatus.FAILED).toBe('failed')
      expect(DeliveryStatus.RETRY).toBe('retry')
    })

    it('should have priority levels', () => {
      expect(Priority.LOW).toBe(1)
      expect(Priority.NORMAL).toBe(2)
      expect(Priority.HIGH).toBe(3)
      expect(Priority.URGENT).toBe(4)
    })
  })

  describe('checkExpiringBatches()', () => {
    it('should fetch enabled expiry rules', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { id: 'rule-1', type: 'expiry', warning_days: 7, critical_days: 3, channels: '["app"]', recipient_roles: '["HOTEL_ADMIN"]', enabled: true }
        ]
      }).mockResolvedValue({ rows: [] })

      await NotificationEngine.checkExpiringBatches()

      expect(query).toHaveBeenCalled()
      const firstCall = query.mock.calls[0][0]
      expect(firstCall).toContain('notification_rules')
    })

    it('should return 0 when no rules exist', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      const result = await NotificationEngine.checkExpiringBatches()

      expect(result).toBe(0)
    })
  })

  describe('isAlreadyNotified()', () => {
    it('should return true if notification exists within 24 hours', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'existing-notif' }] })

      const result = await NotificationEngine.isAlreadyNotified('batch-1', 'user-1', 'app')

      expect(result).toBe(true)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('notification_hash'),
        expect.any(Array)
      )
    })

    it('should return false if no recent notification exists', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      const result = await NotificationEngine.isAlreadyNotified('batch-1', 'user-1', 'app')

      expect(result).toBe(false)
    })
  })

  describe('generateHash()', () => {
    it('should generate consistent hash for same inputs', () => {
      const hash1 = NotificationEngine.generateHash('batch-1', 'user-1', 'app')
      const hash2 = NotificationEngine.generateHash('batch-1', 'user-1', 'app')
      
      expect(hash1).toBe(hash2)
    })
  })

  describe('getRecipientsForRule()', () => {
    it('should query users based on rule context', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'Admin', role: 'HOTEL_ADMIN' },
        { id: 'user-2', name: 'Manager', role: 'DEPARTMENT_MANAGER' }
      ]
      query.mockResolvedValueOnce({ rows: mockUsers })

      const rule = {
        hotel_id: 'hotel-1',
        department_id: null
      }
      const roles = ['HOTEL_ADMIN', 'DEPARTMENT_MANAGER']

      const result = await NotificationEngine.getRecipientsForRule(rule, roles)

      expect(result).toEqual(mockUsers)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name'),
        expect.arrayContaining(['hotel-1'])
      )
    })
  })

  describe('processQueue()', () => {
    it('should fetch pending notifications', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // No pending notifications

      await NotificationEngine.processQueue()

      expect(query).toHaveBeenCalled()
      const firstCall = query.mock.calls[0][0]
      expect(firstCall).toContain('pending')
      expect(firstCall).toContain('retry')
    })

    it('should return counts of delivered and failed', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      const result = await NotificationEngine.processQueue()

      expect(result).toEqual({ delivered: 0, failed: 0 })
    })
  })

  describe('sendWithRetry()', () => {
    it('should update status to sending before dispatch', async () => {
      const notification = {
        id: 'notif-1',
        batch_id: 'batch-1',
        channels: '["app"]',
        retry_count: 0
      }
      
      query
        .mockResolvedValueOnce({ rows: [] }) // Update to sending
        .mockResolvedValueOnce({ rows: [{ status: 'active' }] }) // Batch check
        .mockResolvedValueOnce({ rows: [] }) // Update to delivered

      await NotificationEngine.sendWithRetry(notification)

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'sending'"),
        ['notif-1']
      )
    })

    it('should mark as obsolete if batch was written off', async () => {
      const notification = {
        id: 'notif-1',
        batch_id: 'batch-1',
        channels: '["app"]',
        retry_count: 0
      }
      
      query
        .mockResolvedValueOnce({ rows: [] }) // Update to sending
        .mockResolvedValueOnce({ rows: [{ status: 'written_off' }] }) // Batch is written off
        .mockResolvedValueOnce({ rows: [] }) // Update to failed

      const result = await NotificationEngine.sendWithRetry(notification)

      expect(result).toBe(false)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("failure_reason = 'Batch already written off'"),
        expect.any(Array)
      )
    })
  })

  describe('getNotificationTitle()', () => {
    it('should return correct title for expired', () => {
      const batch = { product_name: 'Milk' }
      const title = NotificationEngine.getNotificationTitle(NotificationType.EXPIRED, batch)
      expect(title).toContain('просрочен')
      expect(title).toContain('Milk')
    })

    it('should return correct title for critical', () => {
      const batch = { product_name: 'Yogurt' }
      const title = NotificationEngine.getNotificationTitle(NotificationType.EXPIRY_CRITICAL, batch)
      expect(title).toContain('Критический')
      expect(title).toContain('Yogurt')
    })

    it('should return correct title for warning', () => {
      const batch = { product_name: 'Cheese' }
      const title = NotificationEngine.getNotificationTitle(NotificationType.EXPIRY_WARNING, batch)
      expect(title).toContain('истекает')
      expect(title).toContain('Cheese')
    })
  })

  describe('getNotificationMessage()', () => {
    const batch = { product_name: 'Milk', quantity: 10, unit: 'шт' }

    it('should format expired message correctly', () => {
      const message = NotificationEngine.getNotificationMessage(NotificationType.EXPIRED, batch, -1)
      expect(message).toContain('просрочена')
      expect(message).toContain('Требуется списание')
    })

    it('should format critical message correctly', () => {
      const message = NotificationEngine.getNotificationMessage(NotificationType.EXPIRY_CRITICAL, batch, 2)
      expect(message).toContain('через 2 дн.')
      expect(message).toContain('Срочно')
    })

    it('should use "сегодня" for 0 days left', () => {
      const message = NotificationEngine.getNotificationMessage(NotificationType.EXPIRY_WARNING, batch, 0)
      expect(message).toContain('сегодня')
    })

    it('should use "завтра" for 1 day left', () => {
      const message = NotificationEngine.getNotificationMessage(NotificationType.EXPIRY_WARNING, batch, 1)
      expect(message).toContain('завтра')
    })
  })

  describe('getRules()', () => {
    it('should fetch enabled rules for hotel', async () => {
      const mockRules = [
        { id: 'rule-1', type: 'expiry', warning_days: 7 }
      ]
      query.mockResolvedValueOnce({ rows: mockRules })

      const result = await NotificationEngine.getRules('hotel-1')

      expect(result).toEqual(mockRules)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('hotel_id = $1 OR hotel_id IS NULL'),
        ['hotel-1']
      )
    })
  })

  describe('upsertRule()', () => {
    it('should insert new rule with defaults', async () => {
      query.mockResolvedValueOnce({ rows: [] })

      await NotificationEngine.upsertRule({
        hotelId: 'hotel-1',
        type: 'expiry',
        name: 'Test Rule'
      })

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notification_rules'),
        expect.arrayContaining(['hotel-1', 'expiry', 'Test Rule'])
      )
    })
  })

  describe('dispatchTelegram()', () => {
    it('should throw if no chat ID available', async () => {
      const notification = {
        id: 'notif-1',
        telegram_chat_id: null,
        user_telegram_id: null
      }

      await expect(NotificationEngine.dispatchTelegram(notification))
        .rejects.toThrow('User has no Telegram chat ID')
    })

    it('should send message and store message ID', async () => {
      const notification = {
        id: 'notif-1',
        user_telegram_id: 123456,
        title: 'Test',
        message: 'Test message',
        type: NotificationType.EXPIRY_WARNING,
        data: { productName: 'Milk' }
      }

      query.mockResolvedValueOnce({ rows: [] })
      TelegramService.sendMessage.mockResolvedValueOnce({ message_id: 999 })

      await NotificationEngine.dispatchTelegram(notification)

      expect(TelegramService.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Test')
      )
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('telegram_message_id'),
        [999, 'notif-1']
      )
    })
  })

  describe('formatTelegramMessage()', () => {
    it('should include icon for expiry_critical', () => {
      const notification = {
        type: NotificationType.EXPIRY_CRITICAL,
        title: 'Critical',
        message: 'Urgent',
        data: { productName: 'Milk' }
      }

      const message = NotificationEngine.formatTelegramMessage(notification)

      expect(message).toContain('🚨')
      expect(message).toContain('*Critical*')
    })

    it('should include product details from data', () => {
      const notification = {
        type: NotificationType.EXPIRY_WARNING,
        title: 'Warning',
        message: 'Soon',
        data: { 
          productName: 'Yogurt', 
          quantity: 5, 
          unit: 'шт',
          departmentName: 'Kitchen',
          expiryDate: '2025-01-01'
        }
      }

      const message = NotificationEngine.formatTelegramMessage(notification)

      expect(message).toContain('Yogurt')
      expect(message).toContain('5 шт')
      expect(message).toContain('Kitchen')
      expect(message).toContain('2025-01-01')
    })
  })
})
