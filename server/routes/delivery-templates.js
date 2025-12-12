/**
 * FreshTrack Delivery Templates API
 * Шаблоны поставок для быстрого добавления товаров
 */

import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { logAction } from './audit-logs.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

let tableInitialized = false

// Ленивая инициализация таблицы
const ensureTable = () => {
  if (tableInitialized) return
  
  try {
    const db = getDb()
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department_id TEXT,
        items TEXT NOT NULL,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Проверяем есть ли начальные шаблоны
    const count = db.prepare('SELECT COUNT(*) as count FROM delivery_templates').get()
    if (count.count === 0) {
      // Добавляем демо-шаблон
      const demoItems = JSON.stringify([
        { productName: "Coca-Cola 0.5л", defaultQuantity: 24, defaultShelfLife: 180, category: "soft-drinks" },
        { productName: "Pepsi 0.5л", defaultQuantity: 24, defaultShelfLife: 180, category: "soft-drinks" },
        { productName: "Snickers", defaultQuantity: 48, defaultShelfLife: 365, category: "snacks" },
        { productName: "Mars", defaultQuantity: 48, defaultShelfLife: 365, category: "snacks" }
      ])
      
      db.prepare(`
        INSERT INTO delivery_templates (name, department_id, items) 
        VALUES (?, ?, ?)
      `).run('Стандартная поставка Honor Bar', 'honor-bar', demoItems)
      
      const dairyItems = JSON.stringify([
        { productName: "Молоко 3.2%", defaultQuantity: 20, defaultShelfLife: 7, category: "dairy" },
        { productName: "Йогурт клубничный", defaultQuantity: 30, defaultShelfLife: 14, category: "dairy" },
        { productName: "Сыр Российский", defaultQuantity: 10, defaultShelfLife: 30, category: "dairy" }
      ])
      
      db.prepare(`
        INSERT INTO delivery_templates (name, department_id, items) 
        VALUES (?, ?, ?)
      `).run('Молочная продукция', 'f-b-kitchen', dairyItems)
    }
    
    tableInitialized = true
    console.log('Таблица delivery_templates готова')
  } catch (error) {
    console.log('Ошибка создания таблицы delivery_templates:', error.message)
  }
}

// Middleware для инициализации таблицы
router.use((req, res, next) => {
  ensureTable()
  next()
})

/**
 * GET /api/delivery-templates - Получить все шаблоны
 */
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { departmentId } = req.query
    
    let sql = `
      SELECT 
        id,
        name,
        department_id as departmentId,
        items,
        created_by as createdBy,
        created_at as createdAt,
        updated_at as updatedAt
      FROM delivery_templates
    `
    const params = []
    
    if (departmentId) {
      sql += ' WHERE department_id = ? OR department_id IS NULL'
      params.push(departmentId)
    }
    
    sql += ' ORDER BY name ASC'
    
    const templates = db.prepare(sql).all(...params)
    
    res.json({ 
      success: true, 
      templates: templates.map(t => ({
        ...t,
        items: JSON.parse(t.items)
      }))
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
})

/**
 * GET /api/delivery-templates/:id - Получить шаблон по ID
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    
    const template = db.prepare(`
      SELECT 
        id,
        name,
        department_id as departmentId,
        items,
        created_by as createdBy,
        created_at as createdAt
      FROM delivery_templates
      WHERE id = ?
    `).get(id)
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    res.json({ 
      success: true, 
      template: {
        ...template,
        items: JSON.parse(template.items)
      }
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})

/**
 * POST /api/delivery-templates - Создать шаблон
 */
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { name, departmentId, items } = req.body
    const createdBy = req.user?.id || null
    
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Name and items array are required' })
    }
    
    const result = db.prepare(`
      INSERT INTO delivery_templates (name, department_id, items, created_by)
      VALUES (?, ?, ?, ?)
    `).run(name, departmentId || null, JSON.stringify(items), createdBy)
    
    res.status(201).json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: 'Template created' 
    })
  } catch (error) {
    console.error('Error creating template:', error)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

/**
 * PUT /api/delivery-templates/:id - Обновить шаблон
 */
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    const { name, departmentId, items } = req.body
    
    const existing = db.prepare('SELECT * FROM delivery_templates WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    db.prepare(`
      UPDATE delivery_templates
      SET name = COALESCE(?, name),
          department_id = ?,
          items = COALESCE(?, items),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, 
      departmentId !== undefined ? departmentId : existing.department_id,
      items ? JSON.stringify(items) : null,
      id
    )
    
    res.json({ success: true, message: 'Template updated' })
  } catch (error) {
    console.error('Error updating template:', error)
    res.status(500).json({ error: 'Failed to update template' })
  }
})

/**
 * DELETE /api/delivery-templates/:id - Удалить шаблон
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    
    const existing = db.prepare('SELECT * FROM delivery_templates WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    db.prepare('DELETE FROM delivery_templates WHERE id = ?').run(id)
    
    res.json({ success: true, message: 'Template deleted' })
  } catch (error) {
    console.error('Error deleting template:', error)
    res.status(500).json({ error: 'Failed to delete template' })
  }
})

/**
 * POST /api/delivery-templates/:id/apply - Применить шаблон (создать партии)
 */
router.post('/:id/apply', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id)
    const { items: customItems, departmentId } = req.body
    
    // Получаем шаблон
    const template = db.prepare('SELECT * FROM delivery_templates WHERE id = ?').get(id)
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    const templateItems = customItems || JSON.parse(template.items)
    const targetDepartment = departmentId || template.department_id
    
    if (!targetDepartment) {
      return res.status(400).json({ error: 'Department ID is required' })
    }
    
    // Создаём партии
    const insertStmt = db.prepare(`
      INSERT INTO products (name, department, category, quantity, expiry_date, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)
    
    const createdBatches = []
    const today = new Date()
    
    for (const item of templateItems) {
      const expiryDate = new Date(today)
      expiryDate.setDate(expiryDate.getDate() + (item.shelfLife || item.defaultShelfLife || 30))
      const expiryDateStr = expiryDate.toISOString().split('T')[0]
      
      const result = insertStmt.run(
        item.productName,
        targetDepartment,
        item.category || 'other',
        item.quantity || item.defaultQuantity || 1,
        item.expiryDate || expiryDateStr
      )
      
      createdBatches.push({
        id: result.lastInsertRowid,
        productName: item.productName,
        quantity: item.quantity || item.defaultQuantity,
        expiryDate: item.expiryDate || expiryDateStr
      })
    }
    
    // Записываем в audit log
    const userId = req.user?.id || null
    const userName = req.user?.name || req.user?.login || 'Unknown'
    logAction(userId, userName, 'create', template.name, 'template', `Применён шаблон "${template.name}": создано ${createdBatches.length} партий`, req.ip)
    
    res.status(201).json({ 
      success: true, 
      message: `Created ${createdBatches.length} batches`,
      batches: createdBatches
    })
  } catch (error) {
    console.error('Error applying template:', error)
    res.status(500).json({ error: 'Failed to apply template' })
  }
})

export default router
