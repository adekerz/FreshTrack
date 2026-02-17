/**
 * Inventory Controller
 *
 * HTTP обработчики для inventory endpoints (batches, products, categories).
 * SQL-запросы вынесены в inventory.repository.js.
 */

import { Router } from 'express'
import {
  CreateBatchSchema,
  UpdateBatchSchema,
  CreateProductSchema,
  UpdateProductSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateCollectionSchema,
  QuickCollectSchema,
  BatchFiltersSchema,
  ProductFiltersSchema,
  validate
} from './inventory.schemas.js'
import {
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { StatisticsService } from '../../services/StatisticsService.js'
import { enrichBatchesWithExpiryData } from '../../services/ExpiryService.js'
import { isSuperAdmin } from '../../utils/constants.js'
import * as repo from './inventory.repository.js'
import { logError } from '../../utils/logger.js'

const router = Router()

// ========================================
// Batches
// ========================================

/**
 * GET /api/batches/stats
 */
router.get('/batches/stats',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  async (req, res) => {
    try {
      // ✅ Используем req.hotelId и req.departmentId из middleware
      const hotelId = req.hotelId

      if (!hotelId) {
        return res.json({
          success: true,
          stats: {
            byStatus: [], byCategory: [], trends: [],
            total: 0, expired: 0, critical: 0, warning: 0, good: 0,
            needsAttention: 0, totalBatches: 0, totalProducts: 0,
            totalCategories: 0, healthScore: 100
          }
        })
      }

      const context = {
        hotelId,
        departmentId: req.canAccessAllDepartments
          ? (req.query.departmentId || null)
          : req.departmentId,
        canAccessAllDepartments: req.canAccessAllDepartments
      }

      const options = {
        locale: req.query.locale || 'ru',
        trendDays: parseInt(req.query.trendDays) || 30
      }

      if (req.query.dateFrom || req.query.dateTo) {
        options.dateRange = { from: req.query.dateFrom, to: req.query.dateTo }
      }

      const stats = await StatisticsService.getStatistics(context, options)

      const getStatusCount = (status) => {
        const item = stats.byStatus?.find(s => s.status === status)
        return item?.count || 0
      }

      const expired = getStatusCount('expired')
      const critical = getStatusCount('critical')
      const warning = getStatusCount('warning')
      const good = getStatusCount('good')
      const today = getStatusCount('today')
      const total = stats.total?.batches || 0

      res.json({
        success: true,
        stats: {
          ...stats,
          total, expired, critical, warning, good,
          needsAttention: expired + critical + warning + today,
          totalBatches: total,
          totalProducts: stats.total?.products || 0,
          totalCategories: stats.total?.categories || 0,
          healthScore: stats.total?.healthScore || 100
        }
      })

    } catch (error) {
      logError('Inventory', error, { action: 'getBatchesStats' })
      res.status(500).json({ error: 'Ошибка получения статистики' })
    }
  })

/**
 * GET /api/batches
 */
router.get('/batches',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.READ),
  async (req, res) => {
    try {
      const validation = validate(BatchFiltersSchema, req.query)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      // ✅ Используем req.hotelId из hotelIsolation middleware
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const filters = validation.data
      const { page, limit } = filters
      const { rows, total } = await repo.findBatches(hotelId, filters)

      const enrichedBatches = await enrichBatchesWithExpiryData(rows, { hotelId })

      res.json({
        success: true,
        batches: enrichedBatches,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: ((page - 1) * limit) + rows.length < total
      })

    } catch (error) {
      logError('Inventory', error, { action: 'getBatches' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * POST /api/batches
 */
router.post('/batches',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.CREATE),
  async (req, res) => {
    try {
      // ✅ Используем req.hotelId из middleware
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(CreateBatchSchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const data = validation.data
      const departmentId = data.departmentId || data.department || req.user.department_id

      if (!departmentId) {
        return res.status(400).json({ error: 'Необходимо указать отдел (departmentId)' })
      }

      let productId = data.productId

      // Если указан productName вместо productId — ищем или создаём продукт
      if (!productId && data.productName) {
        const existing = await repo.findProductByName(data.productName, hotelId)

        if (existing) {
          productId = existing.id
        } else {
          let categoryId = data.categoryId || null
          if (!categoryId && data.category) {
            const cat = await repo.findCategoryByName(data.category, hotelId)
            if (cat) categoryId = cat.id
          }

          const newProduct = await repo.createProductInline(hotelId, departmentId, categoryId, data.productName)
          productId = newProduct.id
        }
      }

      if (!productId) {
        return res.status(400).json({ error: 'Не удалось определить продукт' })
      }

      const productOwner = await repo.findProductOwnership(productId, hotelId)
      if (!productOwner) {
        return res.status(404).json({ error: 'Продукт не найден' })
      }

      // ✅ Используем ExpiryService для расчёта статуса (бизнес-логика в service, не в controller)
      const { getEnrichedExpiryData } = await import('../../services/ExpiryService.js')
      const expiryData = await getEnrichedExpiryData(data.expiryDate, { hotelId })

      // Map ExpiryService status to batch status field
      let status = 'active'
      if (expiryData.status === 'expired') status = 'expired'
      else if (['critical', 'today'].includes(expiryData.status)) status = 'expiring'

      // Always create a new batch (don't merge with existing batches with same expiry date)
      const result = await repo.createBatch({
        hotelId,
        departmentId,
        productId,
        quantity: data.quantity || 1,
        expiryDate: data.expiryDate,
        batchNumber: data.batchNumber || null,
        status,
        addedBy: req.user.id
      })

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'create',
        entity_type: 'batch',
        entity_id: result.id,
        details: { productId, quantity: data.quantity }
      })

      res.status(201).json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'createBatch' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * PUT /api/batches/:id
 */
router.put('/batches/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const batchId = req.params.id
      // ✅ Используем req.hotelId из middleware
      const hotelId = req.hotelId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(batchId)) {
        return res.status(400).json({ error: 'Неверный ID партии' })
      }
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(UpdateBatchSchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const existing = await repo.findBatchById(batchId, hotelId)
      if (!existing) {
        return res.status(404).json({ error: 'Партия не найдена' })
      }

      const data = validation.data
      const result = await repo.updateBatch(batchId, hotelId, data)

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'update',
        entity_type: 'batch',
        entity_id: batchId,
        details: { changes: Object.keys(data) }
      })

      res.json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'updateBatch' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * POST /api/batches/:id/collect
 */
router.post('/batches/:id/collect',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const batchId = req.params.id
      // ✅ Используем req.hotelId из middleware
      const hotelId = req.hotelId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(batchId)) {
        return res.status(400).json({ error: 'Неверный ID партии' })
      }
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(QuickCollectSchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const { quantity, type, reason } = validation.data

      const batch = await repo.findBatchById(batchId, hotelId)
      if (!batch) {
        return res.status(404).json({ error: 'Партия не найдена' })
      }

      if (batch.quantity < quantity) {
        return res.status(400).json({
          error: `Недостаточно количества. Доступно: ${batch.quantity}`
        })
      }

      const updated = await repo.collectBatch(batchId, {
        quantity,
        type,
        reason,
        userId: req.user.id,
        currentQuantity: batch.quantity,
        currentStatus: batch.status
      })

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'collect',
        entity_type: 'batch',
        entity_id: batchId,
        details: { quantity, type, reason }
      })

      res.json({ message: 'Сбор выполнен', batch: updated })

    } catch (error) {
      logError('Inventory', error, { action: 'collectBatch' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * DELETE /api/batches/clear-all
 * SUPER ADMIN ONLY — очистить все активные партии по отелю (и опционально по отделу)
 */
router.delete('/batches/clear-all', authMiddleware, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Only super admin can clear all batches' })
    }

    const hotelId = req.hotelId || req.query.hotel_id || req.query.hotelId
    if (!hotelId) {
      return res.status(400).json({ error: 'Hotel ID is required' })
    }

    // Обязательный параметр — очистка только в пределах отдела, не всего отеля
    const departmentId = req.query.department_id || req.query.departmentId || null
    if (!departmentId) {
      return res.status(400).json({ error: 'Department ID is required. Clearing entire hotel is not allowed.' })
    }

    const deleted = await repo.clearAllActiveBatches(hotelId, departmentId)

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'delete',
      entity_type: 'batch',
      entity_id: null,
      details: {
        action: 'clear_all_batches',
        deleted: deleted.length,
        department_id: departmentId
      }
    })

    res.json({ success: true, deleted: deleted.length, message: `Deleted ${deleted.length} batches` })

  } catch (error) {
    logError('Inventory', error, { action: 'clearAllBatches' })
    res.status(500).json({ error: 'Failed to clear batches' })
  }
})

/**
 * DELETE /api/batches/:id
 */
router.delete('/batches/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.DELETE),
  async (req, res) => {
    try {
      const batchId = req.params.id
      // ✅ Используем req.hotelId из middleware
      const hotelId = req.hotelId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(batchId)) {
        return res.status(400).json({ error: 'Неверный ID партии' })
      }
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const deleted = await repo.deleteBatch(batchId, hotelId)
      if (!deleted) {
        return res.status(404).json({ error: 'Партия не найдена' })
      }

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'delete',
        entity_type: 'batch',
        entity_id: batchId,
        details: {}
      })

      res.json({ message: 'Партия удалена' })

    } catch (error) {
      logError('Inventory', error, { action: 'deleteBatch' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

// ========================================
// Products
// ========================================

/**
 * GET /api/products/catalog
 */
router.get('/products/catalog',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  async (req, res) => {
    try {
      // ✅ Используем req.hotelId из middleware
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const products = await repo.findProductsCatalog(hotelId)
      res.json({ success: true, products })

    } catch (error) {
      logError('Inventory', error, { action: 'getProductsCatalog' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * GET /api/products/status/expired
 */
router.get('/products/status/expired',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  async (req, res) => {
    try {
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const items = await repo.findExpiredBatches(hotelId)
      res.json({ success: true, items, count: items.length })

    } catch (error) {
      logError('Inventory', error, { action: 'getExpiredProducts' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * GET /api/products/status/expiring-soon
 */
router.get('/products/status/expiring-soon',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  async (req, res) => {
    try {
      const hotelId = req.hotelId
      const days = parseInt(req.query.days) || 7
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const items = await repo.findExpiringSoonBatches(hotelId, days)
      res.json({ success: true, items, count: items.length, days })

    } catch (error) {
      logError('Inventory', error, { action: 'getExpiringSoon' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * GET /api/products
 */
router.get('/products',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.PRODUCTS, PermissionAction.READ),
  async (req, res) => {
    try {
      const validation = validate(ProductFiltersSchema, req.query)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const filters = validation.data
      const { page, limit } = filters
      const { rows, total } = await repo.findProducts(hotelId, filters)

      res.json({
        success: true,
        items: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: ((page - 1) * limit) + rows.length < total
      })

    } catch (error) {
      logError('Inventory', error, { action: 'getProducts' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * POST /api/products
 */
router.post('/products',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.PRODUCTS, PermissionAction.CREATE),
  async (req, res) => {
    try {
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(CreateProductSchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const data = validation.data
      data.departmentId = data.departmentId || req.user.departmentId || null

      const result = await repo.createProduct(hotelId, data)

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'create',
        entity_type: 'product',
        entity_id: result.id,
        details: { name: data.name }
      })

      res.status(201).json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'createProduct' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * PUT /api/products/:id
 */
router.put('/products/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.PRODUCTS, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const productId = req.params.id
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(UpdateProductSchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const existing = await repo.findProductById(productId, hotelId)
      if (!existing) {
        return res.status(404).json({ error: 'Продукт не найден' })
      }

      const data = validation.data
      const result = await repo.updateProduct(productId, hotelId, data)

      if (!result) {
        return res.status(400).json({ error: 'Нет данных для обновления' })
      }

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'update',
        entity_type: 'product',
        entity_id: productId,
        details: { changes: Object.keys(data) }
      })

      res.json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'updateProduct' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * DELETE /api/products/:id
 */
router.delete('/products/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.PRODUCTS, PermissionAction.DELETE),
  async (req, res) => {
    try {
      const productId = req.params.id
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const result = await repo.deleteProduct(productId, hotelId)
      if (!result) {
        return res.status(404).json({ error: 'Продукт не найден' })
      }

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'delete',
        entity_type: 'product',
        entity_id: productId,
        details: { name: result.name }
      })

      res.json({ success: true, id: productId })

    } catch (error) {
      logError('Inventory', error, { action: 'deleteProduct' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

// ========================================
// Categories
// ========================================

/**
 * GET /api/categories
 */
router.get('/categories',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  async (req, res) => {
    try {
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'hotel_id is required' })
      }

      const categories = await repo.findCategories(hotelId)
      res.json(categories)

    } catch (error) {
      logError('Inventory', error, { action: 'getCategories' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * POST /api/categories
 */
router.post('/categories',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.CATEGORIES, PermissionAction.CREATE),
  async (req, res) => {
    try {
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(CreateCategorySchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const data = validation.data

      const exists = await repo.checkCategoryNameExists(data.name, hotelId)
      if (exists) {
        return res.status(400).json({ error: 'Категория с таким именем уже существует' })
      }

      const result = await repo.createCategory(hotelId, data)

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'create',
        entity_type: 'category',
        entity_id: result.id,
        details: { name: data.name }
      })

      res.status(201).json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'createCategory' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * PUT /api/categories/:id
 */
router.put('/categories/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.CATEGORIES, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const categoryId = req.params.id
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const validation = validate(UpdateCategorySchema, req.body)
      if (!validation.isValid) {
        return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const existing = await repo.findCategoryById(categoryId, hotelId)
      if (!existing) {
        return res.status(404).json({ error: 'Категория не найдена' })
      }

      const data = validation.data

      if (data.name !== undefined) {
        const duplicate = await repo.checkCategoryNameExists(data.name, hotelId, categoryId)
        if (duplicate) {
          return res.status(400).json({ error: 'Категория с таким именем уже существует' })
        }
      }

      const result = await repo.updateCategory(categoryId, hotelId, data)
      if (!result) {
        return res.status(400).json({ error: 'Нет данных для обновления' })
      }

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'update',
        entity_type: 'category',
        entity_id: categoryId,
        details: { changes: Object.keys(data) }
      })

      res.json(result)

    } catch (error) {
      logError('Inventory', error, { action: 'updateCategory' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

/**
 * DELETE /api/categories/:id
 */
router.delete('/categories/:id',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.CATEGORIES, PermissionAction.DELETE),
  async (req, res) => {
    try {
      const categoryId = req.params.id
      const hotelId = req.hotelId
      if (!hotelId) {
        return res.status(400).json({ error: 'Не указан отель' })
      }

      const existing = await repo.findCategoryById(categoryId, hotelId)
      if (!existing) {
        return res.status(404).json({ error: 'Категория не найдена' })
      }

      const categoryName = existing.name

      const productCount = await repo.countProductsInCategory(categoryId)
      if (productCount > 0) {
        await repo.clearCategoryFromProducts(categoryId)
      }

      await repo.deleteCategory(categoryId, hotelId)

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'delete',
        entity_type: 'category',
        entity_id: categoryId,
        details: { name: categoryName }
      })

      res.json({ message: 'Категория удалена' })

    } catch (error) {
      logError('Inventory', error, { action: 'deleteCategory' })
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  })

export default router
