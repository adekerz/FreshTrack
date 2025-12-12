/**
 * FreshTrack Batches API
 * CRUD операции для партий товаров
 */

import express from 'express'
import { getDb } from '../db/database.js'
import { logAction } from './audit-logs.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

/**
 * GET /api/batches - Получить все партии
 */
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { department, status, category } = req.query
    
    let sql = `
      SELECT 
        p.id,
        p.name as product_name,
        p.department,
        p.category,
        p.quantity,
        p.expiry_date,
        p.created_at as added_at,
        CASE 
          WHEN p.expiry_date < date('now') THEN 'expired'
          WHEN p.expiry_date <= date('now', '+3 days') THEN 'critical'
          WHEN p.expiry_date <= date('now', '+7 days') THEN 'warning'
          ELSE 'good'
        END as status,
        julianday(p.expiry_date) - julianday('now') as days_left
      FROM products p
      WHERE 1=1
    `
    
    const params = []
    
    if (department) {
      sql += ' AND p.department = ?'
      params.push(department)
    }
    
    if (category) {
      sql += ' AND p.category = ?'
      params.push(category)
    }
    
    if (status) {
      if (status === 'expired') {
        sql += " AND p.expiry_date < date('now')"
      } else if (status === 'critical') {
        sql += " AND p.expiry_date >= date('now') AND p.expiry_date <= date('now', '+3 days')"
      } else if (status === 'warning') {
        sql += " AND p.expiry_date > date('now', '+3 days') AND p.expiry_date <= date('now', '+7 days')"
      } else if (status === 'good') {
        sql += " AND p.expiry_date > date('now', '+7 days')"
      }
    }
    
    sql += ' ORDER BY p.expiry_date ASC'
    
    const batches = db.prepare(sql).all(...params)
    
    res.json(batches.map(b => ({
      id: b.id,
      productName: b.product_name,
      department: b.department,
      category: b.category,
      quantity: b.quantity,
      expiryDate: b.expiry_date,
      addedAt: b.added_at,
      status: b.status,
      daysLeft: Math.floor(b.days_left)
    })))
  } catch (error) {
    console.error('Error fetching batches:', error)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
})

/**
 * GET /api/batches/stats - Статистика партий
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDb()
    const { department } = req.query
    
    let whereClause = ''
    const params = []
    
    if (department) {
      whereClause = 'WHERE department = ?'
      params.push(department)
    }
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN expiry_date < date('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN expiry_date >= date('now') AND expiry_date <= date('now', '+3 days') THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN expiry_date > date('now', '+3 days') AND expiry_date <= date('now', '+7 days') THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN expiry_date > date('now', '+7 days') THEN 1 ELSE 0 END) as good
      FROM products
      ${whereClause}
    `).get(...params)
    
    res.json({
      total: stats.total || 0,
      expired: stats.expired || 0,
      critical: stats.critical || 0,
      warning: stats.warning || 0,
      good: stats.good || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

/**
 * GET /api/batches/by-department - Статистика по отделам
 */
router.get('/by-department', (req, res) => {
  try {
    const db = getDb()
    
    const batches = db.prepare(`
      SELECT 
        department,
        COUNT(*) as total,
        SUM(CASE WHEN expiry_date < date('now') THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN expiry_date >= date('now') AND expiry_date <= date('now', '+3 days') THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN expiry_date > date('now', '+3 days') AND expiry_date <= date('now', '+7 days') THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN expiry_date > date('now', '+7 days') THEN 1 ELSE 0 END) as good
      FROM products
      GROUP BY department
    `).all()
    
    res.json(batches)
  } catch (error) {
    console.error('Error fetching department stats:', error)
    res.status(500).json({ error: 'Failed to fetch department stats' })
  }
})

/**
 * GET /api/batches/alerts - Партии требующие внимания (истекают в ближайшие 7 дней)
 */
router.get('/alerts', (req, res) => {
  try {
    const db = getDb()
    const { department } = req.query
    
    let sql = `
      SELECT 
        p.id,
        p.name as product_name,
        p.department,
        p.category,
        p.quantity,
        p.expiry_date,
        julianday(p.expiry_date) - julianday('now') as days_left,
        CASE 
          WHEN p.expiry_date < date('now') THEN 'expired'
          WHEN p.expiry_date <= date('now', '+3 days') THEN 'critical'
          ELSE 'warning'
        END as status
      FROM products p
      WHERE p.expiry_date <= date('now', '+7 days')
    `
    
    const params = []
    
    if (department) {
      sql += ' AND p.department = ?'
      params.push(department)
    }
    
    sql += ' ORDER BY p.expiry_date ASC'
    
    const alerts = db.prepare(sql).all(...params)
    
    res.json(alerts.map(a => ({
      id: a.id,
      productName: a.product_name,
      department: a.department,
      category: a.category,
      quantity: a.quantity,
      expiryDate: a.expiry_date,
      daysLeft: Math.floor(a.days_left),
      status: a.status
    })))
  } catch (error) {
    console.error('Error fetching alerts:', error)
    res.status(500).json({ error: 'Failed to fetch alerts' })
  }
})

/**
 * GET /api/batches/collections - История сборов
 */
router.get('/collections', (req, res) => {
  try {
    const db = getDb()
    const { department, startDate, endDate, limit = 100 } = req.query
    
    let sql = `
      SELECT 
        c.id,
        c.batch_id,
        c.product_name,
        c.department_id as department,
        c.expiry_date,
        c.quantity,
        c.collected_at,
        c.collected_by,
        c.reason,
        c.comment,
        u.name as collector_name
      FROM collection_logs c
      LEFT JOIN users u ON c.collected_by = u.id
      WHERE 1=1
    `
    
    const params = []
    
    if (department) {
      sql += ' AND c.department_id = ?'
      params.push(department)
    }
    
    if (startDate) {
      sql += ' AND date(c.collected_at) >= date(?)'
      params.push(startDate)
    }
    
    if (endDate) {
      sql += ' AND date(c.collected_at) <= date(?)'
      params.push(endDate)
    }
    
    sql += ' ORDER BY c.collected_at DESC LIMIT ?'
    params.push(parseInt(limit))
    
    const collections = db.prepare(sql).all(...params)
    
    res.json(collections.map(c => ({
      id: c.id,
      batchId: c.batch_id,
      productName: c.product_name,
      department: c.department,
      expiryDate: c.expiry_date,
      quantity: c.quantity,
      collectedAt: c.collected_at,
      collectedBy: c.collected_by,
      collectorName: c.collector_name,
      reason: c.reason,
      comment: c.comment
    })))
  } catch (error) {
    console.error('Error fetching collections:', error)
    res.status(500).json({ error: 'Failed to fetch collections' })
  }
})

/**
 * GET /api/batches/collections/stats - Статистика сборов
 */
router.get('/collections/stats', (req, res) => {
  try {
    const db = getDb()
    const { period = 'week' } = req.query
    
    // Определяем период
    let dateFilter = "date('now', '-7 days')"
    if (period === 'month') dateFilter = "date('now', '-30 days')"
    if (period === 'year') dateFilter = "date('now', '-365 days')"
    
    // Общая статистика
    const total = db.prepare(`
      SELECT 
        COUNT(*) as totalCollections,
        SUM(quantity) as totalQuantity
      FROM collection_logs
      WHERE date(collected_at) >= ${dateFilter}
    `).get()
    
    // По отделам
    const byDepartment = db.prepare(`
      SELECT 
        department_id as department,
        COUNT(*) as collections,
        SUM(quantity) as quantity
      FROM collection_logs
      WHERE date(collected_at) >= ${dateFilter}
      GROUP BY department_id
      ORDER BY quantity DESC
    `).all()
    
    // По дням
    const byDay = db.prepare(`
      SELECT 
        date(collected_at) as date,
        COUNT(*) as collections,
        SUM(quantity) as quantity
      FROM collection_logs
      WHERE date(collected_at) >= ${dateFilter}
      GROUP BY date(collected_at)
      ORDER BY date ASC
    `).all()
    
    // По причинам
    const byReason = db.prepare(`
      SELECT 
        reason,
        COUNT(*) as count,
        SUM(quantity) as quantity
      FROM collection_logs
      WHERE date(collected_at) >= ${dateFilter}
      GROUP BY reason
    `).all()
    
    res.json({
      total: {
        collections: total.totalCollections || 0,
        quantity: total.totalQuantity || 0
      },
      byDepartment,
      byDay,
      byReason
    })
  } catch (error) {
    console.error('Error fetching collection stats:', error)
    res.status(500).json({ error: 'Failed to fetch collection stats' })
  }
})

/**
 * POST /api/batches - Создать новую партию
 */
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { productName, department, category, quantity, expiryDate, manufacturingDate } = req.body
    
    // Валидация
    if (!productName || !department || !category || !quantity || !expiryDate) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' })
    }
    
    const result = db.prepare(`
      INSERT INTO products (name, department, category, quantity, expiry_date, created_at) 
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(productName, department, category, parseInt(quantity), expiryDate)
    
    const newBatch = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)
    
    // Записываем в audit log
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'create', productName, 'batch', `Создана новая партия: ${quantity} шт., срок годности: ${expiryDate}`, req.ip)
    
    res.status(201).json({
      id: newBatch.id,
      productName: newBatch.name,
      department: newBatch.department,
      category: newBatch.category,
      quantity: newBatch.quantity,
      expiryDate: newBatch.expiry_date,
      addedAt: newBatch.created_at
    })
  } catch (error) {
    console.error('Error creating batch:', error)
    res.status(500).json({ error: 'Failed to create batch' })
  }
})

/**
 * POST /api/batches/bulk - Создать несколько партий (для шаблонов)
 */
router.post('/bulk', (req, res) => {
  try {
    const db = getDb()
    const { items } = req.body
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' })
    }
    
    const stmt = db.prepare(`
      INSERT INTO products (name, department, category, quantity, expiry_date, created_at) 
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)
    
    const insertMany = db.transaction((items) => {
      const results = []
      for (const item of items) {
        const result = stmt.run(
          item.productName, 
          item.department, 
          item.category, 
          parseInt(item.quantity), 
          item.expiryDate
        )
        results.push(result.lastInsertRowid)
      }
      return results
    })
    
    const ids = insertMany(items)
    
    // Записываем в audit log
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'create', 'Bulk import', 'batch', `Создано ${ids.length} партий из шаблона`, req.ip)
    
    res.status(201).json({ 
      success: true, 
      count: ids.length,
      ids 
    })
  } catch (error) {
    console.error('Error creating batches:', error)
    res.status(500).json({ error: 'Failed to create batches' })
  }
})

/**
 * GET /api/batches/:id - Получить партию по ID
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    
    const batch = db.prepare(`
      SELECT 
        p.id,
        p.name as product_name,
        p.department,
        p.category,
        p.quantity,
        p.expiry_date,
        p.created_at as added_at,
        CASE 
          WHEN p.expiry_date < date('now') THEN 'expired'
          WHEN p.expiry_date <= date('now', '+3 days') THEN 'critical'
          WHEN p.expiry_date <= date('now', '+7 days') THEN 'warning'
          ELSE 'good'
        END as status,
        julianday(p.expiry_date) - julianday('now') as days_left
      FROM products p
      WHERE p.id = ?
    `).get(id)
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    res.json({
      id: batch.id,
      productName: batch.product_name,
      department: batch.department,
      category: batch.category,
      quantity: batch.quantity,
      expiryDate: batch.expiry_date,
      addedAt: batch.added_at,
      status: batch.status,
      daysLeft: Math.floor(batch.days_left)
    })
  } catch (error) {
    console.error('Error fetching batch:', error)
    res.status(500).json({ error: 'Failed to fetch batch' })
  }
})

/**
 * PUT /api/batches/:id - Обновить партию
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    const { productName, department, category, quantity, expiryDate } = req.body
    
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    db.prepare(`
      UPDATE products 
      SET name = COALESCE(?, name),
          department = COALESCE(?, department),
          category = COALESCE(?, category),
          quantity = COALESCE(?, quantity),
          expiry_date = COALESCE(?, expiry_date),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(productName, department, category, quantity, expiryDate, id)
    
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    
    // Записываем в audit log
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    const changes = []
    if (quantity !== undefined && quantity !== existing.quantity) changes.push(`количество: ${existing.quantity} → ${quantity}`)
    if (expiryDate && expiryDate !== existing.expiry_date) changes.push(`срок годности: ${existing.expiry_date} → ${expiryDate}`)
    logAction(userId, userName, 'update', existing.name, 'batch', changes.length > 0 ? `Обновлено: ${changes.join(', ')}` : 'Обновлена партия', req.ip)
    
    res.json({
      id: updated.id,
      productName: updated.name,
      department: updated.department,
      category: updated.category,
      quantity: updated.quantity,
      expiryDate: updated.expiry_date
    })
  } catch (error) {
    console.error('Error updating batch:', error)
    res.status(500).json({ error: 'Failed to update batch' })
  }
})

/**
 * PATCH /api/batches/:id/collect - Отметить партию как собранную
 */
router.patch('/:id/collect', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    const { reason, comment } = req.body
    const collectedBy = req.user?.id || null
    const collectedByName = req.user?.name || 'Система'
    
    // Получаем партию
    const batch = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    // Записываем в лог сборов (с комментарием)
    db.prepare(`
      INSERT INTO collection_logs (batch_id, product_name, department_id, expiry_date, quantity, collected_by, reason, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, batch.name, batch.department, batch.expiry_date, batch.quantity, collectedBy, reason || 'manual', comment || null)
    
    // Записываем в audit log
    logAction(
      collectedBy, 
      collectedByName, 
      'collect', 
      batch.name, 
      'batch', 
      `Собрано ${batch.quantity} шт. Причина: ${reason || 'не указана'}${comment ? '. Комментарий: ' + comment : ''}`,
      req.ip
    )
    
    // Удаляем партию из products (или помечаем как собранную)
    db.prepare('DELETE FROM products WHERE id = ?').run(id)
    
    res.json({ 
      success: true, 
      message: 'Batch collected',
      batchId: id
    })
  } catch (error) {
    console.error('Error collecting batch:', error)
    res.status(500).json({ error: 'Failed to collect batch' })
  }
})

/**
 * DELETE /api/batches/:id - Удалить партию
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    
    db.prepare('DELETE FROM products WHERE id = ?').run(id)
    
    // Записываем в audit log
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'delete', existing.name, 'batch', `Удалена партия: ${existing.quantity} шт.`, req.ip)
    
    res.json({ success: true, message: 'Batch deleted' })
  } catch (error) {
    console.error('Error deleting batch:', error)
    res.status(500).json({ error: 'Failed to delete batch' })
  }
})

export default router
