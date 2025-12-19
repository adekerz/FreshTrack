/**
 * FreshTrack Delivery Templates API
 * Шаблоны поставок для быстрого добавления товаров
 * Updated for multi-hotel architecture
 */

import express from 'express'
import { db, logAudit } from '../db/database.js'
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// Применяем middleware
router.use(authMiddleware)
router.use(hotelIsolation)

// Middleware to require hotel context (with auto-selection for SUPER_ADMIN)
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

/**
 * GET /api/delivery-templates - Получить все шаблоны
 */
router.get('/', (req, res) => {
  try {
    const hotelId = req.hotelId
    const { departmentId } = req.query
    
    let sql = `
      SELECT 
        id,
        name,
        department_id as departmentId,
        items,
        created_at as createdAt
      FROM delivery_templates
      WHERE hotel_id = ?
    `
    const params = [hotelId]
    
    if (departmentId) {
      sql += ' AND (department_id = ? OR department_id IS NULL)'
      params.push(departmentId)
    }
    
    sql += ' ORDER BY name ASC'
    
    const templates = db.prepare(sql).all(...params)
    
    res.json({ 
      success: true, 
      templates: templates.map(t => ({
        ...t,
        items: t.items ? JSON.parse(t.items) : []
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
    const hotelId = req.hotelId
    const { id } = req.params
    
    const template = db.prepare(`
      SELECT 
        id,
        name,
        department_id as departmentId,
        items,
        created_at as createdAt
      FROM delivery_templates
      WHERE id = ? AND hotel_id = ?
    `).get(id, hotelId)
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    res.json({ 
      success: true, 
      template: {
        ...template,
        items: template.items ? JSON.parse(template.items) : []
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
    const hotelId = req.hotelId
    const { name, departmentId, items } = req.body
    
    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Name and items array are required' })
    }
    
    const id = `tmpl_${Date.now()}`
    db.prepare(`
      INSERT INTO delivery_templates (id, hotel_id, department_id, name, items)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, hotelId, departmentId || null, name, JSON.stringify(items))
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'delivery_template',
      entity_id: id,
      details: { name },
      ip_address: req.ip
    })
    
    res.status(201).json({ 
      success: true, 
      id,
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
    const hotelId = req.hotelId
    const { id } = req.params
    const { name, departmentId, items } = req.body
    
    const existing = db.prepare('SELECT * FROM delivery_templates WHERE id = ? AND hotel_id = ?').get(id, hotelId)
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    db.prepare(`
      UPDATE delivery_templates
      SET name = COALESCE(?, name),
          department_id = ?,
          items = COALESCE(?, items),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND hotel_id = ?
    `).run(
      name, 
      departmentId !== undefined ? departmentId : existing.department_id,
      items ? JSON.stringify(items) : null,
      id,
      hotelId
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
    const hotelId = req.hotelId
    const { id } = req.params
    
    const existing = db.prepare('SELECT * FROM delivery_templates WHERE id = ? AND hotel_id = ?').get(id, hotelId)
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    db.prepare('DELETE FROM delivery_templates WHERE id = ? AND hotel_id = ?').run(id, hotelId)
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'delete',
      entity_type: 'delivery_template',
      entity_id: id,
      details: { name: existing.name },
      ip_address: req.ip
    })
    
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
    const hotelId = req.hotelId
    const { id } = req.params
    const { items: customItems, departmentId } = req.body
    
    // Получаем шаблон
    const template = db.prepare('SELECT * FROM delivery_templates WHERE id = ? AND hotel_id = ?').get(id, hotelId)
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    
    const templateItems = customItems || JSON.parse(template.items || '[]')
    const targetDepartment = departmentId || template.department_id
    
    if (!targetDepartment) {
      return res.status(400).json({ error: 'Department ID is required' })
    }
    
    // Создаём партии через batches
    const createdBatches = []
    const today = new Date()
    
    for (const item of templateItems) {
      const expiryDate = new Date(today)
      expiryDate.setDate(expiryDate.getDate() + (item.shelfLife || item.defaultShelfLife || 30))
      const expiryDateStr = expiryDate.toISOString().split('T')[0]
      
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Находим или создаём продукт
      let product = db.prepare(`
        SELECT id FROM products WHERE hotel_id = ? AND name = ?
      `).get(hotelId, item.productName)
      
      if (!product) {
        const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        db.prepare(`
          INSERT INTO products (id, hotel_id, category_id, name, unit)
          VALUES (?, ?, ?, ?, 'шт')
        `).run(productId, hotelId, item.category || null, item.productName)
        product = { id: productId }
      }
      
      db.prepare(`
        INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `).run(batchId, hotelId, targetDepartment, product.id, item.quantity || item.defaultQuantity || 1, item.expiryDate || expiryDateStr)
      
      createdBatches.push({
        id: batchId,
        productName: item.productName,
        quantity: item.quantity || item.defaultQuantity,
        expiryDate: item.expiryDate || expiryDateStr
      })
    }
    
    logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'apply',
      entity_type: 'delivery_template',
      entity_id: id,
      details: { name: template.name, batchesCreated: createdBatches.length },
      ip_address: req.ip
    })
    
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
