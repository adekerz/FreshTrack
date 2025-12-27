/**
 * FreshTrack Products API
 * Product catalog management with hotel isolation
 */

import express from 'express'
import { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getAllCategories,
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
 * GET /api/products - Get all products with hotel isolation
 */
router.get('/', authMiddleware, hotelIsolation, requireHotelContext, (req, res) => {
  try {
    const products = getAllProducts(req.hotelId)
    
    res.json(products.map(p => ({
      id: p.id,
      name: p.name,
      nameEn: p.name_en,
      nameKk: p.name_kk,
      categoryId: p.category_id,
      categoryName: p.category_name,
      barcode: p.barcode,
      defaultShelfLife: p.default_shelf_life,
      unit: p.unit,
      hotelId: p.hotel_id,
      isActive: Boolean(p.is_active)
    })))
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

/**
 * GET /api/products/catalog - Get product catalog grouped by category
 */
router.get('/catalog', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const products = getAllProducts(req.hotelId)
    const categories = getAllCategories(req.hotelId)
    
    // Group products by category
    const catalog = {}
    categories.forEach(cat => {
      catalog[cat.id] = {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        products: []
      }
    })
    
    products.forEach(p => {
      if (p.category_id && catalog[p.category_id]) {
        catalog[p.category_id].products.push({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          defaultShelfLife: p.default_shelf_life,
          unit: p.unit
        })
      }
    })
    
    res.json({ 
      success: true,
      products,
      catalog: Object.values(catalog)
    })
  } catch (error) {
    console.error('Error fetching product catalog:', error)
    res.status(500).json({ error: 'Failed to fetch product catalog' })
  }
})

/**
 * GET /api/products/:id - Get product by ID
 */
router.get('/:id', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const product = getProductById(id)
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    // Check hotel access
    if (req.hotelId && product.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this product' })
    }
    
    res.json({
      id: product.id,
      name: product.name,
      nameEn: product.name_en,
      nameKk: product.name_kk,
      categoryId: product.category_id,
      barcode: product.barcode,
      defaultShelfLife: product.default_shelf_life,
      unit: product.unit,
      hotelId: product.hotel_id,
      isActive: Boolean(product.is_active)
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

/**
 * POST /api/products - Create product
 * Any authenticated user can create products for their hotel
 */
router.post('/', authMiddleware, hotelIsolation, requireHotelContext, (req, res) => {
  try {
    const { name, nameEn, nameKk, categoryId, barcode, defaultShelfLife, unit } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' })
    }
    
    if (!req.hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required' })
    }
    
    const product = createProduct({
      hotel_id: req.hotelId,
      category_id: categoryId,
      name: name.trim(),
      name_en: nameEn || name.trim(),
      name_kk: nameKk || name.trim(),
      barcode,
      default_shelf_life: defaultShelfLife || 30,
      unit: unit || 'pcs'
    })
    
    // Log action
    logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'product',
      entity_id: product.id,
      details: { name },
      ip_address: req.ip
    })
    
    res.status(201).json({ 
      success: true,
      product: {
        id: product.id,
        name: product.name,
        nameEn: product.name_en,
        nameKk: product.name_kk,
        categoryId: product.category_id,
        barcode: product.barcode,
        defaultShelfLife: product.default_shelf_life,
        unit: product.unit,
        hotelId: product.hotel_id
      }
    })
  } catch (error) {
    console.error('Error creating product:', error)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

/**
 * PUT /api/products/:id - Update product
 * HOTEL_ADMIN or higher
 */
router.put('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    const { name, nameEn, nameKk, categoryId, barcode, defaultShelfLife, unit, isActive } = req.body
    
    const product = getProductById(id)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    // Check hotel access
    if (req.hotelId && product.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this product' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name.trim()
    if (nameEn !== undefined) updates.name_en = nameEn
    if (nameKk !== undefined) updates.name_kk = nameKk
    if (categoryId !== undefined) updates.category_id = categoryId
    if (barcode !== undefined) updates.barcode = barcode
    if (defaultShelfLife !== undefined) updates.default_shelf_life = defaultShelfLife
    if (unit !== undefined) updates.unit = unit
    if (isActive !== undefined) updates.is_active = isActive ? 1 : 0
    
    const success = updateProduct(id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: product.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'product',
        entity_id: id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

/**
 * DELETE /api/products/:id - Delete (deactivate) product
 * HOTEL_ADMIN or higher
 */
router.delete('/:id', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { id } = req.params
    
    const product = getProductById(id)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    // Check hotel access
    if (req.hotelId && product.hotel_id !== req.hotelId) {
      return res.status(403).json({ error: 'Access denied to this product' })
    }
    
    const success = deleteProduct(id)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: product.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'delete',
        entity_type: 'product',
        entity_id: id,
        details: { name: product.name },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ error: 'Failed to delete product' })
  }
})

export default router
