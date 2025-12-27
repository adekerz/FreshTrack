/**
 * FreshTrack Settings API
 * Управление системными настройками
 * Updated for multi-hotel architecture
 */

import express from 'express'
import { db, logAudit } from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// Apply middleware
router.use(authMiddleware)
router.use(hotelIsolation)

// Middleware to require hotel context (with auto-selection for SUPER_ADMIN)
const requireHotelContext = (req, res, next) => {
  if (!req.hotelId) {
    // For SUPER_ADMIN, auto-select first hotel if none specified
    if (req.user?.role === 'SUPER_ADMIN') {
      const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
      if (firstHotel) {
        req.hotelId = firstHotel.id
        return next()
      }
    }
    return res.status(400).json({ 
      success: false, 
      error: 'Hotel context required. Please specify hotel_id.' 
    })
  }
  next()
}
router.use(requireHotelContext)

// Helper functions
function getSetting(hotelId, key) {
  const row = db.prepare('SELECT value FROM settings WHERE hotel_id = ? AND key = ?').get(hotelId, key)
  return row?.value || null
}

function setSetting(hotelId, key, value) {
  const id = `${hotelId}_${key}`
  db.prepare(`
    INSERT INTO settings (id, hotel_id, key, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(hotel_id, key) DO UPDATE SET 
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, hotelId, key, value)
}

/**
 * GET /api/settings/general - Получить общие настройки
 */
router.get('/general', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    res.json({
      siteName: getSetting(hotelId, 'SITE_NAME') || 'FreshTrack',
      departmentName: getSetting(hotelId, 'DEPARTMENT_NAME') || '',
      timezone: getSetting(hotelId, 'TIMEZONE') || 'Asia/Almaty',
      dateFormat: getSetting(hotelId, 'DATE_FORMAT') || 'DD.MM.YYYY',
      warningDays: parseInt(getSetting(hotelId, 'WARNING_DAYS')) || 7,
      criticalDays: parseInt(getSetting(hotelId, 'CRITICAL_DAYS')) || 3
    })
  } catch (error) {
    console.error('Error fetching general settings:', error)
    res.status(500).json({ error: 'Failed to fetch general settings' })
  }
})

/**
 * PUT /api/settings/general - Обновить общие настройки
 */
router.put('/general', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { siteName, departmentName, timezone, dateFormat, warningDays, criticalDays } = req.body
    
    if (siteName !== undefined) setSetting(hotelId, 'SITE_NAME', siteName)
    if (departmentName !== undefined) setSetting(hotelId, 'DEPARTMENT_NAME', departmentName)
    if (timezone !== undefined) setSetting(hotelId, 'TIMEZONE', timezone)
    if (dateFormat !== undefined) setSetting(hotelId, 'DATE_FORMAT', dateFormat)
    if (warningDays !== undefined) setSetting(hotelId, 'WARNING_DAYS', String(warningDays))
    if (criticalDays !== undefined) setSetting(hotelId, 'CRITICAL_DAYS', String(criticalDays))
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'settings',
      entity_id: 'general',
      details: { keys: Object.keys(req.body) },
      ip_address: req.ip
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating general settings:', error)
    res.status(500).json({ error: 'Failed to update general settings' })
  }
})

/**
 * GET /api/settings/telegram - Получить настройки Telegram
 */
router.get('/telegram', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const botToken = getSetting(hotelId, 'TELEGRAM_BOT_TOKEN') || ''
    
    res.json({
      botToken: botToken ? botToken.slice(0, 10) + '...' : '',
      chatId: getSetting(hotelId, 'TELEGRAM_CHAT_ID') || '',
      enabled: getSetting(hotelId, 'TELEGRAM_ENABLED') !== 'false',
      scheduleTime: getSetting(hotelId, 'TELEGRAM_SCHEDULE_TIME') || '09:00',
      messageTemplates: {
        dailyReport: getSetting(hotelId, 'TELEGRAM_TEMPLATE_DAILY') || '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
        expiryWarning: getSetting(hotelId, 'TELEGRAM_TEMPLATE_WARNING') || '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
        expiredAlert: getSetting(hotelId, 'TELEGRAM_TEMPLATE_EXPIRED') || '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
        collectionConfirm: getSetting(hotelId, 'TELEGRAM_TEMPLATE_COLLECTION') || '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
      }
    })
  } catch (error) {
    console.error('Error fetching telegram settings:', error)
    res.status(500).json({ error: 'Failed to fetch telegram settings' })
  }
})

/**
 * PUT /api/settings/telegram - Обновить настройки Telegram
 */
router.put('/telegram', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { botToken, chatId, enabled, scheduleTime, messageTemplates } = req.body
    
    if (botToken !== undefined && !botToken.includes('...')) {
      setSetting(hotelId, 'TELEGRAM_BOT_TOKEN', botToken)
    }
    if (chatId !== undefined) setSetting(hotelId, 'TELEGRAM_CHAT_ID', chatId)
    if (enabled !== undefined) setSetting(hotelId, 'TELEGRAM_ENABLED', String(enabled))
    if (scheduleTime !== undefined) setSetting(hotelId, 'TELEGRAM_SCHEDULE_TIME', scheduleTime)
    
    if (messageTemplates) {
      if (messageTemplates.dailyReport) setSetting(hotelId, 'TELEGRAM_TEMPLATE_DAILY', messageTemplates.dailyReport)
      if (messageTemplates.expiryWarning) setSetting(hotelId, 'TELEGRAM_TEMPLATE_WARNING', messageTemplates.expiryWarning)
      if (messageTemplates.expiredAlert) setSetting(hotelId, 'TELEGRAM_TEMPLATE_EXPIRED', messageTemplates.expiredAlert)
      if (messageTemplates.collectionConfirm) setSetting(hotelId, 'TELEGRAM_TEMPLATE_COLLECTION', messageTemplates.collectionConfirm)
    }
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'settings',
      entity_id: 'telegram',
      details: { keys: Object.keys(req.body) },
      ip_address: req.ip
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating telegram settings:', error)
    res.status(500).json({ error: 'Failed to update telegram settings' })
  }
})

/**
 * POST /api/settings/telegram/test - Отправить тестовое сообщение
 */
router.post('/telegram/test', hotelAdminOnly, async (req, res) => {
  try {
    const hotelId = req.hotelId
    const botToken = getSetting(hotelId, 'TELEGRAM_BOT_TOKEN')
    const chatId = req.body.chatId || getSetting(hotelId, 'TELEGRAM_CHAT_ID')
    
    if (!botToken) {
      return res.status(400).json({ success: false, error: 'Bot token not configured' })
    }
    
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Chat ID not configured' })
    }
    
    const message = `🔔 FreshTrack: Тестовое сообщение\nВремя: ${new Date().toLocaleString('ru-RU')}`
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      res.json({ success: true, messageId: data.result.message_id })
    } else {
      res.json({ success: false, error: data.description || 'Failed to send message' })
    }
  } catch (error) {
    console.error('Error sending test message:', error)
    res.status(500).json({ success: false, error: 'Failed to send test message' })
  }
})

/**
 * GET /api/settings/notification-rules - Правила уведомлений
 */
router.get('/notification-rules', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const rules = getSetting(hotelId, 'NOTIFICATION_RULES')
    
    if (!rules) {
      return res.json([
        { id: 1, name: 'expired', enabled: true, daysBeforeExpiry: 0, channels: ['telegram', 'web'] },
        { id: 2, name: 'critical', enabled: true, daysBeforeExpiry: 3, channels: ['telegram', 'web'] },
        { id: 3, name: 'warning', enabled: true, daysBeforeExpiry: 7, channels: ['web'] },
        { id: 4, name: 'daily_report', enabled: false, time: '09:00', channels: ['telegram'] }
      ])
    }
    
    res.json(JSON.parse(rules))
  } catch (error) {
    console.error('Error fetching notification rules:', error)
    res.status(500).json({ error: 'Failed to fetch notification rules' })
  }
})

/**
 * PUT /api/settings/notification-rules - Обновить правила уведомлений
 */
router.put('/notification-rules', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { rules } = req.body
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'Rules array is required' })
    }
    
    setSetting(hotelId, 'NOTIFICATION_RULES', JSON.stringify(rules))
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'settings',
      entity_id: 'notification_rules',
      details: { rulesCount: rules.length },
      ip_address: req.ip
    })
    
    res.json({ success: true, rules })
  } catch (error) {
    console.error('Error updating notification rules:', error)
    res.status(500).json({ error: 'Failed to update notification rules' })
  }
})

/**
 * GET /api/settings/custom-content - Кастомный контент
 */
router.get('/custom-content', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    res.json({
      app_name: getSetting(hotelId, 'CONTENT_APP_NAME') || 'FreshTrack',
      app_tagline: getSetting(hotelId, 'CONTENT_APP_TAGLINE') || 'Контроль сроков годности',
      company_name: getSetting(hotelId, 'CONTENT_COMPANY_NAME') || '',
      welcome_message: getSetting(hotelId, 'CONTENT_WELCOME') || '',
      logo_url: getSetting(hotelId, 'CONTENT_LOGO_URL') || ''
    })
  } catch (error) {
    console.error('Error fetching custom content:', error)
    res.status(500).json({ error: 'Failed to fetch content' })
  }
})

/**
 * PUT /api/settings/custom-content/:key - Обновить кастомный контент
 */
router.put('/custom-content/:key', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { key } = req.params
    const { value } = req.body
    
    const keyMap = {
      'app_name': 'CONTENT_APP_NAME',
      'app_tagline': 'CONTENT_APP_TAGLINE',
      'company_name': 'CONTENT_COMPANY_NAME',
      'welcome_message': 'CONTENT_WELCOME',
      'logo_url': 'CONTENT_LOGO_URL'
    }
    
    if (!keyMap[key]) {
      return res.status(400).json({ error: 'Invalid setting key' })
    }
    
    setSetting(hotelId, keyMap[key], value || '')
    res.json({ success: true })
  } catch (error) {
    console.error('Error saving custom content:', error)
    res.status(500).json({ error: 'Failed to save content' })
  }
})

// ============================================
// Root endpoints for /api/notification-rules
// ============================================

/**
 * GET /api/notification-rules - Root endpoint
 */
router.get('/', hotelAdminOnly, (req, res) => {
  // Check if this is /api/notification-rules or /api/custom-content or /api/settings
  const path = req.baseUrl
  
  if (path === '/api/notification-rules') {
    try {
      const hotelId = req.hotelId
      const rules = getSetting(hotelId, 'NOTIFICATION_RULES')
      
      if (!rules) {
        return res.json([
          { id: 1, name: 'expired', enabled: true, daysBeforeExpiry: 0, channels: ['telegram', 'web'] },
          { id: 2, name: 'critical', enabled: true, daysBeforeExpiry: 3, channels: ['telegram', 'web'] },
          { id: 3, name: 'warning', enabled: true, daysBeforeExpiry: 7, channels: ['web'] },
          { id: 4, name: 'daily_report', enabled: false, time: '09:00', channels: ['telegram'] }
        ])
      }
      
      res.json(JSON.parse(rules))
    } catch (error) {
      console.error('Error fetching notification rules:', error)
      res.status(500).json({ error: 'Failed to fetch notification rules' })
    }
  } else if (path === '/api/custom-content') {
    try {
      const hotelId = req.hotelId
      res.json({
        app_name: getSetting(hotelId, 'CONTENT_APP_NAME') || 'FreshTrack',
        app_tagline: getSetting(hotelId, 'CONTENT_APP_TAGLINE') || 'Контроль сроков годности',
        company_name: getSetting(hotelId, 'CONTENT_COMPANY_NAME') || '',
        welcome_message: getSetting(hotelId, 'CONTENT_WELCOME') || '',
        logo_url: getSetting(hotelId, 'CONTENT_LOGO_URL') || ''
      })
    } catch (error) {
      console.error('Error fetching custom content:', error)
      res.status(500).json({ error: 'Failed to fetch content' })
    }
  } else {
    // /api/settings - return all settings summary
    try {
      const hotelId = req.hotelId
      res.json({
        general: true,
        telegram: true,
        notificationRules: true,
        customContent: true
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch settings' })
    }
  }
})

/**
 * PUT /api/notification-rules - Update rules (root)
 */
router.put('/', hotelAdminOnly, (req, res) => {
  const path = req.baseUrl
  
  if (path === '/api/notification-rules') {
    try {
      const hotelId = req.hotelId
      const rules = req.body.rules || req.body
      
      if (!rules || !Array.isArray(rules)) {
        return res.status(400).json({ error: 'Rules array is required' })
      }
      
      setSetting(hotelId, 'NOTIFICATION_RULES', JSON.stringify(rules))
      
      logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'settings',
        entity_id: 'notification_rules',
        details: { rulesCount: rules.length },
        ip_address: req.ip
      })
      
      res.json({ success: true, rules })
    } catch (error) {
      console.error('Error updating notification rules:', error)
      res.status(500).json({ error: 'Failed to update notification rules' })
    }
  } else {
    res.status(400).json({ error: 'Invalid request' })
  }
})

/**
 * PUT /api/custom-content/:key - Root endpoint
 */
router.put('/:key', hotelAdminOnly, (req, res) => {
  const path = req.baseUrl
  
  if (path === '/api/custom-content') {
    try {
      const hotelId = req.hotelId
      const { key } = req.params
      const { value } = req.body
      
      const keyMap = {
        'app_name': 'CONTENT_APP_NAME',
        'app_tagline': 'CONTENT_APP_TAGLINE',
        'company_name': 'CONTENT_COMPANY_NAME',
        'welcome_message': 'CONTENT_WELCOME',
        'logo_url': 'CONTENT_LOGO_URL'
      }
      
      if (!keyMap[key]) {
        return res.status(400).json({ error: 'Invalid setting key' })
      }
      
      setSetting(hotelId, keyMap[key], value || '')
      res.json({ success: true })
    } catch (error) {
      console.error('Error saving custom content:', error)
      res.status(500).json({ error: 'Failed to save content' })
    }
  } else {
    res.status(404).json({ error: 'Endpoint not found' })
  }
})

export default router
