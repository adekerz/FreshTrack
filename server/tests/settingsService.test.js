/**
 * FreshTrack SettingsService Tests - Phase 7
 * Tests for hierarchical settings resolution, caching, and CRUD operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SettingsKey,
  getSettings,
  getSetting,
  setSetting,
  deleteSetting,
  clearSettingsCache,
  getSystemDefaults,
  getAllSettingsForScope
} from '../services/SettingsService.js'

// Mock the database query function
vi.mock('../db/database.js', () => ({
  query: vi.fn()
}))

import { query } from '../db/database.js'

describe('SettingsService - Phase 7: Hierarchical Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSettingsCache()
  })

  describe('SettingsKey enum', () => {
    it('should have all expiry threshold keys', () => {
      expect(SettingsKey.EXPIRY_CRITICAL_DAYS).toBe('expiry.critical.days')
      expect(SettingsKey.EXPIRY_WARNING_DAYS).toBe('expiry.warning.days')
    })

    it('should have all notification keys', () => {
      expect(SettingsKey.NOTIFY_EXPIRY_ENABLED).toBe('notify.expiry.enabled')
      expect(SettingsKey.NOTIFY_CHANNELS).toBe('notify.channels')
      expect(SettingsKey.NOTIFY_SCHEDULE).toBe('notify.schedule')
    })

    it('should have all branding keys (Phase 7.3)', () => {
      expect(SettingsKey.BRANDING_PRIMARY_COLOR).toBe('branding.primaryColor')
      expect(SettingsKey.BRANDING_SECONDARY_COLOR).toBe('branding.secondaryColor')
      expect(SettingsKey.BRANDING_ACCENT_COLOR).toBe('branding.accentColor')
      expect(SettingsKey.BRANDING_LOGO_URL).toBe('branding.logoUrl')
      expect(SettingsKey.BRANDING_LOGO_DARK).toBe('branding.logoDark')
      expect(SettingsKey.BRANDING_SITE_NAME).toBe('branding.siteName')
      expect(SettingsKey.BRANDING_COMPANY_NAME).toBe('branding.companyName')
      expect(SettingsKey.BRANDING_FAVICON_URL).toBe('branding.faviconUrl')
      expect(SettingsKey.BRANDING_WELCOME_MESSAGE).toBe('branding.welcomeMessage')
    })

    it('should have all locale keys (Phase 7.4)', () => {
      expect(SettingsKey.LOCALE_LANGUAGE).toBe('locale.language')
      expect(SettingsKey.LOCALE_DATE_FORMAT).toBe('locale.dateFormat')
      expect(SettingsKey.LOCALE_TIME_FORMAT).toBe('locale.timeFormat')
      expect(SettingsKey.LOCALE_CURRENCY).toBe('locale.currency')
      expect(SettingsKey.LOCALE_TIMEZONE).toBe('locale.timezone')
    })
  })

  describe('getSystemDefaults()', () => {
    it('should return all default values', () => {
      const defaults = getSystemDefaults()
      
      expect(defaults[SettingsKey.EXPIRY_CRITICAL_DAYS]).toBe(3)
      expect(defaults[SettingsKey.EXPIRY_WARNING_DAYS]).toBe(7)
      expect(defaults[SettingsKey.NOTIFY_EXPIRY_ENABLED]).toBe(true)
      expect(defaults[SettingsKey.BRANDING_PRIMARY_COLOR]).toBe('#3B82F6')
      expect(defaults[SettingsKey.LOCALE_LANGUAGE]).toBe('ru')
    })

    it('should return a copy, not the original object', () => {
      const defaults1 = getSystemDefaults()
      const defaults2 = getSystemDefaults()
      
      defaults1[SettingsKey.EXPIRY_CRITICAL_DAYS] = 999
      
      expect(defaults2[SettingsKey.EXPIRY_CRITICAL_DAYS]).toBe(3)
    })
  })

  describe('getSettings() - Hierarchy Resolution', () => {
    it('should return system defaults when database is empty', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const settings = await getSettings({ hotelId: 'h1' })
      
      expect(settings.expiryThresholds.critical).toBe(3)
      expect(settings.expiryThresholds.warning).toBe(7)
      expect(settings.branding.primaryColor).toBe('#3B82F6')
    })

    it('should override system with hotel settings', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'expiry.critical.days', value: '3', scope: 'system' },
          { key: 'expiry.critical.days', value: '5', scope: 'hotel', hotel_id: 'h1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1' })
      
      expect(settings.expiryThresholds.critical).toBe(5)
    })

    it('should override hotel with department settings', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'expiry.warning.days', value: '7', scope: 'system' },
          { key: 'expiry.warning.days', value: '10', scope: 'hotel', hotel_id: 'h1' },
          { key: 'expiry.warning.days', value: '14', scope: 'department', department_id: 'd1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1', departmentId: 'd1' })
      
      expect(settings.expiryThresholds.warning).toBe(14)
    })

    it('should override department with user settings (highest priority)', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'display.locale', value: '"ru"', scope: 'system' },
          { key: 'display.locale', value: '"en"', scope: 'hotel', hotel_id: 'h1' },
          { key: 'display.locale', value: '"kk"', scope: 'department', department_id: 'd1' },
          { key: 'display.locale', value: '"de"', scope: 'user', user_id: 'u1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1', departmentId: 'd1', userId: 'u1' })
      
      expect(settings.display.locale).toBe('de')
    })

    it('should return structured settings object with all sections', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const settings = await getSettings({})
      
      expect(settings).toHaveProperty('expiryThresholds')
      expect(settings).toHaveProperty('notifications')
      expect(settings).toHaveProperty('display')
      expect(settings).toHaveProperty('branding')
      expect(settings).toHaveProperty('locale')
      expect(settings).toHaveProperty('fifo')
      expect(settings).toHaveProperty('stats')
      expect(settings).toHaveProperty('export')
      expect(settings).toHaveProperty('raw')
    })

    it('should parse JSON values correctly', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'notify.channels', value: '["telegram", "email"]', scope: 'system' },
          { key: 'notify.expiry.daysBefore', value: '[1, 2, 5]', scope: 'system' }
        ]
      })
      
      const settings = await getSettings({})
      
      expect(settings.notifications.channels).toEqual(['telegram', 'email'])
      expect(settings.notifications.daysBefore).toEqual([1, 2, 5])
    })
  })

  describe('getSettings() - Caching', () => {
    it('should cache settings and reuse on subsequent calls', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await getSettings({ hotelId: 'h1' })
      await getSettings({ hotelId: 'h1' })
      await getSettings({ hotelId: 'h1' })
      
      // Should only query once due to cache
      expect(query).toHaveBeenCalledTimes(1)
    })

    it('should use different cache keys for different contexts', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await getSettings({ hotelId: 'h1' })
      await getSettings({ hotelId: 'h2' })
      await getSettings({ hotelId: 'h1', departmentId: 'd1' })
      
      // Each context should trigger separate query
      expect(query).toHaveBeenCalledTimes(3)
    })

    it('should clear cache when clearSettingsCache() is called', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await getSettings({ hotelId: 'h1' })
      clearSettingsCache()
      await getSettings({ hotelId: 'h1' })
      
      // Should query twice: before and after cache clear
      expect(query).toHaveBeenCalledTimes(2)
    })
  })

  describe('getSetting() - Single Value', () => {
    it('should return single setting value', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'expiry.critical.days', value: '5', scope: 'hotel' }
        ]
      })
      
      const value = await getSetting(SettingsKey.EXPIRY_CRITICAL_DAYS, { hotelId: 'h1' })
      
      expect(value).toBe(5)
    })

    it('should return system default if setting not found', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const value = await getSetting(SettingsKey.EXPIRY_CRITICAL_DAYS, {})
      
      expect(value).toBe(3) // System default
    })

    it('should return null for unknown keys without defaults', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const value = await getSetting('unknown.setting.key', {})
      
      expect(value).toBeNull()
    })
  })

  describe('setSetting() - Write Operations', () => {
    it('should upsert setting with correct scope', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await setSetting(SettingsKey.EXPIRY_CRITICAL_DAYS, 5, {
        scope: 'hotel',
        hotelId: 'h1'
      })
      
      expect(query).toHaveBeenCalled()
      const upsertCall = query.mock.calls.find(c => c[0].includes('INSERT INTO settings'))
      expect(upsertCall).toBeDefined()
      expect(upsertCall[0]).toContain('ON CONFLICT')
      expect(upsertCall[1]).toContain(SettingsKey.EXPIRY_CRITICAL_DAYS)
      expect(upsertCall[1]).toContain('hotel')
    })

    it('should require hotelId for hotel scope', async () => {
      const result = await setSetting('key', 'value', { scope: 'hotel' })
      
      expect(result.success).toBe(false)
    })

    it('should require departmentId for department scope', async () => {
      const result = await setSetting('key', 'value', { scope: 'department' })
      
      expect(result.success).toBe(false)
    })

    it('should require userId for user scope', async () => {
      const result = await setSetting('key', 'value', { scope: 'user' })
      
      expect(result.success).toBe(false)
    })

    it('should clear cache after setting value', async () => {
      query.mockResolvedValue({ rows: [] })
      
      // Prime the cache
      await getSettings({ hotelId: 'h1' })
      expect(query).toHaveBeenCalledTimes(1)
      
      // Set a value (should clear cache) - 2 calls: get before + upsert
      await setSetting('key', 'value', { scope: 'hotel', hotelId: 'h1' })
      
      // Get settings again (should query DB)
      await getSettings({ hotelId: 'h1' })
      expect(query).toHaveBeenCalledTimes(4) // Initial + get before + upsert + second get
    })

    it('should serialize objects as JSON', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await setSetting(SettingsKey.NOTIFY_CHANNELS, ['telegram', 'email'], {
        scope: 'system'
      })
      
      // Find the INSERT call (second call after the SELECT for before value)
      const insertCall = query.mock.calls.find(c => c[0].includes('INSERT INTO settings'))
      expect(insertCall[1][1]).toBe('["telegram","email"]')
    })

    it('should return before and after values', async () => {
      // First call: get before value, returns existing value
      query.mockResolvedValueOnce({ rows: [{ value: '"old"' }] })
      // Second call: upsert
      query.mockResolvedValueOnce({ rows: [] })
      
      const result = await setSetting('test.key', 'new', { scope: 'system' })
      
      expect(result.success).toBe(true)
      expect(result.before).toBe('old')
      expect(result.after).toBe('new')
    })
  })

  describe('deleteSetting()', () => {
    it('should delete setting with correct conditions', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await deleteSetting(SettingsKey.EXPIRY_CRITICAL_DAYS, {
        scope: 'user',
        userId: 'u1'
      })
      
      expect(query).toHaveBeenCalled()
      const call = query.mock.calls[0]
      expect(call[0]).toContain('DELETE FROM settings')
      expect(call[0]).toContain('user_id')
    })

    it('should clear cache after deletion', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await getSettings({ userId: 'u1' })
      await deleteSetting('key', { scope: 'user', userId: 'u1' })
      await getSettings({ userId: 'u1' })
      
      // Initial get + delete + second get
      expect(query).toHaveBeenCalledTimes(3)
    })
  })

  describe('getAllSettingsForScope()', () => {
    it('should fetch all settings for system scope', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'key1', value: '"value1"', scope: 'system' },
          { key: 'key2', value: '123', scope: 'system' }
        ]
      })
      
      const settings = await getAllSettingsForScope('system', {})
      
      expect(settings).toHaveLength(2)
      expect(settings[0].value).toBe('value1')
      expect(settings[1].value).toBe(123)
    })

    it('should filter by hotelId for hotel scope', async () => {
      query.mockResolvedValue({ rows: [] })
      
      await getAllSettingsForScope('hotel', { hotelId: 'h1' })
      
      const call = query.mock.calls[0]
      expect(call[0]).toContain('hotel_id')
      expect(call[1]).toContain('h1')
    })
  })

  describe('Branding Settings (Phase 7.3)', () => {
    it('should resolve branding settings with hierarchy', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'branding.primaryColor', value: '"#FF0000"', scope: 'hotel', hotel_id: 'h1' },
          { key: 'branding.siteName', value: '"Hotel Brand"', scope: 'hotel', hotel_id: 'h1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1' })
      
      expect(settings.branding.primaryColor).toBe('#FF0000')
      expect(settings.branding.siteName).toBe('Hotel Brand')
      // Secondary should fall back to default
      expect(settings.branding.secondaryColor).toBe('#10B981')
    })

    it('should allow department to override hotel branding', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'branding.primaryColor', value: '"#FF0000"', scope: 'hotel', hotel_id: 'h1' },
          { key: 'branding.primaryColor', value: '"#00FF00"', scope: 'department', department_id: 'd1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1', departmentId: 'd1' })
      
      expect(settings.branding.primaryColor).toBe('#00FF00')
    })
  })

  describe('Locale Settings (Phase 7.4)', () => {
    it('should resolve locale settings with hierarchy', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'locale.language', value: '"en"', scope: 'hotel', hotel_id: 'h1' },
          { key: 'locale.language', value: '"de"', scope: 'user', user_id: 'u1' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1', userId: 'u1' })
      
      // User preference overrides hotel
      expect(settings.locale.language).toBe('de')
    })

    it('should have all locale fields in structured settings', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const settings = await getSettings({})
      
      expect(settings.locale).toHaveProperty('language')
      expect(settings.locale).toHaveProperty('dateFormat')
      expect(settings.locale).toHaveProperty('timeFormat')
      expect(settings.locale).toHaveProperty('currency')
      expect(settings.locale).toHaveProperty('timezone')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing system default gracefully', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const value = await getSetting('non.existent.key', {})
      
      expect(value).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      query.mockRejectedValue(new Error('DB connection failed'))
      
      const settings = await getSettings({})
      
      // Should return defaults on error
      expect(settings.expiryThresholds.critical).toBe(3)
    })

    it('should handle malformed JSON values', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'some.key', value: 'not-valid-json{', scope: 'system' }
        ]
      })
      
      const settings = await getSettings({})
      
      // Should return the string as-is if not valid JSON
      expect(settings.raw['some.key']).toBe('not-valid-json{')
    })

    it('should handle null values in database', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'some.key', value: null, scope: 'system' }
        ]
      })
      
      const settings = await getSettings({})
      
      expect(settings.raw['some.key']).toBeNull()
    })

    it('should handle empty context', async () => {
      query.mockResolvedValue({ rows: [] })
      
      const settings = await getSettings({})
      
      expect(settings).toBeDefined()
      expect(settings.expiryThresholds.critical).toBe(3)
    })
  })

  describe('Performance - N+1 Prevention', () => {
    it('should fetch all settings in single query', async () => {
      query.mockResolvedValue({
        rows: [
          { key: 'expiry.critical.days', value: '5', scope: 'hotel' },
          { key: 'expiry.warning.days', value: '10', scope: 'hotel' },
          { key: 'notify.expiry.enabled', value: 'true', scope: 'hotel' }
        ]
      })
      
      const settings = await getSettings({ hotelId: 'h1' })
      
      // Access multiple settings
      const critical = settings.expiryThresholds.critical
      const warning = settings.expiryThresholds.warning
      const enabled = settings.notifications.enabled
      
      // Should only have made 1 query total
      expect(query).toHaveBeenCalledTimes(1)
      expect(critical).toBe(5)
      expect(warning).toBe(10)
      expect(enabled).toBe(true)
    })
  })
})
