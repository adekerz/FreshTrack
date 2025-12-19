/**
 * FreshTrack Notification Rules API
 * Правила автоматических уведомлений
 */

import express from 'express'
import { db } from '../db/database.js'
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'

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

// Инициализация таблицы (ленивая)
const ensureTable = () => {
  if (tableInitialized) return
  
  try {
    
    
    // Таблица правил уведомлений
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department_id TEXT,
        category TEXT,
        days_before INTEGER NOT NULL DEFAULT 7,
        notification_type TEXT DEFAULT 'all',
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Проверяем есть ли начальные правила
    const count = db.prepare('SELECT COUNT(*) as count FROM notification_rules').get()
    if (count.count === 0) {
      db.exec(`
        INSERT INTO notification_rules (name, category, days_before, notification_type) VALUES
        ('Еда — 3 дня', 'food', 3, 'all'),
        ('Напитки — 7 дней', 'soft-drinks', 7, 'telegram'),
        ('Алкоголь — 14 дней', 'alcohol-drinks', 14, 'telegram'),
        ('По умолчанию — 7 дней', NULL, 7, 'telegram')
      `)
    }
    
    tableInitialized = true
    console.log('Таблица notification_rules готова')
  } catch (error) {
    console.log('Ошибка создания таблицы notification_rules:', error.message)
  }
}

// Middleware для инициализации таблицы
router.use((req, res, next) => {
  ensureTable()
  next()
})

/**
 * GET /api/notification-rules - Получить все правила
 */
router.get('/', (req, res) => {
  try {
    
    const rules = db.prepare(`
      SELECT 
        id,
        name,
        department_id as departmentId,
        category,
        days_before as daysBefore,
        notification_type as notificationType,
        is_active as isActive,
        created_by as createdBy,
        created_at as createdAt
      FROM notification_rules
      ORDER BY created_at DESC
    `).all()
    
    res.json({ 
      success: true, 
      rules: rules.map(r => ({
        ...r,
        isActive: Boolean(r.isActive)
      }))
    })
  } catch (error) {
    console.error('Error fetching notification rules:', error)
    res.status(500).json({ error: 'Failed to fetch rules' })
  }
})

/**
 * GET /api/notification-rules/active - Получить только активные правила
 */
router.get('/active', (req, res) => {
  try {
    
    const rules = db.prepare(`
      SELECT 
        id,
        name,
        department_id as departmentId,
        category,
        days_before as daysBefore,
        notification_type as notificationType
      FROM notification_rules
      WHERE is_active = 1
      ORDER BY days_before ASC
    `).all()
    
    res.json({ success: true, rules })
  } catch (error) {
    console.error('Error fetching active rules:', error)
    res.status(500).json({ error: 'Failed to fetch active rules' })
  }
})

/**
 * POST /api/notification-rules - Создать правило
 */
router.post('/', (req, res) => {
  try {
    
    const { name, departmentId, category, daysBefore, notificationType } = req.body
    const createdBy = req.user?.id || null
    
    if (!name || !daysBefore) {
      return res.status(400).json({ error: 'Name and daysBefore are required' })
    }
    
    const result = db.prepare(`
      INSERT INTO notification_rules (name, department_id, category, days_before, notification_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, departmentId || null, category || null, daysBefore, notificationType || 'all', createdBy)
    
    res.status(201).json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: 'Rule created' 
    })
  } catch (error) {
    console.error('Error creating rule:', error)
    res.status(500).json({ error: 'Failed to create rule' })
  }
})

/**
 * PUT /api/notification-rules/:id - Обновить правило
 */
router.put('/:id', (req, res) => {
  try {
    
    const id = parseInt(req.params.id)
    const { name, departmentId, category, daysBefore, notificationType, isActive } = req.body
    
    const existing = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' })
    }
    
    db.prepare(`
      UPDATE notification_rules
      SET name = COALESCE(?, name),
          department_id = ?,
          category = ?,
          days_before = COALESCE(?, days_before),
          notification_type = COALESCE(?, notification_type),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name, 
      departmentId !== undefined ? departmentId : existing.department_id,
      category !== undefined ? category : existing.category,
      daysBefore, 
      notificationType, 
      isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
      id
    )
    
    res.json({ success: true, message: 'Rule updated' })
  } catch (error) {
    console.error('Error updating rule:', error)
    res.status(500).json({ error: 'Failed to update rule' })
  }
})

/**
 * PATCH /api/notification-rules/:id/toggle - Переключить активность
 */
router.patch('/:id/toggle', (req, res) => {
  try {
    
    const id = parseInt(req.params.id)
    
    const existing = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' })
    }
    
    const newStatus = existing.is_active ? 0 : 1
    db.prepare('UPDATE notification_rules SET is_active = ? WHERE id = ?').run(newStatus, id)
    
    res.json({ success: true, isActive: Boolean(newStatus) })
  } catch (error) {
    console.error('Error toggling rule:', error)
    res.status(500).json({ error: 'Failed to toggle rule' })
  }
})

/**
 * DELETE /api/notification-rules/:id - Удалить правило
 */
router.delete('/:id', (req, res) => {
  try {
    
    const id = parseInt(req.params.id)
    
    const existing = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' })
    }
    
    db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id)
    
    res.json({ success: true, message: 'Rule deleted' })
  } catch (error) {
    console.error('Error deleting rule:', error)
    res.status(500).json({ error: 'Failed to delete rule' })
  }
})

export default router
