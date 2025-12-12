/**
 * FreshTrack Settings API
 * Управление системными настройками
 */

import express from 'express'
import { getDb, getSetting, setSetting, getAllSettings } from '../db/database.js'
import { logAction } from './audit-logs.js'

const router = express.Router()

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
    
    if (req.user?.role !== 'admin' && req.user?.role !== 'Administrator') {
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
    
    if (req.user?.role !== 'admin' && req.user?.role !== 'Administrator') {
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
