/**
 * FreshTrack Products API
 * CRUD операции для продуктов
 */

import express from 'express'
import { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getExpiredProducts,
  getExpiringTodayProducts,
  getExpiringSoonProducts
} from '../db/database.js'

const router = express.Router()

/**
 * GET /api/products - Получить все продукты
 */
router.get('/', (req, res) => {
  try {
    const products = getAllProducts()
    
    // Преобразуем формат для совместимости с frontend
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      department: p.department,
      category: p.category,
      quantity: p.quantity,
      expiryDate: p.expiry_date // Frontend использует camelCase
    }))
    
    res.json(formattedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

/**
 * GET /api/products/:id - Получить продукт по ID
 */
router.get('/:id', (req, res) => {
  try {
    const product = getProductById(parseInt(req.params.id))
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    res.json({
      id: product.id,
      name: product.name,
      department: product.department,
      category: product.category,
      quantity: product.quantity,
      expiryDate: product.expiry_date
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

/**
 * POST /api/products - Создать новый продукт
 */
router.post('/', (req, res) => {
  try {
    const { name, department, category, quantity, expiryDate } = req.body
    
    // Валидация
    if (!name || !department || !category || !quantity || !expiryDate) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    
    const newProduct = createProduct({
      name,
      department,
      category,
      quantity: parseInt(quantity),
      expiry_date: expiryDate
    })
    
    res.status(201).json({
      id: newProduct.id,
      name: newProduct.name,
      department: newProduct.department,
      category: newProduct.category,
      quantity: newProduct.quantity,
      expiryDate: newProduct.expiry_date
    })
  } catch (error) {
    console.error('Error creating product:', error)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

/**
 * PUT /api/products/:id - Обновить продукт
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { name, department, category, quantity, expiryDate } = req.body
    
    const updated = updateProduct(id, {
      name,
      department,
      category,
      quantity: quantity ? parseInt(quantity) : undefined,
      expiry_date: expiryDate
    })
    
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    const product = getProductById(id)
    res.json({
      id: product.id,
      name: product.name,
      department: product.department,
      category: product.category,
      quantity: product.quantity,
      expiryDate: product.expiry_date
    })
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

/**
 * DELETE /api/products/:id - Удалить продукт
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const deleted = deleteProduct(id)
    
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' })
    }
    
    res.json({ success: true, message: 'Product deleted' })
  } catch (error) {
    console.error('Error deleting product:', error)
    res.status(500).json({ error: 'Failed to delete product' })
  }
})

/**
 * GET /api/products/status/expired - Получить просроченные продукты
 */
router.get('/status/expired', (req, res) => {
  try {
    const products = getExpiredProducts()
    res.json(products.map(p => ({
      id: p.id,
      name: p.name,
      department: p.department,
      category: p.category,
      quantity: p.quantity,
      expiryDate: p.expiry_date
    })))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expired products' })
  }
})

/**
 * GET /api/products/status/expiring-today - Получить истекающие сегодня
 */
router.get('/status/expiring-today', (req, res) => {
  try {
    const products = getExpiringTodayProducts()
    res.json(products.map(p => ({
      id: p.id,
      name: p.name,
      department: p.department,
      category: p.category,
      quantity: p.quantity,
      expiryDate: p.expiry_date
    })))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products expiring today' })
  }
})

/**
 * GET /api/products/status/expiring-soon - Получить истекающие скоро
 */
router.get('/status/expiring-soon', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3
    const products = getExpiringSoonProducts(days)
    res.json(products.map(p => ({
      id: p.id,
      name: p.name,
      department: p.department,
      category: p.category,
      quantity: p.quantity,
      expiryDate: p.expiry_date
    })))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products expiring soon' })
  }
})

export default router
