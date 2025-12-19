/**
 * FreshTrack Department Notification Settings API
 * Настройки уведомлений по отделам
 */

import express from 'express'
import { db } from '../db/database.js'
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)
router.use(hotelIsolation)

// Middleware для автоматического выбора отеля для SUPER_ADMIN
const requireHotelContext = (req, res, next) => {
  if (!req.hotelId) {
    if (req.user?.role === 'SUPER_ADMIN') {
      const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
      if (firstHotel) {
        req.hotelId = firstHotel.id
        return next()
      }
    }
    return res.status(400).json({ error: 'Hotel context required' })
  }
  next()
}

router.use(requireHotelContext)

let tableInitialized = false

// Ленивая инициализация таблицы
const ensureTable = () => {
  if (tableInitialized) return
  
  try {
    
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS department_notification_settings (
        department_id TEXT PRIMARY KEY,
        telegram_enabled INTEGER DEFAULT 1,
        push_enabled INTEGER DEFAULT 1,
        email_enabled INTEGER DEFAULT 0,
        quiet_hours_start TEXT DEFAULT '22:00',
        quiet_hours_end TEXT DEFAULT '08:00',
        notification_days TEXT DEFAULT '[7, 3, 1]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    tableInitialized = true
    console.log('Таблица department_notification_settings готова')
  } catch (error) {
    console.log('Ошибка создания таблицы department_notification_settings:', error.message)
  }
}

// Middleware для инициализации таблицы
router.use((req, res, next) => {
  ensureTable()
  next()
})

/**
 * GET /api/department-settings - Получить настройки всех отделов
 */
router.get('/', (req, res) => {
  try {
    
    const settings = db.prepare(`
      SELECT 
        department_id as departmentId,
        telegram_enabled as telegramEnabled,
        push_enabled as pushEnabled,
        email_enabled as emailEnabled,
        quiet_hours_start as quietHoursStart,
        quiet_hours_end as quietHoursEnd,
        notification_days as notificationDays,
        updated_at as updatedAt
      FROM department_notification_settings
    `).all()
    
    // Преобразуем в объект по departmentId
    const settingsMap = {}
    settings.forEach(s => {
      settingsMap[s.departmentId] = {
        telegramEnabled: Boolean(s.telegramEnabled),
        pushEnabled: Boolean(s.pushEnabled),
        emailEnabled: Boolean(s.emailEnabled),
        quietHoursStart: s.quietHoursStart,
        quietHoursEnd: s.quietHoursEnd,
        notificationDays: JSON.parse(s.notificationDays || '[7, 3, 1]'),
        updatedAt: s.updatedAt
      }
    })
    
    res.json({ success: true, settings: settingsMap })
  } catch (error) {
    console.error('Error fetching department settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

/**
 * GET /api/department-settings/:departmentId - Получить настройки отдела
 */
router.get('/:departmentId', (req, res) => {
  try {
    
    const { departmentId } = req.params
    
    let settings = db.prepare(`
      SELECT 
        department_id as departmentId,
        telegram_enabled as telegramEnabled,
        push_enabled as pushEnabled,
        email_enabled as emailEnabled,
        quiet_hours_start as quietHoursStart,
        quiet_hours_end as quietHoursEnd,
        notification_days as notificationDays
      FROM department_notification_settings
      WHERE department_id = ?
    `).get(departmentId)
    
    // Если настроек нет, возвращаем дефолтные
    if (!settings) {
      settings = {
        departmentId,
        telegramEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        notificationDays: [7, 3, 1]
      }
    } else {
      settings = {
        departmentId: settings.departmentId,
        telegramEnabled: Boolean(settings.telegramEnabled),
        pushEnabled: Boolean(settings.pushEnabled),
        emailEnabled: Boolean(settings.emailEnabled),
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
        notificationDays: JSON.parse(settings.notificationDays || '[7, 3, 1]')
      }
    }
    
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Error fetching department settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

/**
 * PUT /api/department-settings/:departmentId - Обновить настройки отдела
 */
router.put('/:departmentId', (req, res) => {
  try {
    
    const { departmentId } = req.params
    const { 
      telegramEnabled, 
      pushEnabled, 
      emailEnabled,
      quietHoursStart, 
      quietHoursEnd,
      notificationDays 
    } = req.body
    
    // Проверяем существует ли запись
    const existing = db.prepare(
      'SELECT * FROM department_notification_settings WHERE department_id = ?'
    ).get(departmentId)
    
    if (existing) {
      // Обновляем
      db.prepare(`
        UPDATE department_notification_settings
        SET telegram_enabled = COALESCE(?, telegram_enabled),
            push_enabled = COALESCE(?, push_enabled),
            email_enabled = COALESCE(?, email_enabled),
            quiet_hours_start = COALESCE(?, quiet_hours_start),
            quiet_hours_end = COALESCE(?, quiet_hours_end),
            notification_days = COALESCE(?, notification_days),
            updated_at = datetime('now')
        WHERE department_id = ?
      `).run(
        telegramEnabled !== undefined ? (telegramEnabled ? 1 : 0) : null,
        pushEnabled !== undefined ? (pushEnabled ? 1 : 0) : null,
        emailEnabled !== undefined ? (emailEnabled ? 1 : 0) : null,
        quietHoursStart,
        quietHoursEnd,
        notificationDays ? JSON.stringify(notificationDays) : null,
        departmentId
      )
    } else {
      // Создаём новую запись
      db.prepare(`
        INSERT INTO department_notification_settings 
        (department_id, telegram_enabled, push_enabled, email_enabled, quiet_hours_start, quiet_hours_end, notification_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        departmentId,
        telegramEnabled !== undefined ? (telegramEnabled ? 1 : 0) : 1,
        pushEnabled !== undefined ? (pushEnabled ? 1 : 0) : 1,
        emailEnabled !== undefined ? (emailEnabled ? 1 : 0) : 0,
        quietHoursStart || '22:00',
        quietHoursEnd || '08:00',
        notificationDays ? JSON.stringify(notificationDays) : '[7, 3, 1]'
      )
    }
    
    res.json({ success: true, message: 'Settings updated' })
  } catch (error) {
    console.error('Error updating department settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

/**
 * Проверка тихих часов для отдела
 */
export function isQuietHours(departmentId) {
  try {
    
    const settings = db.prepare(`
      SELECT quiet_hours_start, quiet_hours_end
      FROM department_notification_settings
      WHERE department_id = ?
    `).get(departmentId)
    
    if (!settings) return false
    
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const { quiet_hours_start: start, quiet_hours_end: end } = settings
    
    // Если тихие часы переходят через полночь (например 22:00 - 08:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end
    }
    
    return currentTime >= start && currentTime <= end
  } catch (error) {
    console.error('Error checking quiet hours:', error)
    return false
  }
}

/**
 * Проверка, включены ли уведомления для отдела
 */
export function shouldNotify(departmentId, channel = 'telegram') {
  try {
    
    const settings = db.prepare(`
      SELECT telegram_enabled, push_enabled, email_enabled
      FROM department_notification_settings
      WHERE department_id = ?
    `).get(departmentId)
    
    if (!settings) return true // По умолчанию уведомления включены
    
    // Проверяем тихие часы
    if (isQuietHours(departmentId)) return false
    
    switch (channel) {
      case 'telegram': return Boolean(settings.telegram_enabled)
      case 'push': return Boolean(settings.push_enabled)
      case 'email': return Boolean(settings.email_enabled)
      default: return true
    }
  } catch (error) {
    console.error('Error checking notification settings:', error)
    return true
  }
}

export default router
