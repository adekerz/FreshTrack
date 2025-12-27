/**
 * FreshTrack Reports API
 * Отчёты для пилотного проекта Honor Bar
 * Метрики: списания, экономия, эффективность
 */

import express from 'express'
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'
import { db, logAudit } from '../db/database.js'

const router = express.Router()

// Применяем authMiddleware и hotelIsolation ко всем маршрутам
router.use(authMiddleware)
router.use(hotelIsolation)

/**
 * GET /api/reports/pilot-summary - Главный отчёт для пилота
 * Сравнение "до" и "после" внедрения системы
 */
router.get('/pilot-summary', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { start_date, end_date } = req.query
    
    // Период по умолчанию - последние 30 дней
    const endDate = end_date || new Date().toISOString().split('T')[0]
    const startDate = start_date || (() => {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return d.toISOString().split('T')[0]
    })()
    
    // 1. Статистика списаний за период
    const writeOffStats = db.prepare(`
      SELECT 
        COUNT(*) as total_writeoffs,
        SUM(quantity) as total_quantity,
        SUM(estimated_value) as total_value,
        reason,
        COUNT(*) as count_by_reason
      FROM write_offs
      WHERE hotel_id = ? 
        AND DATE(write_off_date) BETWEEN ? AND ?
      GROUP BY reason
    `).all(hotelId, startDate, endDate)
    
    // 2. Общая сумма списаний
    const totalWriteOffs = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(quantity), 0) as quantity,
        COALESCE(SUM(estimated_value), 0) as value
      FROM write_offs
      WHERE hotel_id = ? 
        AND DATE(write_off_date) BETWEEN ? AND ?
    `).get(hotelId, startDate, endDate)
    
    // 3. Списания по категориям
    const writeOffsByCategory = db.prepare(`
      SELECT 
        c.name as category,
        COUNT(wo.id) as count,
        SUM(wo.quantity) as quantity,
        SUM(wo.estimated_value) as value
      FROM write_offs wo
      JOIN products p ON wo.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE wo.hotel_id = ? 
        AND DATE(wo.write_off_date) BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY value DESC
    `).all(hotelId, startDate, endDate)
    
    // 4. Списания по отделам
    const writeOffsByDepartment = db.prepare(`
      SELECT 
        d.name as department,
        COUNT(wo.id) as count,
        SUM(wo.quantity) as quantity,
        SUM(wo.estimated_value) as value
      FROM write_offs wo
      JOIN departments d ON wo.department_id = d.id
      WHERE wo.hotel_id = ? 
        AND DATE(wo.write_off_date) BETWEEN ? AND ?
      GROUP BY d.id
      ORDER BY value DESC
    `).all(hotelId, startDate, endDate)
    
    // 5. Топ-10 списываемых продуктов
    const topWriteOffProducts = db.prepare(`
      SELECT 
        p.name as product,
        c.name as category,
        SUM(wo.quantity) as quantity,
        SUM(wo.estimated_value) as value,
        COUNT(wo.id) as times_written_off
      FROM write_offs wo
      JOIN products p ON wo.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE wo.hotel_id = ? 
        AND DATE(wo.write_off_date) BETWEEN ? AND ?
      GROUP BY p.id
      ORDER BY value DESC
      LIMIT 10
    `).all(hotelId, startDate, endDate)
    
    // 6. Динамика списаний по дням
    const dailyTrend = db.prepare(`
      SELECT 
        DATE(write_off_date) as date,
        COUNT(*) as count,
        SUM(quantity) as quantity,
        SUM(estimated_value) as value
      FROM write_offs
      WHERE hotel_id = ? 
        AND DATE(write_off_date) BETWEEN ? AND ?
      GROUP BY DATE(write_off_date)
      ORDER BY date ASC
    `).all(hotelId, startDate, endDate)
    
    // 7. Активные партии и потенциальные списания
    const potentialExpiry = db.prepare(`
      SELECT 
        COUNT(*) as batches_count,
        SUM(quantity) as quantity,
        SUM(quantity * COALESCE(p.default_price, 0)) as potential_value
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.hotel_id = ? 
        AND b.status = 'active'
        AND b.quantity > 0
        AND julianday(b.expiry_date) - julianday('now', 'localtime') <= 7
    `).get(hotelId)
    
    // 8. Сохранённые продукты (собранные до истечения срока)
    const savedProducts = db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(quantity) as quantity,
        SUM(estimated_value) as value
      FROM write_offs
      WHERE hotel_id = ? 
        AND DATE(write_off_date) BETWEEN ? AND ?
        AND reason = 'collected'
    `).get(hotelId, startDate, endDate)
    
    // 9. Эффективность системы - процент собранных vs просроченных
    const efficiency = db.prepare(`
      SELECT 
        SUM(CASE WHEN reason = 'collected' THEN quantity ELSE 0 END) as collected_qty,
        SUM(CASE WHEN reason = 'expired' THEN quantity ELSE 0 END) as expired_qty,
        SUM(CASE WHEN reason = 'collected' THEN estimated_value ELSE 0 END) as collected_value,
        SUM(CASE WHEN reason = 'expired' THEN estimated_value ELSE 0 END) as expired_value
      FROM write_offs
      WHERE hotel_id = ? 
        AND DATE(write_off_date) BETWEEN ? AND ?
    `).get(hotelId, startDate, endDate)
    
    const collectedQty = efficiency.collected_qty || 0
    const expiredQty = efficiency.expired_qty || 0
    const totalQty = collectedQty + expiredQty
    const efficiencyRate = totalQty > 0 ? Math.round((collectedQty / totalQty) * 100) : 0
    
    res.json({
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        total_writeoffs: totalWriteOffs.count,
        total_quantity: totalWriteOffs.quantity,
        total_value: Math.round(totalWriteOffs.value * 100) / 100,
        currency: 'KZT'
      },
      efficiency: {
        collected_quantity: collectedQty,
        expired_quantity: expiredQty,
        collected_value: Math.round((efficiency.collected_value || 0) * 100) / 100,
        expired_value: Math.round((efficiency.expired_value || 0) * 100) / 100,
        efficiency_rate: efficiencyRate,
        saved_value: Math.round((savedProducts.value || 0) * 100) / 100
      },
      potential_loss: {
        batches_at_risk: potentialExpiry.batches_count,
        quantity_at_risk: potentialExpiry.quantity,
        value_at_risk: Math.round((potentialExpiry.potential_value || 0) * 100) / 100
      },
      by_reason: writeOffStats,
      by_category: writeOffsByCategory,
      by_department: writeOffsByDepartment,
      top_products: topWriteOffProducts,
      daily_trend: dailyTrend
    })
  } catch (error) {
    console.error('Pilot summary error:', error)
    res.status(500).json({ error: 'Failed to generate pilot summary' })
  }
})

/**
 * GET /api/reports/daily - Ежедневный отчёт
 */
router.get('/daily', (req, res) => {
  try {
    const hotelId = req.hotelId
    const departmentId = req.user.role === 'STAFF' ? req.user.department_id : null
    const date = req.query.date || new Date().toISOString().split('T')[0]
    
    let departmentFilter = ''
    const params = [hotelId, date]
    
    if (departmentId) {
      departmentFilter = ' AND b.department_id = ?'
      params.push(departmentId)
    }
    
    // Активные партии на выбранную дату
    const activeBatches = db.prepare(`
      SELECT 
        b.*,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        julianday(b.expiry_date) - julianday(?) as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ?
        AND b.status = 'active'
        AND b.quantity > 0
        ${departmentFilter}
      ORDER BY b.expiry_date ASC
    `).all(date, hotelId, ...(departmentId ? [departmentId] : []))
    
    // Списания за день
    const writeOffsParams = [hotelId, date]
    if (departmentId) writeOffsParams.push(departmentId)
    
    const dayWriteOffs = db.prepare(`
      SELECT 
        wo.*,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        u.full_name as performed_by_name
      FROM write_offs wo
      JOIN products p ON wo.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON wo.department_id = d.id
      LEFT JOIN users u ON wo.performed_by = u.id
      WHERE wo.hotel_id = ?
        AND DATE(wo.write_off_date) = ?
        ${departmentId ? 'AND wo.department_id = ?' : ''}
      ORDER BY wo.created_at DESC
    `).all(...writeOffsParams)
    
    // Подсчёт по статусам
    let expired = 0, expiringToday = 0, expiringSoon = 0, ok = 0
    
    activeBatches.forEach(b => {
      const days = Math.floor(b.days_until_expiry)
      if (days < 0) expired++
      else if (days === 0) expiringToday++
      else if (days <= 3) expiringSoon++
      else ok++
    })
    
    // Сумма списаний за день
    const dayTotal = dayWriteOffs.reduce((sum, wo) => sum + (wo.estimated_value || 0), 0)
    
    res.json({
      date,
      inventory_status: {
        total_batches: activeBatches.length,
        expired,
        expiring_today: expiringToday,
        expiring_soon: expiringSoon,
        ok
      },
      batches: activeBatches.map(b => ({
        id: b.id,
        product_name: b.product_name,
        category_name: b.category_name,
        department_name: b.department_name,
        quantity: b.quantity,
        unit: b.unit,
        expiry_date: b.expiry_date,
        days_until_expiry: Math.floor(b.days_until_expiry)
      })),
      write_offs: {
        count: dayWriteOffs.length,
        total_value: Math.round(dayTotal * 100) / 100,
        items: dayWriteOffs
      }
    })
  } catch (error) {
    console.error('Daily report error:', error)
    res.status(500).json({ error: 'Failed to generate daily report' })
  }
})

/**
 * GET /api/reports/inventory-snapshot - Снимок инвентаря
 */
router.get('/inventory-snapshot', (req, res) => {
  try {
    const hotelId = req.hotelId
    const departmentId = req.user.role === 'STAFF' ? req.user.department_id : null
    
    let departmentFilter = ''
    const params = [hotelId]
    
    if (departmentId) {
      departmentFilter = ' AND b.department_id = ?'
      params.push(departmentId)
    }
    
    // Инвентарь по категориям
    const byCategory = db.prepare(`
      SELECT 
        c.id,
        c.name as category,
        COUNT(DISTINCT b.id) as batches_count,
        SUM(b.quantity) as total_quantity,
        SUM(b.quantity * COALESCE(p.default_price, 0)) as total_value,
        MIN(b.expiry_date) as nearest_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE b.hotel_id = ?
        AND b.status = 'active'
        AND b.quantity > 0
        ${departmentFilter}
      GROUP BY c.id
      ORDER BY c.sort_order
    `).all(...params)
    
    // Инвентарь по отделам
    const byDepartment = db.prepare(`
      SELECT 
        d.id,
        d.name as department,
        COUNT(DISTINCT b.id) as batches_count,
        SUM(b.quantity) as total_quantity,
        SUM(b.quantity * COALESCE(p.default_price, 0)) as total_value
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ?
        AND b.status = 'active'
        AND b.quantity > 0
        ${departmentFilter}
      GROUP BY d.id
    `).all(...params)
    
    // Общие метрики
    const totals = db.prepare(`
      SELECT 
        COUNT(DISTINCT b.id) as total_batches,
        COUNT(DISTINCT p.id) as unique_products,
        SUM(b.quantity) as total_quantity,
        SUM(b.quantity * COALESCE(p.default_price, 0)) as total_value
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.hotel_id = ?
        AND b.status = 'active'
        AND b.quantity > 0
        ${departmentFilter}
    `).get(...params)
    
    res.json({
      timestamp: new Date().toISOString(),
      totals: {
        batches: totals.total_batches,
        unique_products: totals.unique_products,
        quantity: totals.total_quantity,
        value: Math.round((totals.total_value || 0) * 100) / 100,
        currency: 'KZT'
      },
      by_category: byCategory.map(c => ({
        ...c,
        total_value: Math.round((c.total_value || 0) * 100) / 100
      })),
      by_department: byDepartment.map(d => ({
        ...d,
        total_value: Math.round((d.total_value || 0) * 100) / 100
      }))
    })
  } catch (error) {
    console.error('Inventory snapshot error:', error)
    res.status(500).json({ error: 'Failed to generate inventory snapshot' })
  }
})

/**
 * GET /api/reports/audit-log - История действий
 */
router.get('/audit-log', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    const { page = 1, limit = 50, action, entity_type, user_id, start_date, end_date } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    let where = 'WHERE hotel_id = ?'
    const params = [hotelId]
    
    if (action) {
      where += ' AND action = ?'
      params.push(action)
    }
    
    if (entity_type) {
      where += ' AND entity_type = ?'
      params.push(entity_type)
    }
    
    if (user_id) {
      where += ' AND user_id = ?'
      params.push(user_id)
    }
    
    if (start_date) {
      where += ' AND DATE(created_at) >= ?'
      params.push(start_date)
    }
    
    if (end_date) {
      where += ' AND DATE(created_at) <= ?'
      params.push(end_date)
    }
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs ${where}
    `).get(...params).count
    
    const logs = db.prepare(`
      SELECT 
        al.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset)
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Audit log error:', error)
    res.status(500).json({ error: 'Failed to fetch audit log' })
  }
})

/**
 * GET /api/reports/export/pilot - Экспорт данных пилота для анализа
 */
router.get('/export/pilot', hotelAdminOnly, (req, res) => {
  try {
    const hotelId = req.hotelId
    
    // Все списания
    const writeOffs = db.prepare(`
      SELECT 
        wo.id,
        wo.write_off_date,
        wo.reason,
        wo.quantity,
        wo.unit,
        wo.estimated_value,
        wo.notes,
        p.name as product_name,
        p.sku,
        c.name as category_name,
        d.name as department_name,
        u.full_name as performed_by,
        wo.created_at
      FROM write_offs wo
      JOIN products p ON wo.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON wo.department_id = d.id
      LEFT JOIN users u ON wo.performed_by = u.id
      WHERE wo.hotel_id = ?
      ORDER BY wo.write_off_date DESC
    `).all(hotelId)
    
    // Все активные партии
    const batches = db.prepare(`
      SELECT 
        b.id,
        b.quantity,
        b.unit,
        b.expiry_date,
        b.received_date,
        b.status,
        p.name as product_name,
        p.sku,
        c.name as category_name,
        d.name as department_name,
        b.created_at
      FROM batches b
      JOIN products p ON b.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ?
      ORDER BY b.expiry_date ASC
    `).all(hotelId)
    
    // Уведомления
    const notifications = db.prepare(`
      SELECT 
        n.id,
        n.type,
        n.priority,
        n.title,
        n.message,
        n.is_read,
        d.name as department_name,
        n.created_at
      FROM notifications n
      LEFT JOIN departments d ON n.department_id = d.id
      WHERE n.hotel_id = ?
      ORDER BY n.created_at DESC
    `).all(hotelId)
    
    logAudit(hotelId, req.user.id, 'EXPORT_PILOT_DATA', 'report', null, {
      writeoffs_count: writeOffs.length,
      batches_count: batches.length,
      notifications_count: notifications.length
    })
    
    res.json({
      exported_at: new Date().toISOString(),
      hotel_id: hotelId,
      data: {
        write_offs: writeOffs,
        batches,
        notifications
      },
      counts: {
        write_offs: writeOffs.length,
        batches: batches.length,
        notifications: notifications.length
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    res.status(500).json({ error: 'Failed to export pilot data' })
  }
})

export default router
