/**
 * FreshTrack Categories API
 * Category management with hotel isolation
 */

import express from 'express'
import { 
  getAllCategories, 
  getCategoryById, 
  createCategory, 
  updateCategory,
  deleteCategory,
  logAudit,
  db
} from '../db/database.js'
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

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

/**
 * GET /api/categories - Get all categories with hotel isolation
 */
router.get('/', authMiddleware, hotelIsolation, requireHotelContext, (req, res) => {
  try {
    const categories = getAllCategories(req.hotelId)
    
    res.json({ 
      success: true,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        nameEn: c.name_en,
        nameKk: c.name_kk,
        color: c.color,
        icon: c.icon,
        sortOrder: c.sort_order,
        hotelId: c.hotel_id,
        isActive: Boolean(c.is_active)
      }))
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

/**
 * GET /api/categories/:id - Get category by ID
 */
router.get('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const category = getCategoryById(id)
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    
    // Check hotel access
    if (req.hotelId && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this category' })
    }
    
    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        nameEn: category.name_en,
        nameKk: category.name_kk,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sort_order,
        hotelId: category.hotel_id,
        isActive: Boolean(category.is_active)
      }
    })
  } catch (error) {
    console.error('Error fetching category:', error)
    res.status(500).json({ error: 'Failed to fetch category' })
  }
})

/**
 * POST /api/categories - Create category
 * HOTEL_ADMIN or higher
 */
router.post('/', authMiddleware, hotelAdminOnly, hotelIsolation, requireHotelContext, (req, res) => {
  try {
    const { name, nameEn, nameKk, color, icon, sortOrder } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' })
    }
    
    if (!req.hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required' })
    }
    
    const category = createCategory({
      hotel_id: req.hotelId,
      name: name.trim(),
      name_en: nameEn || name.trim(),
      name_kk: nameKk || name.trim(),
      color: color || '#6B6560',
      icon: icon || null,
      sort_order: sortOrder || 0
    })
    
    // Log action
    logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'category',
      entity_id: category.id,
      details: { name },
      ip_address: req.ip
    })
    
    res.status(201).json({ 
      success: true,
      category: {
        id: category.id,
        name: category.name,
        nameEn: category.name_en,
        nameKk: category.name_kk,
        color: category.color,
        icon: category.icon,
        sortOrder: category.sort_order,
        hotelId: category.hotel_id
      }
    })
  } catch (error) {
    console.error('Error creating category:', error)
    res.status(500).json({ error: 'Failed to create category' })
  }
})

/**
 * PUT /api/categories/:id - Update category
 * HOTEL_ADMIN or higher
 */
router.put('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const { name, nameEn, nameKk, color, icon, sortOrder, isActive } = req.body
    
    const category = getCategoryById(id)
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    
    // Check hotel access
    if (req.hotelId && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this category' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (nameEn !== undefined) updates.name_en = nameEn
    if (nameKk !== undefined) updates.name_kk = nameKk
    if (color !== undefined) updates.color = color
    if (icon !== undefined) updates.icon = icon
    if (sortOrder !== undefined) updates.sort_order = sortOrder
    if (isActive !== undefined) updates.is_active = isActive ? 1 : 0
    
    const success = updateCategory(id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: category.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'category',
        entity_id: id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({ error: 'Failed to update category' })
  }
})

/**
 * DELETE /api/categories/:id - Delete (deactivate) category
 * HOTEL_ADMIN or higher
 */
router.delete('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    
    const category = getCategoryById(id)
    if (!category) {
      return res.status(404).json({ error: 'Category not found' })
    }
    
    // Check hotel access
    if (req.hotelId && category.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this category' })
    }
    
    const success = deleteCategory(id)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: category.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'delete',
        entity_type: 'category',
        entity_id: id,
        details: { name: category.name },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

export default router
