/**
 * FreshTrack Departments API
 * CRUD операции для отделов
 */

import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/departments - Получить все отделы (публичный)
 */
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const departments = db.prepare(`
      SELECT 
        id,
        name,
        name_en as nameEn,
        name_kk as nameKk,
        color,
        icon,
        sort_order as sortOrder,
        is_active as isActive,
        created_at as createdAt
      FROM departments
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC
    `).all()
    
    res.json(departments.map(d => ({
      ...d,
      isActive: Boolean(d.isActive)
    })))
  } catch (error) {
    console.error('Error fetching departments:', error)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

/**
 * GET /api/departments/all - Получить все отделы включая неактивные (требует авторизации)
 */
router.get('/all', authMiddleware, (req, res) => {
  try {
    const db = getDb()
    const departments = db.prepare(`
      SELECT 
        id,
        name,
        name_en as nameEn,
        name_kk as nameKk,
        color,
        icon,
        sort_order as sortOrder,
        is_active as isActive,
        created_at as createdAt
      FROM departments
      ORDER BY sort_order ASC, name ASC
    `).all()
    
    res.json(departments.map(d => ({
      ...d,
      isActive: Boolean(d.isActive)
    })))
  } catch (error) {
    console.error('Error fetching all departments:', error)
    res.status(500).json({ error: 'Failed to fetch departments' })
  }
})

/**
 * GET /api/departments/:id - Получить отдел по ID
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    
    const department = db.prepare(`
      SELECT 
        id,
        name,
        name_en as nameEn,
        name_kk as nameKk,
        color,
        icon,
        sort_order as sortOrder,
        is_active as isActive,
        created_at as createdAt
      FROM departments
      WHERE id = ?
    `).get(id)
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    res.json({
      ...department,
      isActive: Boolean(department.isActive)
    })
  } catch (error) {
    console.error('Error fetching department:', error)
    res.status(500).json({ error: 'Failed to fetch department' })
  }
})

/**
 * POST /api/departments - Создать отдел
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = getDb()
    const { id, name, nameEn, nameKk, color, icon, sortOrder } = req.body
    
    // Проверяем права (только админ)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create departments' })
    }
    
    if (!id || !name) {
      return res.status(400).json({ error: 'ID and name are required' })
    }
    
    // Проверяем, не существует ли отдел с таким ID
    const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(id)
    if (existing) {
      return res.status(409).json({ error: 'Department with this ID already exists' })
    }
    
    db.prepare(`
      INSERT INTO departments (id, name, name_en, name_kk, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      nameEn || name,
      nameKk || name,
      color || '#FF8D6B',
      icon || 'package',
      sortOrder || 0
    )
    
    res.status(201).json({ 
      success: true, 
      id,
      message: 'Department created' 
    })
  } catch (error) {
    console.error('Error creating department:', error)
    res.status(500).json({ error: 'Failed to create department' })
  }
})

/**
 * PUT /api/departments/:id - Обновить отдел
 */
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    const { name, nameEn, nameKk, color, icon, sortOrder, isActive } = req.body
    
    // Проверяем права (только админ)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update departments' })
    }
    
    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    db.prepare(`
      UPDATE departments
      SET 
        name = COALESCE(?, name),
        name_en = COALESCE(?, name_en),
        name_kk = COALESCE(?, name_kk),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name,
      nameEn,
      nameKk,
      color,
      icon,
      sortOrder,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    )
    
    res.json({ success: true, message: 'Department updated' })
  } catch (error) {
    console.error('Error updating department:', error)
    res.status(500).json({ error: 'Failed to update department' })
  }
})

/**
 * DELETE /api/departments/:id - Удалить отдел (soft delete)
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = getDb()
    const { id } = req.params
    
    // Проверяем права (только админ)
    const userRole = req.user?.role?.toLowerCase()?.replace('istrator', '') || ''
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete departments' })
    }
    
    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' })
    }
    
    // Мягкое удаление - просто деактивируем
    db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(id)
    
    res.json({ success: true, message: 'Department deactivated' })
  } catch (error) {
    console.error('Error deleting department:', error)
    res.status(500).json({ error: 'Failed to delete department' })
  }
})

export default router
