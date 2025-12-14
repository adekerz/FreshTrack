/**
 * FreshTrack Categories API
 * CRUD операции для категорий товаров
 */

import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { logAction } from './audit-logs.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

// Инициализация таблицы категорий
const ensureCategoriesTable = () => {
  try {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#FF8D6B',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Добавляем стандартные категории если таблица пуста
    const count = db.prepare('SELECT COUNT(*) as count FROM categories').get()
    if (count.count === 0) {
      const defaultCategories = [
        { name: 'Wine', color: '#722F37' },
        { name: 'Spirits', color: '#8B4513' },
        { name: 'Beverages', color: '#4169E1' },
        { name: 'Mixers', color: '#32CD32' },
        { name: 'snacks', color: '#FF8C00' }
      ]
      
      const insert = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
      for (const cat of defaultCategories) {
        try {
          insert.run(cat.name, cat.color)
        } catch (e) {
          // Игнорируем ошибки дубликатов
        }
      }
    }
  } catch (error) {
    console.log('Ошибка инициализации таблицы categories:', error.message)
  }
}

// Middleware для инициализации
router.use((req, res, next) => {
  ensureCategoriesTable()
  next()
})

/**
 * GET /api/categories - Получить все категории
 */
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all()
    res.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

/**
 * POST /api/categories - Создать категорию (только админ)
 */
router.post('/', adminMiddleware, (req, res) => {
  try {
    const { name, color = '#FF8D6B' } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' })
    }
    
    const db = getDb()
    const result = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name.trim(), color)
    
    // Логируем действие
    logAction(
      req.user.id, 
      req.user.name || req.user.login, 
      'create', 
      result.lastInsertRowid.toString(), 
      'category',
      `Создана категория: ${name}`,
      req.ip,
      {
        actionType: 'create',
        entityType: 'category',
        entityId: result.lastInsertRowid.toString(),
        entityName: name,
        newValue: { name, color }
      }
    )
    
    res.status(201).json({ 
      id: result.lastInsertRowid, 
      name: name.trim(), 
      color 
    })
  } catch (error) {
    console.error('Error creating category:', error)
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Category already exists' })
    }
    res.status(500).json({ error: 'Failed to create category' })
  }
})

/**
 * PUT /api/categories/:id - Обновить категорию (только админ)
 */
router.put('/:id', adminMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { name, color } = req.body
    
    const db = getDb()
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' })
    }
    
    const updateName = name?.trim() || existing.name
    const updateColor = color || existing.color
    
    db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(updateName, updateColor, id)
    
    // Логируем действие
    logAction(
      req.user.id,
      req.user.name || req.user.login,
      'update',
      id,
      'category',
      `Обновлена категория: ${updateName}`,
      req.ip,
      {
        actionType: 'update',
        entityType: 'category',
        entityId: id,
        entityName: updateName,
        oldValue: existing,
        newValue: { name: updateName, color: updateColor }
      }
    )
    
    res.json({ id: parseInt(id), name: updateName, color: updateColor })
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({ error: 'Failed to update category' })
  }
})

/**
 * DELETE /api/categories/:id - Удалить категорию (только админ)
 */
router.delete('/:id', adminMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const db = getDb()
    
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    
    // Логируем действие
    logAction(
      req.user.id,
      req.user.name || req.user.login,
      'delete',
      id,
      'category',
      `Удалена категория: ${category.name}`,
      req.ip,
      {
        actionType: 'delete',
        entityType: 'category',
        entityId: id,
        entityName: category.name,
        oldValue: category
      }
    )
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

export default router
