/**
 * Settings Controller
 * 
 * HTTP обработчики для settings endpoints.
 * Phase 7: Hierarchical Settings System
 */

import { Router } from 'express'
import {
  BatchUpdateSettingsSchema,
  BrandingSettingsSchema,
  SettingsQuerySchema,
  validate
} from './settings.schemas.js'
import {
  authMiddleware,
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import {
  getSettings as getHierarchicalSettings,
  getSetting as getHierarchicalSetting,
  setSetting,
  deleteSetting,
  getAllSettingsForScope,
  clearSettingsCache
} from '../../services/SettingsService.js'
import { getHotelThresholds } from '../../services/ExpiryService.js'
import sseManager from '../../services/SSEManager.js'
import { logError, logInfo, logDebug } from '../../utils/logger.js'
import { query as dbQuery } from '../../db/postgres.js'

const router = Router()

// ========================================
// Branding Settings (public endpoints)
// ========================================

// Legacy branding keys (snake_case) - used for hotel-level settings
const LEGACY_BRANDING_KEYS = [
  'app_name', 'company_name', 'welcome_message', 'app_tagline', 'dashboard_title',
  'logo_url', 'logo_dark_url', 'favicon_url',
  'primary_color', 'secondary_color', 'accent_color', 'danger_color',
  'footer_text', 'support_email', 'support_phone', 'custom_css'
]

// Mapping from frontend camelCase to SettingsService keys (branding.*)
const BRANDING_KEY_MAP = {
  siteName: 'branding.siteName',
  appName: 'branding.siteName',
  logoUrl: 'branding.logoUrl',
  logoDarkUrl: 'branding.logoDark',
  faviconUrl: 'branding.faviconUrl',
  primaryColor: 'branding.primaryColor',
  secondaryColor: 'branding.secondaryColor',
  accentColor: 'branding.accentColor',
  dangerColor: 'branding.dangerColor',
  footerText: 'footer_text',
  companyName: 'branding.companyName',
  welcomeMessage: 'branding.welcomeMessage',
  customCss: 'custom_css',
  // Legacy snake_case → new keys
  app_name: 'branding.siteName',
  logo_url: 'branding.logoUrl',
  logo_dark_url: 'branding.logoDark',
  favicon_url: 'branding.faviconUrl',
  primary_color: 'branding.primaryColor',
  secondary_color: 'branding.secondaryColor',
  accent_color: 'branding.accentColor',
  danger_color: 'branding.dangerColor',
  company_name: 'branding.companyName',
  welcome_message: 'branding.welcomeMessage'
}

// Valid branding keys (new format)
const BRANDING_KEYS = [
  'branding.siteName',
  'branding.logoUrl',
  'branding.logoDark',
  'branding.faviconUrl',
  'branding.primaryColor',
  'branding.secondaryColor',
  'branding.accentColor',
  'branding.dangerColor',
  'branding.companyName',
  'branding.welcomeMessage',
  'footer_text',
  'custom_css'
]

// Normalize branding key (camelCase/snake_case → branding.*)
function normalizeBrandingKey(key) {
  return BRANDING_KEY_MAP[key] || key
}

const BRANDING_DEFAULTS = {
  app_name: 'FreshTrack',
  app_tagline: 'Совершенство управления',
  company_name: 'FreshTrack Inc.',
  dashboard_title: 'Панель управления',
  welcome_message: 'Добро пожаловать в FreshTrack!',
  logo_url: '/assets/logo.svg',
  logo_dark_url: '/assets/logo-dark.svg',
  favicon_url: '/favicon.ico',
  primary_color: '#FF8D6B',
  secondary_color: '#10B981',
  accent_color: '#F59E0B',
  danger_color: '#C4554D',
  footer_text: '© 2025 FreshTrack. All rights reserved.',
  support_email: 'support@freshtrack.app',
  support_phone: ''
}

/**
 * GET /api/settings/thresholds
 * Get expiry thresholds for current hotel (from notification_rules)
 */
router.get('/thresholds', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const thresholds = await getHotelThresholds(req.hotelId)
    res.json({
      success: true,
      thresholds: {
        warning: thresholds.warning,
        critical: thresholds.critical
      }
    })
  } catch (error) {
    logError('Get thresholds error', error)
    res.status(500).json({ success: false, error: 'Failed to get thresholds' })
  }
})

/**
 * GET /api/settings/branding
 * Get branding settings for current hotel (requires auth)
 */
router.get('/branding', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }

    const allSettings = await getHierarchicalSettings(context)

    // Raw settings contain all flat key-value pairs including legacy snake_case keys
    const raw = allSettings.raw || {}

    // Map from structured settings to flat branding object (snake_case for legacy + camelCase for frontend)
    // Priority: new branding.* keys (raw) > structured settings > legacy snake_case keys > defaults
    const branding = {
      // snake_case (legacy)
      app_name: raw['branding.siteName'] ?? allSettings.branding?.siteName ?? raw.app_name ?? BRANDING_DEFAULTS.app_name,
      app_tagline: raw.app_tagline ?? BRANDING_DEFAULTS.app_tagline,
      company_name: raw['branding.companyName'] ?? allSettings.branding?.companyName ?? raw.company_name ?? BRANDING_DEFAULTS.company_name,
      dashboard_title: raw.dashboard_title ?? BRANDING_DEFAULTS.dashboard_title,
      welcome_message: raw['branding.welcomeMessage'] ?? allSettings.branding?.welcomeMessage ?? raw.welcome_message ?? BRANDING_DEFAULTS.welcome_message,
      logo_url: raw['branding.logoUrl'] ?? allSettings.branding?.logoUrl ?? raw.logo_url ?? BRANDING_DEFAULTS.logo_url,
      logo_dark_url: raw['branding.logoDark'] ?? allSettings.branding?.logoDark ?? raw.logo_dark_url ?? BRANDING_DEFAULTS.logo_dark_url,
      favicon_url: raw['branding.faviconUrl'] ?? allSettings.branding?.faviconUrl ?? raw.favicon_url ?? BRANDING_DEFAULTS.favicon_url,
      primary_color: raw['branding.primaryColor'] ?? allSettings.branding?.primaryColor ?? raw.primary_color ?? BRANDING_DEFAULTS.primary_color,
      secondary_color: raw['branding.secondaryColor'] ?? allSettings.branding?.secondaryColor ?? raw.secondary_color ?? BRANDING_DEFAULTS.secondary_color,
      accent_color: raw['branding.accentColor'] ?? allSettings.branding?.accentColor ?? raw.accent_color ?? BRANDING_DEFAULTS.accent_color,
      danger_color: raw['branding.dangerColor'] ?? allSettings.branding?.dangerColor ?? raw.danger_color ?? BRANDING_DEFAULTS.danger_color,
      footer_text: raw.footer_text ?? BRANDING_DEFAULTS.footer_text,
      support_email: raw.support_email ?? BRANDING_DEFAULTS.support_email,
      support_phone: raw.support_phone ?? BRANDING_DEFAULTS.support_phone,
      custom_css: raw.custom_css ?? allSettings.branding?.customCss ?? null,

      // camelCase (frontend compatibility)
      siteName: raw['branding.siteName'] ?? allSettings.branding?.siteName ?? raw.app_name ?? BRANDING_DEFAULTS.app_name,
      logoUrl: raw['branding.logoUrl'] ?? allSettings.branding?.logoUrl ?? raw.logo_url ?? BRANDING_DEFAULTS.logo_url,
      logoDarkUrl: raw['branding.logoDark'] ?? allSettings.branding?.logoDark ?? raw.logo_dark_url ?? BRANDING_DEFAULTS.logo_dark_url,
      faviconUrl: raw['branding.faviconUrl'] ?? allSettings.branding?.faviconUrl ?? raw.favicon_url ?? BRANDING_DEFAULTS.favicon_url,
      primaryColor: raw['branding.primaryColor'] ?? allSettings.branding?.primaryColor ?? raw.primary_color ?? BRANDING_DEFAULTS.primary_color,
      secondaryColor: raw['branding.secondaryColor'] ?? allSettings.branding?.secondaryColor ?? raw.secondary_color ?? BRANDING_DEFAULTS.secondary_color,
      accentColor: raw['branding.accentColor'] ?? allSettings.branding?.accentColor ?? raw.accent_color ?? BRANDING_DEFAULTS.accent_color,
      dangerColor: raw['branding.dangerColor'] ?? allSettings.branding?.dangerColor ?? raw.danger_color ?? BRANDING_DEFAULTS.danger_color,
      companyName: raw['branding.companyName'] ?? allSettings.branding?.companyName ?? raw.company_name ?? BRANDING_DEFAULTS.company_name,
      welcomeMessage: raw['branding.welcomeMessage'] ?? allSettings.branding?.welcomeMessage ?? raw.welcome_message ?? BRANDING_DEFAULTS.welcome_message,
      customCss: raw.custom_css ?? allSettings.branding?.customCss ?? null
    }

    res.json({ success: true, branding })
  } catch (error) {
    logError('Get branding settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get branding settings' })
  }
})

/**
 * PUT /api/settings/branding
 * Update branding settings for current hotel
 */
router.put('/branding', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { branding } = req.body

    if (!branding || typeof branding !== 'object') {
      return res.status(400).json({ success: false, error: 'Branding object is required' })
    }

    const results = []
    for (const [key, value] of Object.entries(branding)) {
      // Normalize key (camelCase/snake_case → branding.* format)
      const normalizedKey = normalizeBrandingKey(key)

      // Check if it's a valid branding key
      if (BRANDING_KEYS.includes(normalizedKey)) {
        await setSetting(normalizedKey, value, {
          scope: 'hotel',
          hotelId: req.hotelId
        })
        results.push({ key: normalizedKey, originalKey: key, success: true })
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'branding_settings',
      entity_id: req.hotelId,
      details: { updatedKeys: results.map(r => r.key) },
      ip_address: req.ip
    })

    // SSE broadcast с полными данными брендинга для всех пользователей отеля
    sseManager.broadcast(req.hotelId, 'branding-update', {
      settings: branding,
      updatedKeys: results.map(r => r.key),
      timestamp: new Date().toISOString(),
      updatedBy: req.user.name
    })

    res.json({ success: true, results })
  } catch (error) {
    logError('Update branding settings error', error)
    res.status(500).json({ success: false, error: 'Failed to update branding settings' })
  }
})

/**
 * POST /api/settings/branding/reset
 * Reset branding to defaults
 */
router.post('/branding/reset', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN'

    // Delete hotel-level branding keys
    const allKeys = [...BRANDING_KEYS, ...LEGACY_BRANDING_KEYS]
    for (const key of allKeys) {
      await deleteSetting(key, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
    }

    // For SUPER_ADMIN, also reset system-level branding and login branding
    if (isSuperAdmin) {
      for (const key of allKeys) {
        await deleteSetting(key, { scope: 'system' })
      }
      // Reset login branding
      for (const key of LOGIN_BRANDING_KEYS) {
        await deleteSetting(key, { scope: 'system' })
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'reset',
      entity_type: 'branding_settings',
      entity_id: req.hotelId,
      details: { action: 'reset_to_defaults', includedSystemLevel: isSuperAdmin },
      ip_address: req.ip
    })

    // Build camelCase defaults for frontend
    const defaultBranding = {
      siteName: BRANDING_DEFAULTS.app_name,
      tagline: BRANDING_DEFAULTS.app_tagline,
      companyName: BRANDING_DEFAULTS.company_name,
      dashboardTitle: BRANDING_DEFAULTS.dashboard_title,
      welcomeMessage: BRANDING_DEFAULTS.welcome_message,
      logoUrl: BRANDING_DEFAULTS.logo_url,
      logoDarkUrl: BRANDING_DEFAULTS.logo_dark_url,
      faviconUrl: BRANDING_DEFAULTS.favicon_url,
      primaryColor: BRANDING_DEFAULTS.primary_color,
      secondaryColor: BRANDING_DEFAULTS.secondary_color,
      accentColor: BRANDING_DEFAULTS.accent_color,
      dangerColor: BRANDING_DEFAULTS.danger_color,
      footerText: BRANDING_DEFAULTS.footer_text,
      supportEmail: BRANDING_DEFAULTS.support_email,
      supportPhone: BRANDING_DEFAULTS.support_phone
    }

    // SSE broadcast с defaults для всех пользователей отеля
    sseManager.broadcast(req.hotelId, 'branding-update', {
      settings: defaultBranding,
      reset: true,
      timestamp: new Date().toISOString(),
      updatedBy: req.user.name
    })

    // For SUPER_ADMIN, also broadcast login branding reset
    if (isSuperAdmin) {
      sseManager.broadcastAll('login-branding-update', {
        loginBranding: LOGIN_BRANDING_DEFAULTS,
        reset: true,
        timestamp: new Date().toISOString(),
        updatedBy: req.user.id
      })
    }

    res.json({
      success: true,
      branding: defaultBranding,
      loginBranding: isSuperAdmin ? LOGIN_BRANDING_DEFAULTS : undefined
    })
  } catch (error) {
    logError('Reset branding settings error', error)
    res.status(500).json({ success: false, error: 'Failed to reset branding settings' })
  }
})

// ========================================
// General Settings
// ========================================

const GENERAL_DEFAULTS = {
  timezone: 'Asia/Almaty',
  dateFormat: 'DD.MM.YYYY',
  timeFormat: '24h',
  firstDayOfWeek: 'monday',
  defaultUnit: 'шт',
  showPrices: false,
  autoLogoutMinutes: 60,
  rememberDevice: true
}

const GENERAL_KEYS = Object.keys(GENERAL_DEFAULTS)

/**
 * GET /api/settings/general
 * Get general settings for current hotel
 */
router.get('/general', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }

    const allSettings = await getHierarchicalSettings(context)

    // Build general settings object with defaults
    const settings = {}
    for (const key of GENERAL_KEYS) {
      settings[key] = allSettings.general?.[key] ?? allSettings[key] ?? GENERAL_DEFAULTS[key]
    }

    res.json({ success: true, settings })
  } catch (error) {
    logError('Get general settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get general settings' })
  }
})

/**
 * PUT /api/settings/general
 * Update general settings for current hotel
 */
router.put('/general', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const settings = req.body

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }

    const results = []
    for (const [key, value] of Object.entries(settings)) {
      if (GENERAL_KEYS.includes(key)) {
        await setSetting(key, value, {
          scope: 'hotel',
          hotelId: req.hotelId
        })
        results.push({ key, success: true })
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'general_settings',
      entity_id: req.hotelId,
      details: { updatedKeys: results.map(r => r.key) },
      ip_address: req.ip
    })

    res.json({ success: true, results })
  } catch (error) {
    logError('Update general settings error', error)
    res.status(500).json({ success: false, error: 'Failed to update general settings' })
  }
})

// ========================================
// Telegram Settings
// ========================================

const TELEGRAM_DEFAULTS = {
  messageTemplates: {
    dailyReport: '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'
  }
}

/**
 * GET /api/settings/telegram
 * Get Telegram settings for current hotel
 */
router.get('/telegram', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }

    const allSettings = await getHierarchicalSettings(context)

    const messageTemplates = allSettings.telegram?.messageTemplates ??
      allSettings.raw?.['telegram.messageTemplates'] ??
      allSettings.raw?.['telegram_message_templates'] ??
      TELEGRAM_DEFAULTS.messageTemplates

    // Получаем время отправки из настроек (из raw доступа к плоским ключам)
    const sendTime = allSettings.raw?.['notify.telegram.sendTime'] ??
      allSettings.raw?.['notify.sendTime'] ??
      '09:00'

    res.json({
      success: true,
      messageTemplates,
      sendTime
    })
  } catch (error) {
    logError('Get telegram settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get telegram settings' })
  }
})

/**
 * PUT /api/settings/telegram
 * Update Telegram settings for current hotel
 */
router.put('/telegram', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { messageTemplates, sendTime, timezone } = req.body
    logInfo('PUT /telegram', `Received update: sendTime=${sendTime}, timezone=${timezone}, templatesUpdated=${!!messageTemplates}`)

    if (messageTemplates) {
      await setSetting('telegram_message_templates', messageTemplates, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      logDebug('PUT /telegram', 'Message templates saved')
    }

    // Сохраняем часовой пояс (если передан)
    if (timezone && typeof timezone === 'string') {
      logInfo('PUT /telegram', `💾 Saving timezone: ${timezone}`)
      
      // Сохраняем в SYSTEM scope (приоритет для планировщика)
      await setSetting('locale.timezone', timezone, {
        scope: 'system'
      })
      logDebug('PUT /telegram', '✅ Timezone saved to system scope')
      
      // Также сохраняем для отеля
      await setSetting('locale.timezone', timezone, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      logDebug('PUT /telegram', '✅ Timezone saved to hotel scope')
      
      // Очищаем кеш
      clearSettingsCache()
    }

    // Сохраняем время отправки уведомлений (глобально для всей системы)
    if (sendTime) {
      // Валидация формата
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid time format. Expected HH:MM (00:00 - 23:59)' 
        })
      }
      
      logInfo('PUT /telegram', `💾 Saving send time: ${sendTime}`)
      
      // Сохраняем в SYSTEM scope (приоритет для планировщика)
      await setSetting('notify.telegram.sendTime', sendTime, {
        scope: 'system'
      })
      logDebug('PUT /telegram', '✅ Saved to system scope')
      
      // Также сохраняем для отеля (для истории/аудита)
      await setSetting('notify.telegram.sendTime', sendTime, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      logDebug('PUT /telegram', '✅ Saved to hotel scope')
      
      // КРИТИЧЕСКИ ВАЖНО: очищаем кеш ПЕРЕД перепланированием
      clearSettingsCache()
      logDebug('PUT /telegram', '🗑️ Cache cleared')
      
      // Перепланируем задачу
      try {
        const { rescheduleDailyReport } = await import('../../jobs/notificationJobs.js')
        await rescheduleDailyReport()
        logInfo('PUT /telegram', `✅ Daily report rescheduled to ${sendTime}`)
      } catch (jobError) {
        logError('PUT /telegram', 'Failed to reschedule', jobError)
        // Не падаем, просто логируем
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login || 'Unknown',
      action: 'update',
      entity_type: 'telegram_settings',
      entity_id: req.hotelId,
      details: { sendTime, timezone, templatesUpdated: !!messageTemplates },
      ip_address: req.ip
    })

    res.json({ 
      success: true,
      message: sendTime ? `Notifications rescheduled to ${sendTime}` : 'Settings saved'
    })
  } catch (error) {
    logError('PUT /telegram', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update telegram settings',
      details: error.message 
    })
  }
})

/**
 * GET /api/settings/telegram/chats
 * Get linked Telegram chats for current hotel
 */
router.get('/telegram/chats', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT 
        tc.chat_id, tc.chat_title, tc.chat_type, tc.is_active, 
        tc.department_id, tc.hotel_id,
        tc.added_at, tc.notification_types, tc.language, tc.silent_mode,
        tc.warning_days, tc.critical_days,
        h.name as hotel_name, h.marsha_code as hotel_code,
        d.name as department_name
      FROM telegram_chats tc
      LEFT JOIN hotels h ON tc.hotel_id = h.id
      LEFT JOIN departments d ON tc.department_id = d.id
      WHERE tc.hotel_id = $1 AND tc.bot_removed = false
      ORDER BY tc.added_at DESC
    `, [req.hotelId])

    res.json({
      success: true,
      chats: result.rows
    })
  } catch (error) {
    logError('Get telegram chats error', error)
    res.status(500).json({ success: false, error: 'Failed to get telegram chats' })
  }
})

/**
 * PUT /api/settings/telegram/chats/:chatId
 * Update Telegram chat settings
 */
router.put('/telegram/chats/:chatId', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { chatId } = req.params
    const { is_active, notify_critical, notify_warning, notify_expired } = req.body

    const updates = []
    const values = [chatId, req.hotelId]
    let paramIndex = 3

    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }
    if (typeof notify_critical === 'boolean') {
      updates.push(`notify_critical = $${paramIndex++}`)
      values.push(notify_critical)
    }
    if (typeof notify_warning === 'boolean') {
      updates.push(`notify_warning = $${paramIndex++}`)
      values.push(notify_warning)
    }
    if (typeof notify_expired === 'boolean') {
      updates.push(`notify_expired = $${paramIndex++}`)
      values.push(notify_expired)
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' })
    }

    await dbQuery(`
      UPDATE telegram_chats
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE chat_id = $1 AND hotel_id = $2
    `, values)

    res.json({ success: true })
  } catch (error) {
    logError('Update telegram chat error', error)
    res.status(500).json({ success: false, error: 'Failed to update telegram chat' })
  }
})

/**
 * DELETE /api/settings/telegram/chats/:chatId
 * Unlink Telegram chat
 */
router.delete('/telegram/chats/:chatId', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.DELETE), async (req, res) => {
  try {
    const { chatId } = req.params

    await dbQuery(`
      UPDATE telegram_chats
      SET is_active = false, bot_removed = true, updated_at = NOW()
      WHERE chat_id = $1 AND hotel_id = $2
    `, [chatId, req.hotelId])

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'delete',
      entity_type: 'telegram_chat',
      entity_id: chatId,
      details: { unlinked: true },
      ip_address: req.ip
    })

    res.json({ success: true })
  } catch (error) {
    logError('Delete telegram chat error', error)
    res.status(500).json({ success: false, error: 'Failed to unlink telegram chat' })
  }
})

/**
 * POST /api/settings/telegram/test-notification
 * Отправить тестовое уведомление СЕЙЧАС (не ждать расписания)
 * 
 * Notifications are sent only once per day as an aggregated report
 * No per-item or real-time alerts by design (anti-spam UX)
 */
router.post('/telegram/test-notification', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    logInfo('POST /test-notification', '🧪 Manual test notification triggered')
    
    // Импортируем NotificationEngine
    const { NotificationEngine } = await import('../../services/NotificationEngine.js')
    
    // Send daily aggregated report (only notification method)
    let results = { sent: 0, telegram: 0, email: 0 }
    
    try {
      results = await NotificationEngine.sendDailyReport()
      logInfo('POST /test-notification', `📊 Daily report: ${results.sent} sent (Telegram: ${results.telegram}, Email: ${results.email})`)
    } catch (err) {
      logError('POST /test-notification', 'Daily report failed', err)
      throw err
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'test_notification',
      entity_type: 'telegram_notifications',
      entity_id: null,
      details: results,
      ip_address: req.ip
    })
    
    res.json({ 
      success: true, 
      message: 'Test notification sent (daily aggregated report)',
      results 
    })
  } catch (error) {
    logError('POST /test-notification', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send test notification',
      details: error.message
    })
  }
})

/**
 * GET /api/settings/telegram/schedule-status
 * Проверить текущее состояние планировщика
 */
router.get('/telegram/schedule-status', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { getScheduleStatus } = await import('../../jobs/notificationJobs.js')
    
    const status = await getScheduleStatus()
    
    res.json({
      success: true,
      sendTime: status.sendTime,
      timezone: status.timezone,
      currentTime: new Date().toLocaleString('ru-RU', { timeZone: status.timezone }),
      isScheduled: status.isScheduled,
      cronExpression: status.cronExpression,
      nextRun: status.nextRun,
      nextRunLocal: status.nextRunLocal
    })
  } catch (error) {
    logError('GET /schedule-status', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ========================================
// Login Branding (public)
// ========================================

// Login page text keys
const LOGIN_BRANDING_KEYS = [
  'branding.login.title',
  'branding.login.highlight',
  'branding.login.description',
  'branding.login.feature1',
  'branding.login.feature2',
  'branding.login.feature3'
]

const LOGIN_BRANDING_DEFAULTS = {
  title: 'Точность в каждой',
  highlight: 'Детали',
  description: 'Поднимаем управление запасами на новый уровень. Умный контроль сроков годности, минимизация потерь и максимальная эффективность.',
  feature1: 'Безопасно',
  feature2: 'Умные оповещения',
  feature3: 'Аналитика'
}

/**
 * GET /api/settings/login-branding
 * Get login page branding (public - no auth required)
 */
router.get('/login-branding', async (req, res) => {
  try {
    // Return system-level branding for login page
    const settingsArray = await getAllSettingsForScope('system', {})

    // Convert array to object
    const systemSettings = {}
    for (const setting of settingsArray) {
      systemSettings[setting.key] = setting.value
    }

    // Build login branding object
    const loginBranding = {
      title: systemSettings['branding.login.title'] ?? LOGIN_BRANDING_DEFAULTS.title,
      highlight: systemSettings['branding.login.highlight'] ?? LOGIN_BRANDING_DEFAULTS.highlight,
      description: systemSettings['branding.login.description'] ?? LOGIN_BRANDING_DEFAULTS.description,
      feature1: systemSettings['branding.login.feature1'] ?? LOGIN_BRANDING_DEFAULTS.feature1,
      feature2: systemSettings['branding.login.feature2'] ?? LOGIN_BRANDING_DEFAULTS.feature2,
      feature3: systemSettings['branding.login.feature3'] ?? LOGIN_BRANDING_DEFAULTS.feature3,
      // Also include site name and colors for login page styling
      siteName: systemSettings['branding.siteName'] ?? BRANDING_DEFAULTS.app_name,
      primaryColor: systemSettings['branding.primaryColor'] ?? BRANDING_DEFAULTS.primary_color
    }

    res.json({ success: true, loginBranding })
  } catch (error) {
    logError('Get login branding error', error)
    res.status(500).json({ success: false, error: 'Failed to get login branding' })
  }
})

/**
 * PUT /api/settings/login-branding
 * Update login page branding (SUPER_ADMIN only)
 */
router.put('/login-branding', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' })
    }

    const { branding } = req.body

    if (!branding || typeof branding !== 'object') {
      return res.status(400).json({ success: false, error: 'Branding object is required' })
    }

    // Map frontend keys to database keys
    const keyMap = {
      title: 'branding.login.title',
      highlight: 'branding.login.highlight',
      description: 'branding.login.description',
      feature1: 'branding.login.feature1',
      feature2: 'branding.login.feature2',
      feature3: 'branding.login.feature3'
    }

    const results = []
    for (const [key, value] of Object.entries(branding)) {
      const dbKey = keyMap[key]
      if (dbKey) {
        await setSetting(dbKey, value, { scope: 'system' })
        results.push({ key: dbKey, success: true })
      }
    }

    await logAudit({
      hotel_id: null,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'login_branding',
      entity_id: null,
      details: { updatedKeys: Object.keys(branding) },
      ip_address: req.ip
    })

    // Broadcast login branding update via SSE to all clients
    sseManager.broadcastAll('login-branding-update', {
      loginBranding: branding,
      updatedKeys: Object.keys(branding),
      timestamp: new Date().toISOString(),
      updatedBy: req.user.id
    })

    res.json({ success: true, loginBranding: branding })
  } catch (error) {
    logError('Update login branding error', error)
    res.status(500).json({ success: false, error: 'Failed to update login branding' })
  }
})

// ========================================
// User Settings (доступно всем)
// ========================================

/**
 * GET /api/settings/user
 * Получить агрегированные настройки пользователя
 */
router.get('/user', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user.id
    }

    const settings = await getHierarchicalSettings(context)

    res.json({
      success: true,
      settings,
      context: {
        scope: 'user',
        hotelId: context.hotelId,
        departmentId: context.departmentId,
        userId: context.userId
      }
    })
  } catch (error) {
    logError('Get user settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get user settings' })
  }
})

/**
 * GET /api/settings/hierarchy/:key
 * Получить значение настройки с информацией об источнике
 */
router.get('/hierarchy/:key', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { key } = req.params
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user.id
    }

    const value = await getHierarchicalSetting(key, context)

    res.json({
      success: true,
      key,
      value,
      resolved: true
    })
  } catch (error) {
    logError('Get hierarchical setting error', error)
    res.status(500).json({ success: false, error: 'Failed to get setting' })
  }
})

/**
 * PUT /api/settings/user/:key
 * Установить пользовательскую настройку
 */
router.put('/user/:key', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }

    const result = await setSetting(key, value, {
      scope: 'user',
      userId: req.user.id,
      hotelId: req.hotelId,
      departmentId: req.departmentId
    })

    if (result.success) {
      await logAudit({
        hotel_id: req.hotelId,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'user_setting',
        entity_id: null,
        details: { key, scope: 'user' },
        snapshot_before: result.before !== null ? { [key]: result.before } : null,
        snapshot_after: { [key]: result.after },
        ip_address: req.ip
      })
    }

    res.json({ success: result.success })
  } catch (error) {
    logError('Set user setting error', error)
    res.status(500).json({ success: false, error: 'Failed to set user setting' })
  }
})

/**
 * DELETE /api/settings/user/:key
 * Удалить пользовательскую настройку (вернуть к дефолту)
 */
router.delete('/user/:key', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { key } = req.params

    const success = await deleteSetting(key, {
      scope: 'user',
      userId: req.user.id
    })

    res.json({ success })
  } catch (error) {
    logError('Delete user setting error', error)
    res.status(500).json({ success: false, error: 'Failed to delete user setting' })
  }
})

// ========================================
// Department Settings
// ========================================

/**
 * GET /api/settings/department
 * Получить настройки отдела
 */
router.get('/department', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const settings = await getAllSettingsForScope('department', {
      departmentId: req.departmentId
    })

    res.json({ success: true, settings, scope: 'department' })
  } catch (error) {
    logError('Get department settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get department settings' })
  }
})

/**
 * PUT /api/settings/department/:key
 * Установить настройку отдела
 */
router.put('/department/:key', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (!req.departmentId) {
      return res.status(400).json({ success: false, error: 'Department context required' })
    }

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }

    const result = await setSetting(key, value, {
      scope: 'department',
      departmentId: req.departmentId,
      hotelId: req.hotelId
    })

    if (result.success) {
      await logAudit({
        hotel_id: req.hotelId,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'department_setting',
        entity_id: req.departmentId,
        details: { key, scope: 'department' },
        snapshot_before: result.before !== null ? { [key]: result.before } : null,
        snapshot_after: { [key]: result.after },
        ip_address: req.ip
      })
    }

    res.json({ success: result.success })
  } catch (error) {
    logError('Set department setting error', error)
    res.status(500).json({ success: false, error: 'Failed to set department setting' })
  }
})

// ========================================
// Hotel Settings
// ========================================

/**
 * GET /api/settings/hotel
 * Получить настройки отеля
 */
router.get('/hotel', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const settings = await getAllSettingsForScope('hotel', {
      hotelId: req.hotelId
    })

    res.json({ success: true, settings, scope: 'hotel' })
  } catch (error) {
    logError('Get hotel settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get hotel settings' })
  }
})

/**
 * PUT /api/settings/hotel/:key
 * Установить настройку отеля
 */
router.put('/hotel/:key', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }

    const result = await setSetting(key, value, {
      scope: 'hotel',
      hotelId: req.hotelId
    })

    if (result.success) {
      await logAudit({
        hotel_id: req.hotelId,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'hotel_setting',
        entity_id: req.hotelId,
        details: { key, scope: 'hotel' },
        snapshot_before: result.before !== null ? { [key]: result.before } : null,
        snapshot_after: { [key]: result.after },
        ip_address: req.ip
      })

      // SSE broadcast для realtime обновления
      sseManager.broadcast({
        type: 'settings-updated',
        hotelId: req.hotelId,
        data: { key, scope: 'hotel' }
      })
    }

    res.json({ success: result.success })
  } catch (error) {
    logError('Set hotel setting error', error)
    res.status(500).json({ success: false, error: 'Failed to set hotel setting' })
  }
})

// ========================================
// System Settings (SUPER_ADMIN only)
// ========================================

/**
 * GET /api/settings/system
 * Получить системные настройки
 */
router.get('/system', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' })
    }

    const settings = await getAllSettingsForScope('system', {})

    res.json({ success: true, settings, scope: 'system' })
  } catch (error) {
    logError('Get system settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get system settings' })
  }
})

/**
 * PUT /api/settings/system/:key
 * Установить системную настройку
 */
router.put('/system/:key', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' })
    }

    const { key } = req.params
    const { value } = req.body

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }

    const result = await setSetting(key, value, {
      scope: 'system'
    })

    if (result.success) {
      await logAudit({
        hotel_id: null,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'system_setting',
        entity_id: null,
        details: { key, scope: 'system' },
        snapshot_before: result.before !== null ? { [key]: result.before } : null,
        snapshot_after: { [key]: result.after },
        ip_address: req.ip
      })

      // Clear cache for all
      clearSettingsCache()
    }

    res.json({ success: result.success })
  } catch (error) {
    logError('Set system setting error', error)
    res.status(500).json({ success: false, error: 'Failed to set system setting' })
  }
})

// ========================================
// Batch Operations
// ========================================

/**
 * POST /api/settings/batch
 * Пакетное обновление настроек
 */
router.post('/batch', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const validation = validate(BatchUpdateSettingsSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const { settings, scope } = validation.data

    // System scope requires SUPER_ADMIN
    if (scope === 'system' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required for system scope' })
    }

    // Hotel scope requires HOTEL_ADMIN
    if (scope === 'hotel' && !['HOTEL_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'HOTEL_ADMIN required for hotel scope' })
    }

    const results = []
    const errors = []

    for (const item of settings) {
      try {
        const context = {
          scope,
          hotelId: req.hotelId,
          departmentId: scope === 'department' ? req.departmentId : undefined,
          userId: scope === 'user' ? req.user.id : undefined
        }

        const success = await setSetting(item.key, item.value, context)
        results.push({ key: item.key, success })
      } catch (err) {
        errors.push({ key: item.key, error: err.message })
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'batch_update',
      entity_type: 'settings',
      entity_id: null,
      details: {
        scope,
        count: results.filter(r => r.success).length,
        keys: settings.map(s => s.key)
      },
      ip_address: req.ip
    })

    res.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logError('Batch settings update error', error)
    res.status(500).json({ success: false, error: 'Failed to batch update settings' })
  }
})

// ========================================
// Cache Management
// ========================================

/**
 * POST /api/settings/cache/clear
 * Очистить кэш настроек
 */
router.post('/cache/clear', authMiddleware, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    clearSettingsCache(req.hotelId)

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'clear_cache',
      entity_type: 'settings_cache',
      entity_id: null,
      details: { hotelId: req.hotelId },
      ip_address: req.ip
    })

    res.json({ success: true, message: 'Settings cache cleared' })
  } catch (error) {
    logError('Clear cache error', error)
    res.status(500).json({ success: false, error: 'Failed to clear cache' })
  }
})

// ========================================
// Notification Rules (proxy to notification-rules module)
// ========================================

const DEFAULT_NOTIFICATION_RULES = [
  { id: 'critical_expiry', name: 'Критические (0-1 день)', enabled: true, days: 1, priority: 'critical', channels: ['push', 'telegram'] },
  { id: 'warning_expiry', name: 'Предупреждения (2-3 дня)', enabled: true, days: 3, priority: 'warning', channels: ['push'] },
  { id: 'notice_expiry', name: 'Уведомления (4-7 дней)', enabled: true, days: 7, priority: 'notice', channels: ['push'] }
]

/**
 * GET /api/settings/notifications/rules
 * Получить правила уведомлений
 */
router.get('/notifications/rules', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const result = await dbQuery(`
      SELECT key, value FROM settings
      WHERE hotel_id = $1 AND key = 'notification_rules'
    `, [req.hotelId])

    if (result.rows.length > 0 && result.rows[0].value) {
      const parsed = typeof result.rows[0].value === 'string'
        ? JSON.parse(result.rows[0].value)
        : result.rows[0].value
      return res.json({ success: true, rules: parsed })
    }

    res.json({ success: true, rules: DEFAULT_NOTIFICATION_RULES })
  } catch (error) {
    logError('Get notification rules error', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

/**
 * PUT /api/settings/notifications/rules
 * Обновить правила уведомлений
 */
router.put('/notifications/rules', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { rules } = req.body

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'Rules must be an array' })
    }

    // Upsert the notification rules
    await dbQuery(`
      INSERT INTO settings (hotel_id, key, value, updated_at)
      VALUES ($1, 'notification_rules', $2, NOW())
      ON CONFLICT (hotel_id, key) 
      DO UPDATE SET value = $2, updated_at = NOW()
    `, [req.hotelId, JSON.stringify(rules)])

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'notification_rules',
      entity_id: null,
      details: { rulesCount: rules.length },
      ip_address: req.ip
    })

    res.json({ success: true, rules })
  } catch (error) {
    logError('Update notification rules error', error)
    res.status(500).json({ success: false, error: 'Failed to update notification rules' })
  }
})

// ========================================
// Unified Notifications Settings
// ========================================

/**
 * GET /api/settings/notifications
 * Get unified notification settings (channels, templates, schedule)
 */
router.get('/notifications', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }

    const allSettings = await getHierarchicalSettings(context)

    // Get channel enabled states
    const telegramEnabled = allSettings.raw?.['notify.channels.telegram'] ?? 
      allSettings.notify?.channels?.telegram ?? true // Default to true if telegram settings exist
    const emailEnabled = allSettings.raw?.['notify.channels.email'] ?? 
      allSettings.notify?.channels?.email ?? false

    // Unified templates: prefer notify.templates (what PUT saves) then legacy keys
    const defaultTemplates = {
      dailyReport: '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'
    }
    const templates = allSettings.raw?.['notify.templates'] ??
      allSettings.telegram?.messageTemplates ??
      allSettings.raw?.['telegram.messageTemplates'] ??
      allSettings.raw?.['telegram_message_templates'] ??
      defaultTemplates
    const templatesNormalized = templates?.dailyReport != null
      ? { dailyReport: templates.dailyReport }
      : defaultTemplates

    // Get send time
    const sendTime = allSettings.raw?.['notify.sendTime'] ??
      allSettings.raw?.['notify.telegram.sendTime'] ??
      '09:00'

    // Get timezone
    const timezone = allSettings.raw?.['locale.timezone'] ??
      allSettings.locale?.timezone ??
      'Asia/Almaty'

    res.json({
      success: true,
      channels: {
        telegram: { enabled: Boolean(telegramEnabled) },
        email: { enabled: Boolean(emailEnabled) }
      },
      templates: templatesNormalized,
      sendTime,
      timezone
    })
  } catch (error) {
    logError('Get notifications settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get notifications settings' })
  }
})

/**
 * PUT /api/settings/notifications
 * Update unified notification settings
 */
router.put('/notifications', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { channels, templates, sendTime, timezone } = req.body

    // Save channel enabled states
    if (channels) {
      if (channels.telegram?.enabled !== undefined) {
        await setSetting('notify.channels.telegram', channels.telegram.enabled, {
          scope: 'hotel',
          hotelId: req.hotelId
        })
      }
      if (channels.email?.enabled !== undefined) {
        await setSetting('notify.channels.email', channels.email.enabled, {
          scope: 'hotel',
          hotelId: req.hotelId
        })
      }
    }

    // Save unified templates
    if (templates) {
      // Save as unified templates
      await setSetting('notify.templates', templates, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      // Also save to telegram_message_templates for backward compatibility
      await setSetting('telegram_message_templates', templates, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
    }

    // Save timezone
    if (timezone && typeof timezone === 'string') {
      await setSetting('locale.timezone', timezone, {
        scope: 'system'
      })
      await setSetting('locale.timezone', timezone, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      clearSettingsCache()
    }

    // Save send time and reschedule
    if (sendTime) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid time format. Expected HH:MM (00:00 - 23:59)' 
        })
      }
      
      await setSetting('notify.sendTime', sendTime, {
        scope: 'system'
      })
      await setSetting('notify.sendTime', sendTime, {
        scope: 'hotel',
        hotelId: req.hotelId
      })
      // Also save to telegram for backward compatibility
      await setSetting('notify.telegram.sendTime', sendTime, {
        scope: 'system'
      })
      
      clearSettingsCache()
      
      // Reschedule daily report
      try {
        const { rescheduleDailyReport } = await import('../../jobs/notificationJobs.js')
        await rescheduleDailyReport()
        logInfo('PUT /notifications', `✅ Daily report rescheduled to ${sendTime}`)
      } catch (jobError) {
        logError('PUT /notifications', 'Failed to reschedule', jobError)
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login || 'Unknown',
      action: 'update',
      entity_type: 'notifications_settings',
      entity_id: req.hotelId,
      details: { channels, templatesUpdated: !!templates, sendTime, timezone },
      ip_address: req.ip
    })

    res.json({ 
      success: true,
      message: sendTime ? `Notifications rescheduled to ${sendTime}` : 'Settings saved'
    })
  } catch (error) {
    logError('PUT /notifications', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update notifications settings',
      details: error.message 
    })
  }
})

// ========================================
// Email Settings (SYSTEM EMAIL only) - DEPRECATED
// ========================================

/**
 * GET /api/settings/email
 * Get email settings for SYSTEM notifications (not user emails)
 */
router.get('/email', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }

    const allSettings = await getHierarchicalSettings(context)

    // Email settings for SYSTEM notifications
    const settings = {
      enabled: allSettings.raw?.['email.enabled'] ?? allSettings.email?.enabled ?? false,
      smtpHost: allSettings.raw?.['email.smtpHost'] ?? allSettings.email?.smtpHost ?? process.env.SMTP_HOST ?? '',
      smtpPort: allSettings.raw?.['email.smtpPort'] ?? allSettings.email?.smtpPort ?? parseInt(process.env.SMTP_PORT || '587'),
      smtpSecure: allSettings.raw?.['email.smtpSecure'] ?? allSettings.email?.smtpSecure ?? (process.env.SMTP_SECURE === 'true'),
      smtpUser: allSettings.raw?.['email.smtpUser'] ?? allSettings.email?.smtpUser ?? process.env.SMTP_USER ?? '',
      smtpPassword: allSettings.raw?.['email.smtpPassword'] ?? allSettings.email?.smtpPassword ?? process.env.SMTP_PASS ?? '',
      fromEmail: allSettings.raw?.['email.fromEmail'] ?? allSettings.email?.fromEmail ?? process.env.EMAIL_FROM ?? 'no-reply@freshtrack.systems',
      fromName: allSettings.raw?.['email.fromName'] ?? allSettings.email?.fromName ?? 'FreshTrack',
      dailyReportTime: allSettings.raw?.['email.dailyReportTime'] ?? allSettings.email?.dailyReportTime ?? '08:00',
      dailyReportEnabled: allSettings.raw?.['email.dailyReportEnabled'] ?? allSettings.email?.dailyReportEnabled ?? true,
      instantAlertsEnabled: allSettings.raw?.['email.instantAlertsEnabled'] ?? allSettings.email?.instantAlertsEnabled ?? true
    }

    res.json({ success: true, settings })
  } catch (error) {
    logError('Get email settings error', error)
    res.status(500).json({ success: false, error: 'Failed to get email settings' })
  }
})

/**
 * PUT /api/settings/email
 * Update email settings for SYSTEM notifications
 */
router.put('/email', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { settings } = req.body

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }

    const emailKeys = [
      'email.enabled',
      'email.smtpHost',
      'email.smtpPort',
      'email.smtpSecure',
      'email.smtpUser',
      'email.smtpPassword',
      'email.fromEmail',
      'email.fromName',
      'email.dailyReportTime',
      'email.dailyReportEnabled',
      'email.instantAlertsEnabled'
    ]

    const results = []
    for (const [key, value] of Object.entries(settings)) {
      const dbKey = `email.${key}`
      if (emailKeys.includes(dbKey)) {
        await setSetting(dbKey, value, {
          scope: 'hotel',
          hotelId: req.hotelId
        })
        results.push({ key: dbKey, success: true })
      }
    }

    // If dailyReportTime changed, reschedule the job
    if (settings.dailyReportTime) {
      try {
        const { rescheduleDailyReport } = await import('../../jobs/notificationJobs.js')
        await rescheduleDailyReport()
        logInfo('PUT /email', `✅ Daily report rescheduled to ${settings.dailyReportTime}`)
      } catch (jobError) {
        logError('PUT /email', 'Failed to reschedule daily report', jobError)
      }
    }

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'email_settings',
      entity_id: req.hotelId,
      details: { updatedKeys: results.map(r => r.key) },
      ip_address: req.ip
    })

    res.json({ success: true, results })
  } catch (error) {
    logError('Update email settings error', error)
    res.status(500).json({ success: false, error: 'Failed to update email settings' })
  }
})

/**
 * POST /api/settings/email/test
 * Test email connection by sending a test email to department inbox
 */
router.post('/email/test', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { settings } = req.body

    // Get department email for testing
    const deptResult = await dbQuery(`
      SELECT d.id, d.name, d.email
      FROM departments d
      WHERE d.hotel_id = $1 AND d.is_active = true AND d.email IS NOT NULL AND TRIM(d.email) != ''
      LIMIT 1
    `, [req.hotelId])

    if (deptResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No department with email found. Please set email for at least one department first.'
      })
    }

    const testDepartment = deptResult.rows[0]
    const testEmail = testDepartment.email

    // Temporarily override env vars if settings provided
    if (settings) {
      if (settings.smtpHost) process.env.SMTP_HOST = settings.smtpHost
      if (settings.smtpPort) process.env.SMTP_PORT = String(settings.smtpPort)
      if (settings.smtpSecure !== undefined) process.env.SMTP_SECURE = String(settings.smtpSecure)
      if (settings.smtpUser) process.env.SMTP_USER = settings.smtpUser
      if (settings.smtpPassword) process.env.SMTP_PASS = settings.smtpPassword
      if (settings.fromEmail) process.env.EMAIL_FROM = settings.fromEmail
    }

    const { sendEmail, EMAIL_FROM } = await import('../../services/EmailService.js')

    await sendEmail({
      to: testEmail,
      from: settings?.fromEmail ? `${settings.fromName || 'FreshTrack'} <${settings.fromEmail}>` : EMAIL_FROM.noreply,
      subject: 'FreshTrack: Тестовое письмо',
      html: `
        <h2>Тестовое письмо</h2>
        <p>Это тестовое письмо от FreshTrack для проверки настроек SYSTEM email.</p>
        <p>Если вы получили это письмо, значит настройки SMTP работают корректно.</p>
        <p><strong>Отдел:</strong> ${testDepartment.name}</p>
        <p><strong>Email отдела:</strong> ${testEmail}</p>
        <p style="color: #666; font-size: 12px; margin-top: 24px;">
          Это системное письмо. На этот адрес будут приходить уведомления о сроках годности и ежедневные отчёты.
        </p>
      `,
      text: `Тестовое письмо от FreshTrack\n\nЭто тестовое письмо для проверки настроек SYSTEM email.\n\nОтдел: ${testDepartment.name}\nEmail отдела: ${testEmail}`
    })

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'test_email',
      entity_type: 'email_settings',
      entity_id: null,
      details: { testEmail, department: testDepartment.name },
      ip_address: req.ip
    })

    res.json({
      success: true,
      message: `Тестовое письмо отправлено на ${testEmail} (${testDepartment.name})`
    })
  } catch (error) {
    logError('Test email error', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message
    })
  }
})

export default router
