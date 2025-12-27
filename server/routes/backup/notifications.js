/**
 * FreshTrack Notifications API
 * Управление уведомлениями с hotel isolation
 * Для пилотного проекта Honor Bar, Ritz-Carlton Astana
 */

import express from 'express'
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'
import { db, logAudit } from '../db/database.js'

const router = express.Router()

// Применяем authMiddleware и hotelIsolation ко всем маршрутам
router.use(authMiddleware)
router.use(hotelIsolation)

/**
 * POST /api/notifications/test - Тестовое уведомление (для совместимости)
 */
router.post('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test notification endpoint (Telegram disabled in pilot)' 
  })
})

/**
 * POST /api/notifications/test-telegram - Тест отправки в Telegram
 */
router.post('/test-telegram', hotelAdminOnly, async (req, res) => {
  try {
    // В пилотном проекте Telegram отключен
    // Здесь будет логика отправки через Telegram Bot API
    res.json({ 
      success: true, 
      message: 'Telegram test message sent successfully (simulated in pilot)' 
    })
  } catch (error) {
    console.error('Telegram test error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send Telegram message' 
    })
  }
})

/**
 * GET /api/notifications - Получить уведомления для отеля
 * Поддержка фильтров: type, is_read, priority
 */
router.get('/', (req, res) => {
  try {
    const { type, is_read, priority, limit = 50 } = req.query
    const hotelId = req.hotelId
    
    let query = `
      SELECT n.*, d.name as department_name
      FROM notifications n
      LEFT JOIN departments d ON n.department_id = d.id
      WHERE n.hotel_id = ?
    `
    const params = [hotelId]
    
    // Для STAFF показываем только уведомления его отдела
    if (req.user.role === 'STAFF' && req.user.department_id) {
      query += ' AND (n.department_id = ? OR n.department_id IS NULL)'
      params.push(req.user.department_id)
    }
    
    if (type) {
      query += ' AND n.type = ?'
      params.push(type)
    }
    
    if (is_read !== undefined) {
      query += ' AND n.is_read = ?'
      params.push(is_read === 'true' ? 1 : 0)
    }
    
    if (priority) {
      query += ' AND n.priority = ?'
      params.push(priority)
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT ?'
    params.push(parseInt(limit))
    
    const notifications = db.prepare(query).all(...params)
    
    // Подсчет непрочитанных
    let unreadQuery = `
      SELECT COUNT(*) as count FROM notifications 
      WHERE hotel_id = ? AND is_read = 0
    `
    const unreadParams = [hotelId]
    
    if (req.user.role === 'STAFF' && req.user.department_id) {
      unreadQuery += ' AND (department_id = ? OR department_id IS NULL)'
      unreadParams.push(req.user.department_id)
    }
    
    const unreadCount = db.prepare(unreadQuery).get(...unreadParams)
    
    res.json({
      notifications,
      unread_count: unreadCount.count
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

/**
 * GET /api/notifications/summary - Сводка уведомлений для дашборда
 */
router.get('/summary', (req, res) => {
  try {
    const hotelId = req.hotelId
    const departmentId = req.user.role === 'STAFF' ? req.user.department_id : null
    
    // Получаем партии, срок которых истекает
    let batchQuery = `
      SELECT 
        b.*,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        julianday(b.expiry_date) - julianday('now', 'localtime') as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ? AND b.status = 'active' AND b.quantity > 0
    `
    const params = [hotelId]
    
    if (departmentId) {
      batchQuery += ' AND b.department_id = ?'
      params.push(departmentId)
    }
    
    batchQuery += ' ORDER BY b.expiry_date ASC'
    
    const batches = db.prepare(batchQuery).all(...params)
    
    // Классифицируем партии
    const expired = []
    const expiringToday = []
    const expiringSoon = [] // 1-3 дня
    const expiringWeek = [] // 4-7 дней
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    batches.forEach(batch => {
      const expiryDate = new Date(batch.expiry_date)
      expiryDate.setHours(0, 0, 0, 0)
      
      const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24))
      
      const batchInfo = {
        id: batch.id,
        product_name: batch.product_name,
        category_name: batch.category_name,
        department_name: batch.department_name,
        quantity: batch.quantity,
        unit: batch.unit,
        expiry_date: batch.expiry_date,
        days_until_expiry: daysUntil
      }
      
      if (daysUntil < 0) {
        expired.push(batchInfo)
      } else if (daysUntil === 0) {
        expiringToday.push(batchInfo)
      } else if (daysUntil <= 3) {
        expiringSoon.push(batchInfo)
      } else if (daysUntil <= 7) {
        expiringWeek.push(batchInfo)
      }
    })
    
    res.json({
      expired: {
        count: expired.length,
        items: expired
      },
      expiring_today: {
        count: expiringToday.length,
        items: expiringToday
      },
      expiring_soon: {
        count: expiringSoon.length,
        items: expiringSoon
      },
      expiring_week: {
        count: expiringWeek.length,
        items: expiringWeek
      },
      total_alerts: expired.length + expiringToday.length + expiringSoon.length
    })
  } catch (error) {
    console.error('Get summary error:', error)
    res.status(500).json({ error: 'Failed to get notification summary' })
  }
})

/**
 * POST /api/notifications/generate - Генерация уведомлений о сроках годности
 * Вызывается cron-задачей в 06:00
 */
router.post('/generate', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    // Находим партии, срок которых истекает в ближайшие 3 дня
    const expiringBatches = db.prepare(`
      SELECT 
        b.*,
        p.name as product_name,
        d.name as department_name,
        julianday(b.expiry_date) - julianday('now', 'localtime') as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ? 
        AND b.status = 'active' 
        AND b.quantity > 0
        AND julianday(b.expiry_date) - julianday('now', 'localtime') <= 3
    `).all(hotelId)
    
    let created = 0
    
    expiringBatches.forEach(batch => {
      const daysUntil = Math.floor(batch.days_until_expiry)
      let type, priority, title, message
      
      if (daysUntil < 0) {
        type = 'expired'
        priority = 'critical'
        title = 'Просрочен!'
        message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок истёк ${Math.abs(daysUntil)} дней назад`
      } else if (daysUntil === 0) {
        type = 'expiring_today'
        priority = 'high'
        title = 'Истекает сегодня!'
        message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок истекает сегодня`
      } else {
        type = 'expiring_soon'
        priority = 'medium'
        title = `Истекает через ${daysUntil} дн.`
        message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок до ${batch.expiry_date}`
      }
      
      // Проверяем, нет ли уже такого уведомления сегодня
      const existing = db.prepare(`
        SELECT id FROM notifications 
        WHERE hotel_id = ? 
          AND batch_id = ? 
          AND type = ?
          AND DATE(created_at) = DATE('now', 'localtime')
      `).get(hotelId, batch.id, type)
      
      if (!existing) {
        db.prepare(`
          INSERT INTO notifications (hotel_id, department_id, batch_id, type, priority, title, message)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(hotelId, batch.department_id, batch.id, type, priority, title, message)
        created++
      }
    })
    
    logAudit(hotelId, req.user.id, 'GENERATE_NOTIFICATIONS', 'notification', null, { created })
    
    res.json({
      success: true,
      message: `Generated ${created} new notifications`,
      expiring_count: expiringBatches.length,
      created_count: created
    })
  } catch (error) {
    console.error('Generate notifications error:', error)
    res.status(500).json({ error: 'Failed to generate notifications' })
  }
})

/**
 * PUT /api/notifications/:id/read - Отметить уведомление как прочитанное
 */
router.put('/:id/read', (req, res) => {
  try {
    const { id } = req.params
    const hotelId = req.hotelId
    
    // Проверяем, что уведомление принадлежит этому отелю
    const notification = db.prepare(`
      SELECT * FROM notifications WHERE id = ? AND hotel_id = ?
    `).get(id, hotelId)
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }
    
    // Для STAFF проверяем, что уведомление для его отдела
    if (req.user.role === 'STAFF' && notification.department_id && 
        notification.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE id = ?
    `).run(id)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Mark read error:', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

/**
 * PUT /api/notifications/read-all - Отметить все уведомления как прочитанные
 */
router.put('/read-all', (req, res) => {
  try {
    const hotelId = req.hotelId
    
    let query = 'UPDATE notifications SET is_read = 1 WHERE hotel_id = ?'
    const params = [hotelId]
    
    // Для STAFF только его отдел
    if (req.user.role === 'STAFF' && req.user.department_id) {
      query += ' AND (department_id = ? OR department_id IS NULL)'
      params.push(req.user.department_id)
    }
    
    const result = db.prepare(query).run(...params)
    
    res.json({ 
      success: true, 
      updated: result.changes 
    })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({ error: 'Failed to mark notifications as read' })
  }
})

/**
 * DELETE /api/notifications/:id - Удалить уведомление
 */
router.delete('/:id', hotelAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const hotelId = req.hotelId
    
    const notification = db.prepare(`
      SELECT * FROM notifications WHERE id = ? AND hotel_id = ?
    `).get(id, hotelId)
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }
    
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id)
    
    logAudit(hotelId, req.user.id, 'DELETE', 'notification', id, { title: notification.title })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

/**
 * DELETE /api/notifications/clear-read - Очистить прочитанные уведомления
 */
router.delete('/clear-read', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const result = db.prepare(`
      DELETE FROM notifications WHERE hotel_id = ? AND is_read = 1
    `).run(hotelId)
    
    logAudit(hotelId, req.user.id, 'CLEAR_READ_NOTIFICATIONS', 'notification', null, { deleted: result.changes })
    
    res.json({ 
      success: true, 
      deleted: result.changes 
    })
  } catch (error) {
    console.error('Clear read error:', error)
    res.status(500).json({ error: 'Failed to clear read notifications' })
  }
})

/**
 * GET /api/notifications/stats - Статистика уведомлений
 */
router.get('/stats', (req, res) => {
  try {
    const hotelId = req.hotelId
    const departmentId = req.user.role === 'STAFF' ? req.user.department_id : null
    
    let baseWhere = 'WHERE hotel_id = ?'
    const params = [hotelId]
    
    if (departmentId) {
      baseWhere += ' AND (department_id = ? OR department_id IS NULL)'
      params.push(departmentId)
    }
    
    // По типам
    const byType = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM notifications ${baseWhere}
      GROUP BY type
    `).all(...params)
    
    // По приоритету
    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM notifications ${baseWhere}
      GROUP BY priority
    `).all(...params)
    
    // Прочитанные/непрочитанные
    const readStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
        COUNT(*) as total
      FROM notifications ${baseWhere}
    `).get(...params)
    
    // За последние 7 дней
    const last7Days = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM notifications ${baseWhere}
        AND created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(...params)
    
    res.json({
      by_type: byType,
      by_priority: byPriority,
      read_stats: readStats,
      last_7_days: last7Days
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: 'Failed to get notification stats' })
  }
})

export default router
