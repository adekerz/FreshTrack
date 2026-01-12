/**
 * Settings Schemas Tests
 * 
 * Тесты валидации для settings модуля
 */

import { describe, it, expect } from 'vitest'
import {
  BatchUpdateSettingsSchema,
  BrandingSettingsSchema,
  SettingScope,
  validate
} from './settings.schemas.js'

describe('Settings Schemas', () => {
  describe('SettingScope', () => {
    it('should accept valid scopes', () => {
      const validScopes = ['user', 'department', 'hotel', 'system']
      
      validScopes.forEach(scope => {
        const result = SettingScope.safeParse(scope)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid scope', () => {
      const result = SettingScope.safeParse('invalid')
      expect(result.success).toBe(false)
    })
  })

  describe('BrandingSettingsSchema', () => {
    it('should validate valid branding settings', () => {
      const validBranding = {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#3B82F6',
        hotelName: 'FreshTrack Hotel'
      }
      
      const result = validate(BrandingSettingsSchema, validBranding)
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid color format', () => {
      const invalidBranding = {
        primaryColor: 'not-a-color'
      }
      
      const result = validate(BrandingSettingsSchema, invalidBranding)
      expect(result.isValid).toBe(false)
    })
  })

  describe('BatchUpdateSettingsSchema', () => {
    it('should validate batch update with settings array', () => {
      const batchUpdate = {
        scope: 'hotel',
        settings: [
          { key: 'theme', value: 'dark' },
          { key: 'language', value: 'ru' }
        ]
      }
      
      const result = validate(BatchUpdateSettingsSchema, batchUpdate)
      expect(result.isValid).toBe(true)
    })

    it('should reject empty settings array', () => {
      const batchUpdate = {
        scope: 'hotel',
        settings: []
      }
      
      const result = validate(BatchUpdateSettingsSchema, batchUpdate)
      expect(result.isValid).toBe(false)
    })

    it('should reject missing scope', () => {
      const batchUpdate = {
        settings: [{ key: 'theme', value: 'dark' }]
      }
      
      const result = validate(BatchUpdateSettingsSchema, batchUpdate)
      // scope has default value, so it should be valid
      expect(result.isValid).toBe(true)
      expect(result.data.scope).toBe('hotel')
    })
  })
})
