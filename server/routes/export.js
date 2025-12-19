/**
 * FreshTrack Export API
 * Экспорт данных в Excel формате
 */

import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

/**
 * Генерация CSV контента
 */
const generateCSV = (data, columns) => {
  if (!data || data.length === 0) {
    return columns.map(c => c.header).join(',') + '\n'
  }
  
  const headers = columns.map(c => `"${c.header}"`).join(',')
  const rows = data.map(row => 
    columns.map(c => {
      const value = row[c.key]
      if (value === null || value === undefined) return ''
      // Экранируем кавычки в значениях
      return `"${String(value).replace(/"/g, '""')}"`
    }).join(',')
  )
  
  return [headers, ...rows].join('\n')
}

/**
 * GET /api/export/inventory - Экспорт инвентаря
 */
router.get('/inventory', (req, res) => {
  try {
    const db = getDb()
    
    const batches = db.prepare(`
      SELECT 
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        b.quantity,
        b.expiry_date,
        b.manufacturing_date,
        CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_left,
        CASE 
          WHEN julianday(b.expiry_date) < julianday('now') THEN 'Просрочено'
          WHEN julianday(b.expiry_date) - julianday('now') <= 3 THEN 'Критично'
          WHEN julianday(b.expiry_date) - julianday('now') <= 7 THEN 'Внимание'
          ELSE 'В норме'
        END as status
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON b.department_id = d.id
      WHERE b.is_collected = 0
      ORDER BY b.expiry_date ASC
    `).all()

    const columns = [
      { key: 'product_name', header: 'Товар' },
      { key: 'category_name', header: 'Категория' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'days_left', header: 'Дней осталось' },
      { key: 'status', header: 'Статус' }
    ]

    const csv = generateCSV(batches, columns)
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-inventory-${new Date().toISOString().split('T')[0]}.csv"`)
    // BOM for Excel UTF-8 support
    res.send('\uFEFF' + csv)
    
  } catch (error) {
    console.error('Error exporting inventory:', error)
    res.status(500).json({ error: 'Failed to export inventory' })
  }
})

/**
 * GET /api/export/batches - Экспорт всех партий
 */
router.get('/batches', (req, res) => {
  try {
    const db = getDb()
    
    const batches = db.prepare(`
      SELECT 
        b.id,
        p.name as product_name,
        c.name as category_name,
        d.name as department_name,
        b.quantity,
        b.manufacturing_date,
        b.expiry_date,
        b.is_collected as collected,
        b.collected_at,
        b.collection_reason,
        b.added_at as created_at,
        u.name as created_by
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON b.department_id = d.id
      LEFT JOIN users u ON b.added_by = u.id
      ORDER BY b.added_at DESC
    `).all()

    const columns = [
      { key: 'id', header: 'ID' },
      { key: 'product_name', header: 'Товар' },
      { key: 'category_name', header: 'Категория' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'manufacturing_date', header: 'Дата производства' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'collected', header: 'Собрано' },
      { key: 'collected_at', header: 'Дата сбора' },
      { key: 'collection_reason', header: 'Причина сбора' },
      { key: 'created_at', header: 'Добавлено' },
      { key: 'created_by', header: 'Добавил' }
    ]

    const csv = generateCSV(batches, columns)
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-batches-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\uFEFF' + csv)
    
  } catch (error) {
    console.error('Error exporting batches:', error)
    res.status(500).json({ error: 'Failed to export batches' })
  }
})

/**
 * GET /api/export/collections - Экспорт истории сборов
 */
router.get('/collections', (req, res) => {
  try {
    const db = getDb()
    
    const collections = db.prepare(`
      SELECT 
        b.collected_at as date,
        p.name as product_name,
        d.name as department_name,
        b.quantity,
        b.expiry_date,
        b.collection_reason as reason,
        u.name as collected_by
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN departments d ON b.department_id = d.id
      LEFT JOIN users u ON b.collected_by = u.id
      WHERE b.is_collected = 1
      ORDER BY b.collected_at DESC
    `).all()

    const columns = [
      { key: 'date', header: 'Дата сбора' },
      { key: 'product_name', header: 'Товар' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'reason', header: 'Причина' },
      { key: 'collected_by', header: 'Собрал' }
    ]

    const csv = generateCSV(collections, columns)
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-collections-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\uFEFF' + csv)
    
  } catch (error) {
    console.error('Error exporting collections:', error)
    res.status(500).json({ error: 'Failed to export collections' })
  }
})

/**
 * GET /api/export/audit - Экспорт журнала действий
 */
router.get('/audit', (req, res) => {
  try {
    const db = getDb()
    
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        user_name,
        action,
        entity_name as target,
        entity_type as target_type,
        new_value as details,
        ip_address
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10000
    `).all()

    const columns = [
      { key: 'timestamp', header: 'Дата и время' },
      { key: 'user_name', header: 'Пользователь' },
      { key: 'action', header: 'Действие' },
      { key: 'target', header: 'Объект' },
      { key: 'target_type', header: 'Тип объекта' },
      { key: 'details', header: 'Подробности' },
      { key: 'ip_address', header: 'IP адрес' }
    ]

    const csv = generateCSV(logs, columns)
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-audit-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\uFEFF' + csv)
    
  } catch (error) {
    console.error('Error exporting audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

export default router
