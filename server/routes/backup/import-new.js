/**
 * FreshTrack Import API - PostgreSQL Async Version
 */

import express from 'express'
import {
  createProduct,
  createBatch,
  createCategory,
  getAllCategories,
  getAllProducts,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// POST /api/import/products
router.post('/products', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { products, options = {} } = req.body
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'Products array is required' })
    }
    
    const { skip_duplicates = true, create_categories = false } = options
    const results = { imported: 0, skipped: 0, errors: [] }
    
    // Get existing products for duplicate check
    const existingProducts = await getAllProducts(req.hotelId, {})
    const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()))
    const existingSKUs = new Set(existingProducts.filter(p => p.sku).map(p => p.sku))
    
    // Get categories for matching
    const categories = await getAllCategories(req.hotelId, {})
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    
    for (const productData of products) {
      try {
        // Check for duplicates
        if (skip_duplicates) {
          if (existingNames.has(productData.name?.toLowerCase())) {
            results.skipped++
            continue
          }
          if (productData.sku && existingSKUs.has(productData.sku)) {
            results.skipped++
            continue
          }
        }
        
        // Handle category
        let categoryId = productData.category_id
        if (!categoryId && productData.category_name) {
          categoryId = categoryMap.get(productData.category_name.toLowerCase())
          if (!categoryId && create_categories) {
            const newCategory = await createCategory({
              hotel_id: req.hotelId,
              name: productData.category_name,
              department_id: productData.department_id || req.departmentId
            })
            categoryId = newCategory.id
            categoryMap.set(productData.category_name.toLowerCase(), categoryId)
          }
        }
        
        // Create product
        await createProduct({
          hotel_id: req.hotelId,
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          barcode: productData.barcode,
          category_id: categoryId,
          department_id: productData.department_id || req.departmentId,
          unit: productData.unit || 'шт',
          min_quantity: productData.min_quantity,
          max_quantity: productData.max_quantity,
          reorder_point: productData.reorder_point,
          storage_location: productData.storage_location,
          storage_conditions: productData.storage_conditions,
          default_expiry_days: productData.default_expiry_days,
          notes: productData.notes
        })
        
        results.imported++
        existingNames.add(productData.name.toLowerCase())
        if (productData.sku) existingSKUs.add(productData.sku)
        
      } catch (err) {
        results.errors.push({ product: productData.name, error: err.message })
      }
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'import', entity_type: 'product', entity_id: null,
      details: { total: products.length, imported: results.imported, skipped: results.skipped },
      ip_address: req.ip
    })
    
    res.json({ success: true, results })
  } catch (error) {
    console.error('Import products error:', error)
    res.status(500).json({ success: false, error: 'Failed to import products' })
  }
})

// POST /api/import/batches
router.post('/batches', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { batches } = req.body
    
    if (!batches || !Array.isArray(batches) || batches.length === 0) {
      return res.status(400).json({ success: false, error: 'Batches array is required' })
    }
    
    const results = { imported: 0, errors: [] }
    
    // Get existing products for matching
    const products = await getAllProducts(req.hotelId, {})
    const productMap = new Map()
    products.forEach(p => {
      productMap.set(p.id, p)
      if (p.sku) productMap.set(`sku:${p.sku}`, p)
      productMap.set(`name:${p.name.toLowerCase()}`, p)
    })
    
    for (const batchData of batches) {
      try {
        // Find product
        let product = null
        if (batchData.product_id) {
          product = productMap.get(batchData.product_id)
        } else if (batchData.product_sku) {
          product = productMap.get(`sku:${batchData.product_sku}`)
        } else if (batchData.product_name) {
          product = productMap.get(`name:${batchData.product_name.toLowerCase()}`)
        }
        
        if (!product) {
          results.errors.push({ batch: batchData, error: 'Product not found' })
          continue
        }
        
        await createBatch({
          product_id: product.id,
          quantity: parseFloat(batchData.quantity),
          production_date: batchData.production_date,
          expiry_date: batchData.expiry_date,
          supplier: batchData.supplier,
          batch_code: batchData.batch_code,
          notes: batchData.notes
        })
        
        results.imported++
        
      } catch (err) {
        results.errors.push({ batch: batchData, error: err.message })
      }
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'import', entity_type: 'batch', entity_id: null,
      details: { total: batches.length, imported: results.imported }, ip_address: req.ip
    })
    
    res.json({ success: true, results })
  } catch (error) {
    console.error('Import batches error:', error)
    res.status(500).json({ success: false, error: 'Failed to import batches' })
  }
})

export default router
