/**
 * FreshTrack Settings Service
 * ═══════════════════════════════════════════════════════════════
 * Hierarchical settings management with inheritance:
 * System → Hotel → Department → User
 * 
 * Settings are resolved with priority:
 * 1. User-specific settings (highest priority)
 * 2. Department settings
 * 3. Hotel settings
 * 4. System defaults (lowest priority)
 */

import { query } from '../db/database.js'

/**
 * Settings keys enum
 */
export const SettingsKey = {
  // Expiry thresholds
  EXPIRY_CRITICAL_DAYS: 'expiry.critical.days',
  EXPIRY_WARNING_DAYS: 'expiry.warning.days',
  
  // Notification settings
  NOTIFY_EXPIRY_ENABLED: 'notify.expiry.enabled',
  NOTIFY_EXPIRY_DAYS_BEFORE: 'notify.expiry.daysBefore',
  NOTIFY_CHANNELS: 'notify.channels', // ['telegram', 'push', 'email']
  NOTIFY_SCHEDULE: 'notify.schedule', // 'immediate', 'daily', 'weekly'
  
  // Display settings
  DISPLAY_DATE_FORMAT: 'display.dateFormat',
  DISPLAY_LOCALE: 'display.locale',
  DISPLAY_TIMEZONE: 'display.timezone',
  
  // Branding settings (Phase 7.3)
  BRANDING_PRIMARY_COLOR: 'branding.primaryColor',
  BRANDING_SECONDARY_COLOR: 'branding.secondaryColor',
  BRANDING_ACCENT_COLOR: 'branding.accentColor',
  BRANDING_LOGO_URL: 'branding.logoUrl',
  BRANDING_LOGO_DARK: 'branding.logoDark',
  BRANDING_SITE_NAME: 'branding.siteName',
  BRANDING_COMPANY_NAME: 'branding.companyName',
  BRANDING_FAVICON_URL: 'branding.faviconUrl',
  BRANDING_WELCOME_MESSAGE: 'branding.welcomeMessage',
  
  // Locale settings (Phase 7.4)
  LOCALE_LANGUAGE: 'locale.language',
  LOCALE_DATE_FORMAT: 'locale.dateFormat',
  LOCALE_TIME_FORMAT: 'locale.timeFormat',
  LOCALE_CURRENCY: 'locale.currency',
  LOCALE_TIMEZONE: 'locale.timezone',
  
  // FIFO settings
  FIFO_ENABLED: 'fifo.enabled',
  FIFO_SORT_BY: 'fifo.sortBy', // 'expiry_date', 'production_date'
  
  // Statistics settings
  STATS_DEFAULT_PERIOD: 'stats.defaultPeriod', // 'week', 'month', 'quarter'
  
  // Export settings
  EXPORT_DEFAULT_FORMAT: 'export.defaultFormat', // 'xlsx', 'csv', 'pdf'
}

/**
 * System defaults (fallback values)
 */
const SYSTEM_DEFAULTS = {
  [SettingsKey.EXPIRY_CRITICAL_DAYS]: 3,
  [SettingsKey.EXPIRY_WARNING_DAYS]: 7,
  [SettingsKey.NOTIFY_EXPIRY_ENABLED]: true,
  [SettingsKey.NOTIFY_EXPIRY_DAYS_BEFORE]: [1, 3, 7],
  [SettingsKey.NOTIFY_CHANNELS]: ['telegram', 'push'],
  [SettingsKey.NOTIFY_SCHEDULE]: 'daily',
  [SettingsKey.DISPLAY_DATE_FORMAT]: 'dd.MM.yyyy',
  [SettingsKey.DISPLAY_LOCALE]: 'ru',
  [SettingsKey.DISPLAY_TIMEZONE]: 'Asia/Almaty',
  
  // Branding defaults (Phase 7.3)
  [SettingsKey.BRANDING_PRIMARY_COLOR]: '#3B82F6',  // Blue-500
  [SettingsKey.BRANDING_SECONDARY_COLOR]: '#10B981', // Emerald-500
  [SettingsKey.BRANDING_ACCENT_COLOR]: '#F59E0B', // Amber-500
  [SettingsKey.BRANDING_LOGO_URL]: '/assets/logo.svg',
  [SettingsKey.BRANDING_LOGO_DARK]: '/assets/logo-dark.svg',
  [SettingsKey.BRANDING_SITE_NAME]: 'FreshTrack',
  [SettingsKey.BRANDING_COMPANY_NAME]: 'FreshTrack Inc.',
  [SettingsKey.BRANDING_FAVICON_URL]: '/favicon.ico',
  [SettingsKey.BRANDING_WELCOME_MESSAGE]: 'Добро пожаловать в FreshTrack!',
  
  // Locale defaults (Phase 7.4)
  [SettingsKey.LOCALE_LANGUAGE]: 'ru',
  [SettingsKey.LOCALE_DATE_FORMAT]: 'DD.MM.YYYY',
  [SettingsKey.LOCALE_TIME_FORMAT]: 'HH:mm',
  [SettingsKey.LOCALE_CURRENCY]: 'KZT',
  [SettingsKey.LOCALE_TIMEZONE]: 'Asia/Almaty',
  
  [SettingsKey.FIFO_ENABLED]: true,
  [SettingsKey.FIFO_SORT_BY]: 'expiry_date',
  [SettingsKey.STATS_DEFAULT_PERIOD]: 'month',
  [SettingsKey.EXPORT_DEFAULT_FORMAT]: 'xlsx'
}

// Cache for settings (with TTL)
const settingsCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Build cache key for context
 */
function getCacheKey(context) {
  const { hotelId, departmentId, userId } = context
  return `settings:${hotelId || 'sys'}:${departmentId || 'all'}:${userId || 'all'}`
}

/**
 * Get raw settings from database
 * @param {Object} context - { hotelId, departmentId, userId }
 * @returns {Object} - Settings map
 */
async function fetchSettingsFromDb(context) {
  const { hotelId, departmentId, userId } = context
  
  try {
    // Query all applicable settings with hierarchy
    let queryText = `
      SELECT 
        key, 
        value, 
        scope,
        hotel_id,
        department_id,
        user_id
      FROM settings 
      WHERE 
        (scope = 'system')
        OR (scope = 'hotel' AND hotel_id = $1)
        OR (scope = 'department' AND department_id = $2)
        OR (scope = 'user' AND user_id = $3)
      ORDER BY 
        CASE scope 
          WHEN 'system' THEN 1 
          WHEN 'hotel' THEN 2 
          WHEN 'department' THEN 3 
          WHEN 'user' THEN 4 
        END ASC
    `
    
    const result = await query(queryText, [hotelId, departmentId, userId])
    
    // Build settings map with hierarchy override
    const settings = {}
    for (const row of result.rows) {
      // Later entries (higher priority) override earlier ones
      settings[row.key] = parseSettingValue(row.value)
    }
    
    return settings
  } catch (error) {
    // Table might not exist yet, return empty
    console.warn('Settings table not found, using defaults')
    return {}
  }
}

/**
 * Parse setting value from database JSON
 */
function parseSettingValue(value) {
  if (value === null || value === undefined) return null
  
  try {
    // If it's already an object, return as-is
    if (typeof value === 'object') return value
    
    // Try to parse as JSON
    return JSON.parse(value)
  } catch {
    // Return as string if not JSON
    return value
  }
}

/**
 * Get settings with hierarchical inheritance
 * @param {Object} context - { hotelId, departmentId, userId }
 * @returns {Object} - Resolved settings
 */
export async function getSettings(context = {}) {
  const cacheKey = getCacheKey(context)
  const cached = settingsCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.settings
  }
  
  // Fetch from DB
  const dbSettings = await fetchSettingsFromDb(context)
  
  // Merge with system defaults (defaults are lowest priority)
  const mergedSettings = {
    ...SYSTEM_DEFAULTS,
    ...dbSettings
  }
  
  // Build structured settings object
  const settings = buildStructuredSettings(mergedSettings)
  
  // Cache the result
  settingsCache.set(cacheKey, { settings, timestamp: Date.now() })
  
  return settings
}

/**
 * Build structured settings object from flat key-value map
 */
function buildStructuredSettings(flatSettings) {
  return {
    expiryThresholds: {
      critical: flatSettings[SettingsKey.EXPIRY_CRITICAL_DAYS],
      warning: flatSettings[SettingsKey.EXPIRY_WARNING_DAYS]
    },
    notifications: {
      enabled: flatSettings[SettingsKey.NOTIFY_EXPIRY_ENABLED],
      daysBefore: flatSettings[SettingsKey.NOTIFY_EXPIRY_DAYS_BEFORE],
      channels: flatSettings[SettingsKey.NOTIFY_CHANNELS],
      schedule: flatSettings[SettingsKey.NOTIFY_SCHEDULE]
    },
    display: {
      dateFormat: flatSettings[SettingsKey.DISPLAY_DATE_FORMAT],
      locale: flatSettings[SettingsKey.DISPLAY_LOCALE],
      timezone: flatSettings[SettingsKey.DISPLAY_TIMEZONE]
    },
    // Phase 7.3: Branding settings
    branding: {
      primaryColor: flatSettings[SettingsKey.BRANDING_PRIMARY_COLOR],
      secondaryColor: flatSettings[SettingsKey.BRANDING_SECONDARY_COLOR],
      accentColor: flatSettings[SettingsKey.BRANDING_ACCENT_COLOR],
      logoUrl: flatSettings[SettingsKey.BRANDING_LOGO_URL],
      logoDark: flatSettings[SettingsKey.BRANDING_LOGO_DARK],
      siteName: flatSettings[SettingsKey.BRANDING_SITE_NAME],
      companyName: flatSettings[SettingsKey.BRANDING_COMPANY_NAME],
      faviconUrl: flatSettings[SettingsKey.BRANDING_FAVICON_URL],
      welcomeMessage: flatSettings[SettingsKey.BRANDING_WELCOME_MESSAGE]
    },
    // Phase 7.4: Locale settings
    locale: {
      language: flatSettings[SettingsKey.LOCALE_LANGUAGE],
      dateFormat: flatSettings[SettingsKey.LOCALE_DATE_FORMAT],
      timeFormat: flatSettings[SettingsKey.LOCALE_TIME_FORMAT],
      currency: flatSettings[SettingsKey.LOCALE_CURRENCY],
      timezone: flatSettings[SettingsKey.LOCALE_TIMEZONE]
    },
    fifo: {
      enabled: flatSettings[SettingsKey.FIFO_ENABLED],
      sortBy: flatSettings[SettingsKey.FIFO_SORT_BY]
    },
    stats: {
      defaultPeriod: flatSettings[SettingsKey.STATS_DEFAULT_PERIOD]
    },
    export: {
      defaultFormat: flatSettings[SettingsKey.EXPORT_DEFAULT_FORMAT]
    },
    // Raw access to any setting
    raw: flatSettings
  }
}

/**
 * Get a single setting value
 * @param {string} key - Setting key
 * @param {Object} context - { hotelId, departmentId, userId }
 * @returns {any} - Setting value
 */
export async function getSetting(key, context = {}) {
  const settings = await getSettings(context)
  return settings.raw[key] ?? SYSTEM_DEFAULTS[key] ?? null
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @param {Object} context - { scope, hotelId, departmentId, userId }
 * @returns {Object} - { success, before, after }
 */
export async function setSetting(key, value, context = {}) {
  const { scope = 'system', hotelId, departmentId, userId } = context
  
  try {
    // Validate scope
    if (scope === 'hotel' && !hotelId) throw new Error('hotelId required for hotel scope')
    if (scope === 'department' && !departmentId) throw new Error('departmentId required for department scope')
    if (scope === 'user' && !userId) throw new Error('userId required for user scope')
    
    // Get current value for before snapshot
    let beforeValue = null
    try {
      const existing = await query(`
        SELECT value FROM settings 
        WHERE key = $1 AND scope = $2 
          AND COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000') = COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000')
          AND COALESCE(department_id, '00000000-0000-0000-0000-000000000000') = COALESCE($4::uuid, '00000000-0000-0000-0000-000000000000')
          AND COALESCE(user_id, '00000000-0000-0000-0000-000000000000') = COALESCE($5::uuid, '00000000-0000-0000-0000-000000000000')
      `, [key, scope, hotelId || null, departmentId || null, userId || null])
      if (existing.rows.length > 0) {
        beforeValue = parseSettingValue(existing.rows[0].value)
      }
    } catch {
      // Ignore if can't get before value
    }
    
    // Upsert setting
    const valueJson = JSON.stringify(value)
    
    await query(`
      INSERT INTO settings (id, key, value, scope, hotel_id, department_id, user_id, updated_at)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (key, scope, COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000'), COALESCE(department_id, '00000000-0000-0000-0000-000000000000'), COALESCE(user_id, '00000000-0000-0000-0000-000000000000'))
      DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
    `, [key, valueJson, scope, hotelId || null, departmentId || null, userId || null])
    
    // Clear cache
    clearSettingsCache(context)
    
    return { success: true, before: beforeValue, after: value }
  } catch (error) {
    console.error('Failed to save setting:', error)
    return { success: false, before: null, after: null }
  }
}

/**
 * Delete a setting
 * @param {string} key - Setting key
 * @param {Object} context - { scope, hotelId, departmentId, userId }
 */
export async function deleteSetting(key, context = {}) {
  const { scope = 'system', hotelId, departmentId, userId } = context
  
  try {
    let queryText = 'DELETE FROM settings WHERE key = $1 AND scope = $2'
    const params = [key, scope]
    
    if (hotelId) {
      queryText += ' AND hotel_id = $' + (params.length + 1)
      params.push(hotelId)
    }
    if (departmentId) {
      queryText += ' AND department_id = $' + (params.length + 1)
      params.push(departmentId)
    }
    if (userId) {
      queryText += ' AND user_id = $' + (params.length + 1)
      params.push(userId)
    }
    
    await query(queryText, params)
    clearSettingsCache(context)
    
    return true
  } catch (error) {
    console.error('Failed to delete setting:', error)
    return false
  }
}

/**
 * Clear settings cache
 * @param {Object} context - Optional context to clear specific cache
 */
export function clearSettingsCache(context = null) {
  if (context) {
    // Clear specific context cache
    const cacheKey = getCacheKey(context)
    settingsCache.delete(cacheKey)
    
    // Also clear parent caches that might include this context
    if (context.userId) {
      settingsCache.delete(getCacheKey({ ...context, userId: null }))
    }
    if (context.departmentId) {
      settingsCache.delete(getCacheKey({ ...context, departmentId: null, userId: null }))
    }
    if (context.hotelId) {
      settingsCache.delete(getCacheKey({ hotelId: context.hotelId }))
    }
  } else {
    // Clear entire cache
    settingsCache.clear()
  }
}

/**
 * Get system defaults
 * @returns {Object} - System default values
 */
export function getSystemDefaults() {
  return { ...SYSTEM_DEFAULTS }
}

/**
 * Get all settings for a scope (for admin UI)
 * @param {string} scope - Scope type
 * @param {Object} context - { hotelId, departmentId, userId }
 * @returns {Array} - Settings records
 */
export async function getAllSettingsForScope(scope, context = {}) {
  const { hotelId, departmentId, userId } = context
  
  let queryText = 'SELECT * FROM settings WHERE scope = $1'
  const params = [scope]
  
  if (scope === 'hotel' && hotelId) {
    queryText += ' AND hotel_id = $2'
    params.push(hotelId)
  } else if (scope === 'department' && departmentId) {
    queryText += ' AND department_id = $2'
    params.push(departmentId)
  } else if (scope === 'user' && userId) {
    queryText += ' AND user_id = $2'
    params.push(userId)
  }
  
  queryText += ' ORDER BY key'
  
  try {
    const result = await query(queryText, params)
    return result.rows.map(row => ({
      ...row,
      value: parseSettingValue(row.value)
    }))
  } catch {
    return []
  }
}

export default {
  SettingsKey,
  getSettings,
  getSetting,
  setSetting,
  deleteSetting,
  clearSettingsCache,
  getSystemDefaults,
  getAllSettingsForScope
}
