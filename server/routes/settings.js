/**
 * FreshTrack Settings API - PostgreSQL Async Version
 * Phase 7: Hierarchical Settings System
 * 
 * Settings priority (highest to lowest):
 * User → Department → Hotel → System
 */

import express from 'express'
import {
  getSettings as getLegacySettings,
  getSetting as getLegacySetting,
  updateSettings as updateLegacySettings,
  logAudit
} from '../db/database.js'
import {
  getSettings as getHierarchicalSettings,
  getSetting as getHierarchicalSetting,
  setSetting,
  deleteSetting,
  getAllSettingsForScope,
  clearSettingsCache,
  SettingsKey
} from '../services/SettingsService.js'
import { 
  authMiddleware, 
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// ═══════════════════════════════════════════════════════════════
// PHASE 7: HIERARCHICAL SETTINGS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/settings/user - Get aggregated user settings (Phase 7)
 * Returns all settings resolved with full hierarchy for current user
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
    console.error('Get user settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get user settings' })
  }
})

/**
 * GET /api/settings/hierarchy/:key - Get single setting with source info (Phase 7)
 * Shows where the setting value comes from (user/department/hotel/system)
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
    console.error('Get hierarchical setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to get setting' })
  }
})

/**
 * PUT /api/settings/user/:key - Set user-level setting (Phase 7)
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
    console.error('Set user setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to set user setting' })
  }
})

/**
 * POST /api/settings/batch - Batch update settings (Phase 7)
 * Allows admins to update multiple settings at once
 * Requires settings:update permission for the target scope
 */
router.post('/batch', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { settings, scope = 'hotel' } = req.body
    
    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Settings array is required: [{ key, value }]' 
      })
    }
    
    // Validate scope and permissions
    const validScopes = ['user', 'department', 'hotel']
    if (!validScopes.includes(scope)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid scope. Must be one of: ${validScopes.join(', ')}` 
      })
    }
    
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
      if (!item.key) {
        errors.push({ key: item.key, error: 'Key is required' })
        continue
      }
      
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
    
    // Log batch update
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
    console.error('Batch settings update error:', error)
    res.status(500).json({ success: false, error: 'Failed to batch update settings' })
  }
})

/**
 * DELETE /api/settings/user/:key - Delete user-level setting (Phase 7)
 * Reverts to department/hotel/system default
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
    console.error('Delete user setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete user setting' })
  }
})

/**
 * GET /api/settings/department - Get department-level settings (Phase 7)
 * Requires DEPARTMENT_MANAGER or higher
 */
router.get('/department', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const settings = await getAllSettingsForScope('department', {
      departmentId: req.departmentId
    })
    
    res.json({ success: true, settings, scope: 'department' })
  } catch (error) {
    console.error('Get department settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get department settings' })
  }
})

/**
 * PUT /api/settings/department/:key - Set department-level setting (Phase 7)
 * Requires settings:update:department permission
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
    console.error('Set department setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to set department setting' })
  }
})

/**
 * GET /api/settings/hotel - Get hotel-level settings (Phase 7)
 * Requires HOTEL_ADMIN or higher
 */
router.get('/hotel', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const settings = await getAllSettingsForScope('hotel', {
      hotelId: req.hotelId
    })
    
    res.json({ success: true, settings, scope: 'hotel' })
  } catch (error) {
    console.error('Get hotel settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get hotel settings' })
  }
})

/**
 * PUT /api/settings/hotel/:key - Set hotel-level setting (Phase 7)
 * Requires settings:update:hotel permission (HOTEL_ADMIN)
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
    }
    
    res.json({ success: result.success })
  } catch (error) {
    console.error('Set hotel setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to set hotel setting' })
  }
})

/**
 * GET /api/settings/system - Get system-level settings (Phase 7)
 * Requires SUPER_ADMIN
 */
router.get('/system', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'SUPER_ADMIN required' })
    }
    
    const settings = await getAllSettingsForScope('system', {})
    
    res.json({ success: true, settings, scope: 'system' })
  } catch (error) {
    console.error('Get system settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get system settings' })
  }
})

/**
 * PUT /api/settings/system/:key - Set system-level setting (Phase 7)
 * Requires SUPER_ADMIN only
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
    }
    
    res.json({ success: result.success })
  } catch (error) {
    console.error('Set system setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to set system setting' })
  }
})

/**
 * POST /api/settings/cache/clear - Clear settings cache (Phase 7)
 * For admin use during debugging
 */
router.post('/cache/clear', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), (req, res) => {
  try {
    clearSettingsCache()
    res.json({ success: true, message: 'Settings cache cleared' })
  } catch (error) {
    console.error('Clear cache error:', error)
    res.status(500).json({ success: false, error: 'Failed to clear cache' })
  }
})

/**
 * GET /api/settings/keys - List available setting keys (Phase 7)
 * Returns enum of all predefined setting keys
 */
router.get('/keys', authMiddleware, (req, res) => {
  res.json({ success: true, keys: SettingsKey })
})

// ═══════════════════════════════════════════════════════════════
// LEGACY ENDPOINTS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════

// GET /api/settings (Legacy)
router.get('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const { category } = req.query
    const settings = await getLegacySettings(req.hotelId, category)
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get settings' })
  }
})

// GET /api/settings/general - Get general settings (Legacy - uses hierarchical)
router.get('/general', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    // Phase 7: Use hierarchical settings
    const settings = await getHierarchicalSettings({
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    })
    
    // Return general settings with default values (backward compatible)
    res.json({ 
      success: true, 
      settings: {
        siteName: settings.raw?.['branding.siteName'] || 'FreshTrack',
        departmentName: settings.raw?.['branding.departmentName'] || '',
        warningDays: settings.expiryThresholds.warning,
        criticalDays: settings.expiryThresholds.critical,
        dateFormat: settings.display.dateFormat,
        timezone: settings.display.timezone,
        defaultLanguage: settings.display.locale,
        ...settings.raw
      }
    })
  } catch (error) {
    console.error('Get general settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get general settings' })
  }
})

// PUT /api/settings/general - Save general settings
router.put('/general', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    // Accept both { settings: {...} } and direct object
    const settings = req.body.settings || req.body
    
    if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }
    
    const context = {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    }
    
    // Map general settings to hierarchical keys
    const keyMapping = {
      siteName: 'branding.siteName',
      departmentName: 'branding.departmentName',
      warningDays: 'expiry.warning.days',
      criticalDays: 'expiry.critical.days',
      dateFormat: 'display.dateFormat',
      timezone: 'display.timezone',
      defaultLanguage: 'display.locale'
    }
    
    for (const [key, value] of Object.entries(settings)) {
      const hierarchicalKey = keyMapping[key] || key
      await setSetting(hierarchicalKey, value, 'hotel', context)
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'settings',
      entity_id: null,
      details: { scope: 'general', keys: Object.keys(settings) }
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Save general settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to save general settings' })
  }
})

// GET /api/settings/telegram - Get Telegram settings
router.get('/telegram', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }
    
    const settings = await getHierarchicalSettings(context)
    
    res.json({
      success: true,
      settings: {
        botToken: settings.raw?.['telegram.botToken'] || '',
        botUsername: settings.raw?.['telegram.botUsername'] || '',
        enabled: settings.raw?.['telegram.enabled'] ?? true,
        channels: settings.notification?.channels || ['app', 'telegram']
      }
    })
  } catch (error) {
    console.error('Get telegram settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get telegram settings' })
  }
})

// PUT /api/settings/telegram - Save Telegram settings
router.put('/telegram', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { settings } = req.body
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }
    
    const context = {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    }
    
    if (settings.botToken !== undefined) {
      await setSetting('telegram.botToken', settings.botToken, 'hotel', context)
    }
    if (settings.botUsername !== undefined) {
      await setSetting('telegram.botUsername', settings.botUsername, 'hotel', context)
    }
    if (settings.enabled !== undefined) {
      await setSetting('telegram.enabled', settings.enabled, 'hotel', context)
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'settings',
      entity_id: null,
      details: { scope: 'telegram', keys: Object.keys(settings) }
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Save telegram settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to save telegram settings' })
  }
})

// GET /api/settings/:key (Legacy)
router.get('/:key', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const setting = await getLegacySetting(req.hotelId, req.params.key)
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' })
    }
    res.json({ success: true, setting })
  } catch (error) {
    console.error('Get setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to get setting' })
  }
})

// PUT /api/settings (Legacy)
router.put('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { settings } = req.body
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }
    
    const success = await updateLegacySettings(req.hotelId, settings)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'settings', entity_id: null,
        details: { keys: Object.keys(settings) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to update settings' })
  }
})

// PUT /api/settings/:key (Legacy)
router.put('/:key', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { value } = req.body
    
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }
    
    const settings = { [req.params.key]: value }
    const success = await updateLegacySettings(req.hotelId, settings)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'settings', entity_id: null,
        details: { key: req.params.key }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to update setting' })
  }
})

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION RULES SETTINGS ENDPOINTS (for NotificationRulesPage.jsx)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/settings/notifications/rules - Get notification rules
 */
router.get('/notifications/rules', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    // Get rules from settings or return defaults
    const context = { hotelId: req.hotelId }
    const rules = await getHierarchicalSetting('notification_rules', context) || []
    
    res.json({ success: true, rules })
  } catch (error) {
    console.error('Get notification rules error:', error)
    res.status(500).json({ success: false, error: 'Failed to get notification rules' })
  }
})

/**
 * PUT /api/settings/notifications/rules - Save notification rules
 */
router.put('/notifications/rules', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { rules } = req.body
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'Rules array is required' })
    }
    
    await setSetting('notification_rules', rules, {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'update', entity_type: 'notification_rules', entity_id: null,
      details: { rulesCount: rules.length }, ip_address: req.ip
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Update notification rules error:', error)
    res.status(500).json({ success: false, error: 'Failed to update notification rules' })
  }
})

export default router
