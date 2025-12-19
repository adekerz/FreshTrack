/**
 * FreshTrack Settings API
 * Управление системными настройками
 */

import express from 'express'
import { getDb, getSetting, setSetting, getAllSettings } from '../db/database.js'
import { logAction } from './audit-logs.js'

const router = express.Router()

/**
 * GET /api/settings/general - Получить общие настройки
 */
router.get('/general', (req, res) => {
  try {
    res.json({
      siteName: getSetting('SITE_NAME') || 'FreshTrack',
      departmentName: getSetting('DEPARTMENT_NAME') || '',
      timezone: getSetting('TIMEZONE') || 'Asia/Almaty',
      dateFormat: getSetting('DATE_FORMAT') || 'DD.MM.YYYY',
      warningDays: parseInt(getSetting('WARNING_DAYS')) || 7,
      criticalDays: parseInt(getSetting('CRITICAL_DAYS')) || 3
    })
  } catch (error) {
    console.error('Error fetching general settings:', error)
    res.status(500).json({ error: 'Failed to fetch general settings' })
  }
})

/**
 * PUT /api/settings/general - Обновить общие настройки
 */
router.put('/general', (req, res) => {
  try {
    const userId = req.user?.id || null
    const { siteName, departmentName, timezone, dateFormat, warningDays, criticalDays } = req.body
    
    // Проверяем права (только админ может менять настройки)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change settings' })
    }
    
    if (siteName !== undefined) setSetting('SITE_NAME', siteName, userId)
    if (departmentName !== undefined) setSetting('DEPARTMENT_NAME', departmentName, userId)
    if (timezone !== undefined) setSetting('TIMEZONE', timezone, userId)
    if (dateFormat !== undefined) setSetting('DATE_FORMAT', dateFormat, userId)
    if (warningDays !== undefined) setSetting('WARNING_DAYS', String(warningDays), userId)
    if (criticalDays !== undefined) setSetting('CRITICAL_DAYS', String(criticalDays), userId)
    
    // Записываем в audit log
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'settingsChange', 'General settings', 'settings', 'Изменены общие настройки', req.ip)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating general settings:', error)
    res.status(500).json({ error: 'Failed to update general settings' })
  }
})

/**
 * GET /api/settings/telegram - Получить настройки Telegram
 */
router.get('/telegram', (req, res) => {
  try {
    const botToken = getSetting('TELEGRAM_BOT_TOKEN') || ''
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    
    res.json({
      botToken: userRole === 'admin' ? botToken : (botToken ? botToken.slice(0, 10) + '...' : ''),
      chatId: getSetting('TELEGRAM_CHAT_ID') || '-5090103384',
      enabled: getSetting('TELEGRAM_ENABLED') !== 'false',
      scheduleTime: getSetting('TELEGRAM_SCHEDULE_TIME') || '09:00',
      messageTemplates: {
        dailyReport: getSetting('TELEGRAM_TEMPLATE_DAILY') || '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
        expiryWarning: getSetting('TELEGRAM_TEMPLATE_WARNING') || '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
        expiredAlert: getSetting('TELEGRAM_TEMPLATE_EXPIRED') || '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
        collectionConfirm: getSetting('TELEGRAM_TEMPLATE_COLLECTION') || '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
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
router.put('/telegram', (req, res) => {
  try {
    const userId = req.user?.id || null
    const { botToken, chatId, enabled, scheduleTime, messageTemplates } = req.body
    
    // Проверяем права (только админ может менять настройки)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change settings' })
    }
    
    if (botToken !== undefined && !botToken.includes('...')) {
      setSetting('TELEGRAM_BOT_TOKEN', botToken, userId)
    }
    if (chatId !== undefined) setSetting('TELEGRAM_CHAT_ID', chatId, userId)
    if (enabled !== undefined) setSetting('TELEGRAM_ENABLED', String(enabled), userId)
    if (scheduleTime !== undefined) setSetting('TELEGRAM_SCHEDULE_TIME', scheduleTime, userId)
    
    if (messageTemplates) {
      if (messageTemplates.dailyReport) setSetting('TELEGRAM_TEMPLATE_DAILY', messageTemplates.dailyReport, userId)
      if (messageTemplates.expiryWarning) setSetting('TELEGRAM_TEMPLATE_WARNING', messageTemplates.expiryWarning, userId)
      if (messageTemplates.expiredAlert) setSetting('TELEGRAM_TEMPLATE_EXPIRED', messageTemplates.expiredAlert, userId)
      if (messageTemplates.collectionConfirm) setSetting('TELEGRAM_TEMPLATE_COLLECTION', messageTemplates.collectionConfirm, userId)
    }
    
    // Записываем в audit log
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'settingsChange', 'Telegram settings', 'settings', 'Изменены настройки Telegram', req.ip)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating telegram settings:', error)
    res.status(500).json({ error: 'Failed to update telegram settings' })
  }
})

/**
 * GET /api/settings - Получить все настройки
 */
router.get('/', (req, res) => {
  try {
    const settings = getAllSettings()
    
    // Скрываем чувствительные данные для не-админов
    const userRole = req.user?.role || 'guest'
    
    if (userRole !== 'admin' && userRole !== 'Administrator') {
      // Маскируем токен бота
      if (settings.TELEGRAM_BOT_TOKEN) {
        settings.TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN.slice(0, 10) + '...'
      }
    }
    
    res.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

/**
 * GET /api/settings/:key - Получить конкретную настройку
 */
router.get('/:key', (req, res) => {
  try {
    const { key } = req.params
    const value = getSetting(key)
    
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' })
    }
    
    res.json({ key, value })
  } catch (error) {
    console.error('Error fetching setting:', error)
    res.status(500).json({ error: 'Failed to fetch setting' })
  }
})

/**
 * PUT /api/settings/:key - Обновить настройку
 */
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    const userId = req.user?.id || null
    
    // Проверяем права (только админ может менять настройки)
    if (req.user?.role !== 'admin' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ error: 'Only admins can change settings' })
    }
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' })
    }
    
    setSetting(key, value, userId)
    
    // Записываем в audit log
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'settingsChange', key, 'settings', `Изменена настройка ${key}`, req.ip)
    
    res.json({ 
      success: true, 
      key, 
      value 
    })
  } catch (error) {
    console.error('Error updating setting:', error)
    res.status(500).json({ error: 'Failed to update setting' })
  }
})

/**
 * PUT /api/settings - Обновить несколько настроек
 */
router.put('/', (req, res) => {
  try {
    const { settings } = req.body
    const userId = req.user?.id || null
    
    // Проверяем права (только админ может менять настройки)
    if (req.user?.role !== 'admin' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ error: 'Only admins can change settings' })
    }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' })
    }
    
    const db = getDb()
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        setSetting(key, value, userId)
      }
    })
    
    transaction()
    
    // Записываем в audit log
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'settingsChange', 'Bulk update', 'settings', `Изменены настройки: ${Object.keys(settings).join(', ')}`, req.ip)
    
    res.json({ 
      success: true, 
      updated: Object.keys(settings)
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

/**
 * GET /api/settings/telegram/status - Статус Telegram бота
 */
router.get('/telegram/status', async (req, res) => {
  try {
    const botToken = getSetting('TELEGRAM_BOT_TOKEN')
    const chatId = getSetting('TELEGRAM_CHAT_ID')
    
    if (!botToken) {
      return res.json({ 
        configured: false, 
        error: 'Bot token not configured' 
      })
    }
    
    // Проверяем бота через getMe
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const data = await response.json()
    
    if (data.ok) {
      res.json({
        configured: true,
        botInfo: {
          id: data.result.id,
          name: data.result.first_name,
          username: data.result.username
        },
        chatId: chatId || null,
        chatConfigured: !!chatId
      })
    } else {
      res.json({
        configured: false,
        error: data.description || 'Invalid bot token'
      })
    }
  } catch (error) {
    console.error('Error checking Telegram status:', error)
    res.json({
      configured: false,
      error: 'Failed to connect to Telegram'
    })
  }
})

/**
 * POST /api/settings/telegram/test - Отправить тестовое сообщение
 */
router.post('/telegram/test', async (req, res) => {
  try {
    const botToken = getSetting('TELEGRAM_BOT_TOKEN')
    const chatId = req.body.chatId || getSetting('TELEGRAM_CHAT_ID')
    
    if (!botToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bot token not configured' 
      })
    }
    
    if (!chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chat ID not configured' 
      })
    }
    
    const message = '🔔 FreshTrack: Тестовое сообщение. Если вы видите это - настройки работают!'
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      res.json({
        success: true,
        message: 'Test message sent successfully',
        messageId: data.result.message_id
      })
    } else {
      res.json({
        success: false,
        error: data.description || 'Failed to send message'
      })
    }
  } catch (error) {
    console.error('Error sending test message:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send test message'
    })
  }
})

/**
 * GET /api/settings/notifications/rules - Правила уведомлений (алиас)
 */
router.get('/notifications/rules', (req, res) => {
  try {
    const rules = getSetting('NOTIFICATION_RULES')
    
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
 * PUT /api/settings/notifications/rules - Обновить правила уведомлений (алиас)
 */
router.put('/notifications/rules', (req, res) => {
  try {
    const { rules } = req.body
    const userId = req.user?.id || null
    
    // Нормализация роли для проверки (admin, administrator -> admin)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change notification rules' })
    }
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'Rules array is required' })
    }
    
    setSetting('NOTIFICATION_RULES', JSON.stringify(rules), userId)
    
    res.json({ 
      success: true, 
      rules 
    })
  } catch (error) {
    console.error('Error updating notification rules:', error)
    res.status(500).json({ error: 'Failed to update notification rules' })
  }
})

/**
 * GET /api/settings/notification-rules - Правила уведомлений
 */
router.get('/notification-rules', (req, res) => {
  try {
    const rules = getSetting('NOTIFICATION_RULES')
    
    if (!rules) {
      // Дефолтные правила
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
router.put('/notification-rules', (req, res) => {
  try {
    const { rules } = req.body
    const userId = req.user?.id || null
    
    // Нормализация роли для проверки (admin, administrator -> admin)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change notification rules' })
    }
    
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'Rules array is required' })
    }
    
    setSetting('NOTIFICATION_RULES', JSON.stringify(rules), userId)
    
    res.json({ 
      success: true, 
      rules 
    })
  } catch (error) {
    console.error('Error updating notification rules:', error)
    res.status(500).json({ error: 'Failed to update notification rules' })
  }
})

export default router
