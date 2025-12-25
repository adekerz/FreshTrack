/**
 * FreshTrack Custom Content API
 * Manage custom branding content (app name, logo, texts)
 */

import express from 'express'
import {
  getSettings,
  getSetting,
  setSetting
} from '../services/SettingsService.js'
import { logAudit } from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// Apply auth middleware
router.use(authMiddleware)
router.use(hotelIsolation)

// Content keys that can be customized
const CONTENT_KEYS = [
  'app_name',
  'company_name', 
  'welcome_message',
  'logo_url',
  'logo_dark_url',
  'favicon_url',
  'primary_color',
  'secondary_color',
  'accent_color',
  'footer_text',
  'support_email',
  'support_phone'
]

/**
 * GET /api/custom-content - Get all custom content
 */
router.get('/', async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }
    
    const allSettings = await getSettings(context)
    
    // Extract branding-related settings
    const content = {}
    for (const key of CONTENT_KEYS) {
      const settingKey = `branding.${key}`
      content[key] = allSettings.raw?.[settingKey] || getDefaultContent(key)
    }
    
    res.json({ success: true, content })
  } catch (error) {
    console.error('Get custom content error:', error)
    res.status(500).json({ success: false, error: 'Failed to get custom content' })
  }
})

/**
 * GET /api/custom-content/:key - Get single content item
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params
    
    if (!CONTENT_KEYS.includes(key)) {
      return res.status(400).json({ success: false, error: 'Invalid content key' })
    }
    
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }
    
    const value = await getSetting(`branding.${key}`, context)
    
    res.json({ 
      success: true, 
      key,
      value: value || getDefaultContent(key)
    })
  } catch (error) {
    console.error('Get custom content item error:', error)
    res.status(500).json({ success: false, error: 'Failed to get content item' })
  }
})

/**
 * PUT /api/custom-content/:key - Update single content item
 */
router.put('/:key', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    
    if (!CONTENT_KEYS.includes(key)) {
      return res.status(400).json({ success: false, error: 'Invalid content key' })
    }
    
    const context = {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    }
    
    await setSetting(`branding.${key}`, value, 'hotel', context)
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'custom_content',
      entity_id: key,
      details: { key, value }
    })
    
    res.json({ success: true, key, value })
  } catch (error) {
    console.error('Update custom content error:', error)
    res.status(500).json({ success: false, error: 'Failed to update content' })
  }
})

/**
 * PUT /api/custom-content - Update multiple content items
 */
router.put('/', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { content } = req.body
    
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ success: false, error: 'Content object is required' })
    }
    
    const context = {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    }
    
    const updatedKeys = []
    for (const [key, value] of Object.entries(content)) {
      if (CONTENT_KEYS.includes(key)) {
        await setSetting(`branding.${key}`, value, 'hotel', context)
        updatedKeys.push(key)
      }
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'custom_content',
      entity_id: null,
      details: { keys: updatedKeys }
    })
    
    res.json({ success: true, updatedKeys })
  } catch (error) {
    console.error('Update custom content error:', error)
    res.status(500).json({ success: false, error: 'Failed to update content' })
  }
})

// Default content values
function getDefaultContent(key) {
  const defaults = {
    app_name: 'FreshTrack',
    company_name: 'FreshTrack Inc.',
    welcome_message: 'Добро пожаловать в FreshTrack!',
    logo_url: '/assets/logo.svg',
    logo_dark_url: '/assets/logo-dark.svg',
    favicon_url: '/favicon.ico',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    footer_text: '© 2025 FreshTrack. All rights reserved.',
    support_email: 'support@freshtrack.app',
    support_phone: ''
  }
  return defaults[key] || ''
}

export default router
