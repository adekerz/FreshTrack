/**
 * Custom Content Controller
 */

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { logError, logInfo } from '../../utils/logger.js'
import {
  getSettings,
  getSetting,
  setSetting
} from '../../services/SettingsService.js'
import { logAudit } from '../../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'logos')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `logo-${req.hotelId}-${Date.now()}${ext}`
    cb(null, filename)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, SVG, WEBP are allowed.'))
    }
  }
})

router.use(authMiddleware)
router.use(hotelIsolation)

const CONTENT_KEYS = [
  'app_name', 'app_tagline', 'company_name', 'dashboard_title', 'welcome_message',
  'logo_url', 'logo_dark_url', 'favicon_url', 'primary_color', 'secondary_color',
  'accent_color', 'footer_text', 'support_email', 'support_phone'
]

function getDefaultContent(key) {
  const defaults = {
    app_name: 'FreshTrack',
    app_tagline: 'Совершенство управления',
    company_name: 'FreshTrack Inc.',
    dashboard_title: 'Панель управления',
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

router.get('/', async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      userId: req.user?.id
    }
    
    const allSettings = await getSettings(context)
    
    const content = {}
    for (const key of CONTENT_KEYS) {
      const settingKey = `branding.${key}`
      content[key] = allSettings.raw?.[settingKey] || getDefaultContent(key)
    }
    
    res.json({ success: true, content })
  } catch (error) {
    logError('Get custom content error', error)
    res.status(500).json({ success: false, error: 'Failed to get custom content' })
  }
})

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
    logError('Get custom content item error', error)
    res.status(500).json({ success: false, error: 'Failed to get content item' })
  }
})

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
      entity_id: null,
      details: { key, value }
    })
    
    res.json({ success: true, key, value })
  } catch (error) {
    logError('Update custom content error', error)
    res.status(500).json({ success: false, error: 'Failed to update content' })
  }
})

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
    logError('Update custom content error', error)
    res.status(500).json({ success: false, error: 'Failed to update content' })
  }
})

router.post('/upload-logo', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`

    const context = {
      scope: 'hotel',
      hotelId: req.hotelId
    }
    
    await setSetting('branding.logoUrl', logoUrl, context)

    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'upload',
      entity_type: 'logo',
      entity_id: req.file.filename,
      details: { filename: req.file.filename, size: req.file.size }
    })

    logInfo('Logo', `Uploaded by ${req.user.name}: ${req.file.filename}`)
    
    res.json({ 
      success: true, 
      logoUrl,
      filename: req.file.filename
    })
  } catch (error) {
    logError('Upload logo error', error)
    res.status(500).json({ success: false, error: 'Failed to upload logo' })
  }
})

router.delete('/logo', requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: null,
      userId: null
    }
    
    await setSetting('branding.logo_url', '/assets/logo.svg', 'hotel', context)
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'delete',
      entity_type: 'custom_content',
      entity_id: 'logo',
      details: { action: 'reset_logo' }
    })
    
    res.json({ success: true, logoUrl: '/assets/logo.svg' })
  } catch (error) {
    logError('Reset logo error', error)
    res.status(500).json({ success: false, error: 'Failed to reset logo' })
  }
})

export default router
