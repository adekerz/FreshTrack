/**
 * Inventory Controller
 * 
 * HTTP обработчики для inventory endpoints (batches, products, categories).
 * Использует Zod схемы для валидации.
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
import { authMiddleware, requirePermission } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { query as dbQuery } from '../../db/postgres.js'
import { StatisticsService } from '../../services/StatisticsService.js'
import { enrichBatchesWithExpiryData } from '../../services/ExpiryService.js'
import { isSuperAdmin, canAccessAllDepartments as checkCanAccessAllDepartments } from '../../utils/constants.js'

const router = Router()

// ========================================
// Helper: Get effective hotel ID
// ========================================

/**
 * Получить эффективный hotel_id
 * Для SUPER_ADMIN берём из query параметров или body, иначе из пользователя
 */
function getEffectiveHotelId(req) {
  // Query params (hotel_id или hotelId)
  const queryHotelId = req.query.hotel_id || req.query.hotelId

  // Body params (для POST/PUT запросов)
  const bodyHotelId = req.body?.hotel_id || req.body?.hotelId

  // Для SUPER_ADMIN используем query/body param если указан
  if (isSuperAdmin(req.user)) {
    const externalHotelId = queryHotelId || bodyHotelId
    if (externalHotelId) {
      return externalHotelId
    }
  }

  // Иначе используем hotel_id пользователя
  return req.user.hotelId || req.user.hotel_id || queryHotelId || bodyHotelId
}

// ========================================
// Batches
// ========================================

/**
 * GET /api/batches/stats
 * Получить статистику по партиям (для Dashboard)
 * Возвращает: total, byStatus, byCategory, trends
 */
router.get('/batches/stats', authMiddleware, async (req, res) => {
  try {
    // SUPER_ADMIN может не иметь hotel_id, берём из query params
    let hotelId = getEffectiveHotelId(req)

    // Если всё ещё нет hotelId, получаем первый активный отель для SUPER_ADMIN
    if (!hotelId && isSuperAdmin(req.user)) {
      const result = await dbQuery('SELECT id FROM hotels WHERE is_active = TRUE LIMIT 1')
      if (result.rows.length > 0) {
        hotelId = result.rows[0].id
      }
    }

    if (!hotelId) {
      return res.json({
        success: true,
        stats: {
          byStatus: [],
          byCategory: [],
          trends: [],
          total: 0,
          expired: 0,
          critical: 0,
          warning: 0,
          good: 0,
          needsAttention: 0,
          totalBatches: 0,
          totalProducts: 0,
          totalCategories: 0,
          healthScore: 100
        }
      })
    }

    const context = {
      hotelId,
      departmentId: req.user.department_id,
      canAccessAllDepartments: checkCanAccessAllDepartments(req.user)
    }

    const options = {
      locale: req.query.locale || 'ru',
      trendDays: parseInt(req.query.trendDays) || 30
    }

    if (req.query.dateFrom || req.query.dateTo) {
      options.dateRange = {
        from: req.query.dateFrom,
        to: req.query.dateTo
      }
    }

    const stats = await StatisticsService.getStatistics(context, options)

    // Extract counts from byStatus for legacy compatibility
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

    // Формат, который ожидает frontend
    res.json({
      success: true,
      stats: {
        ...stats,
        // Legacy совместимость - flat numbers for Dashboard
        total,
        expired,
        critical,
        warning,
        good,
        needsAttention: expired + critical + warning + today,
        // Additional legacy fields
        totalBatches: total,
        totalProducts: stats.total?.products || 0,
        totalCategories: stats.total?.categories || 0,
        healthScore: stats.total?.healthScore || 100
      }
    })

  } catch (error) {
    console.error('[Inventory] Get batches stats error:', error)
    res.status(500).json({ error: 'Ошибка получения статистики' })
  }
})

/**
 * GET /api/batches
 * Получить список партий с фильтрацией
 */
router.get('/batches', authMiddleware, async (req, res) => {
  try {
    const validation = validate(BatchFiltersSchema, req.query)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const filters = validation.data
    const { page, limit, sortBy, sortOrder, ...where } = filters
    const offset = (page - 1) * limit

    // Базовый запрос с изоляцией по hotel_id
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    let sql = `
      SELECT b.*, p.name as product_name, p.unit, c.name as category_name,
             d.name as department_name, u.name as added_by_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON b.department_id = d.id
      LEFT JOIN users u ON b.added_by = u.id
      WHERE b.hotel_id = $1
    `
    const params = [hotelId]
    let paramIndex = 2

    // Применяем фильтры
    if (where.productId) {
      sql += ` AND b.product_id = $${paramIndex++}`
      params.push(where.productId)
    }

    if (where.categoryId) {
      sql += ` AND p.category_id = $${paramIndex++}`
      params.push(where.categoryId)
    }

    if (where.departmentId) {
      sql += ` AND b.department_id = $${paramIndex++}`
      params.push(where.departmentId)
    }

    if (where.status) {
      sql += ` AND b.status = $${paramIndex++}`
      params.push(where.status)
    }

    if (where.expiringWithin !== undefined) {
      sql += ` AND b.expiry_date <= CURRENT_DATE + $${paramIndex++}::interval`
      params.push(`${where.expiringWithin} days`)
    }

    if (where.expiredOnly) {
      sql += ` AND b.expiry_date < CURRENT_DATE`
    }

    if (where.minQuantity !== undefined) {
      sql += ` AND b.quantity >= $${paramIndex++}`
      params.push(where.minQuantity)
    }

    if (where.search) {
      sql += ` AND (p.name ILIKE $${paramIndex++} OR b.batch_number ILIKE $${paramIndex++})`
      const searchPattern = `%${where.search}%`
      params.push(searchPattern, searchPattern)
    }

    // Сортировка
    const sortColumn = {
      expiryDate: 'b.expiry_date',
      quantity: 'b.quantity',
      createdAt: 'b.created_at',
      productName: 'p.name'
    }[sortBy] || 'b.expiry_date'

    sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    // Получаем count для пагинации
    const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM')
      .replace(/ORDER BY.*/, '')

    const [batchesResult, countResult] = await Promise.all([
      dbQuery(sql, params),
      dbQuery(countSql.replace(/LIMIT.*/, ''), params.slice(0, -2))
    ])

    const total = parseInt(countResult.rows[0]?.total || 0)

    // Enrich batches with expiry status using dynamic thresholds from notification_rules
    const enrichedBatches = await enrichBatchesWithExpiryData(batchesResult.rows, { hotelId })

    res.json({
      success: true,
      batches: enrichedBatches,  // Frontend expects 'batches', not 'items'
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + batchesResult.rows.length < total
    })

  } catch (error) {
    console.error('[Inventory] Get batches error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/batches
 * Создать новую партию
 * Поддерживает productId (UUID) ИЛИ productName для автоматического поиска/создания продукта
 */
router.post('/batches', authMiddleware, requirePermission('batches', 'create'), async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(CreateBatchSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const data = validation.data

    // Нормализуем departmentId (может прийти как department или departmentId)
    const departmentId = data.departmentId || data.department || req.user.department_id

    if (!departmentId) {
      return res.status(400).json({ error: 'Необходимо указать отдел (departmentId)' })
    }

    let productId = data.productId

    // Если указан productName вместо productId — ищем или создаём продукт
    if (!productId && data.productName) {
      // Ищем продукт по имени в отеле
      const existingProduct = await dbQuery(
        `SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND hotel_id = $2`,
        [data.productName.trim(), hotelId]
      )

      if (existingProduct.rows.length > 0) {
        productId = existingProduct.rows[0].id
      } else {
        // Создаём новый продукт
        // Находим категорию если указана
        let categoryId = data.categoryId || null
        if (!categoryId && data.category) {
          const categoryResult = await dbQuery(
            `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND hotel_id = $2`,
            [data.category.trim(), hotelId]
          )
          if (categoryResult.rows.length > 0) {
            categoryId = categoryResult.rows[0].id
          }
        }

        const newProduct = await dbQuery(`
          INSERT INTO products (hotel_id, department_id, category_id, name, unit)
          VALUES ($1, $2, $3, $4, 'pcs')
          RETURNING id
        `, [hotelId, departmentId, categoryId, data.productName.trim()])

        productId = newProduct.rows[0].id
      }
    }

    if (!productId) {
      return res.status(400).json({ error: 'Не удалось определить продукт' })
    }

    // Проверяем что продукт существует и принадлежит отелю
    const product = await dbQuery(
      'SELECT id FROM products WHERE id = $1 AND hotel_id = $2',
      [productId, hotelId]
    )

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Продукт не найден' })
    }

    // Определяем статус на основе даты
    const expiryDate = new Date(data.expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))

    let status = 'active'
    if (daysUntilExpiry <= 0) status = 'expired'
    else if (daysUntilExpiry <= 3) status = 'expiring'

    const result = await dbQuery(`
      INSERT INTO batches (
        hotel_id, department_id, product_id, quantity,
        expiry_date, batch_number, status, added_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      hotelId,
      departmentId,
      productId,
      data.quantity || 1,
      data.expiryDate,
      data.batchNumber || null,
      status,
      req.user.id
    ])

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'create',
      entity_type: 'batch',
      entity_id: result.rows[0].id,
      details: { productId, quantity: data.quantity }
    })

    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Create batch error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PUT /api/batches/:id
 * Обновить партию
 */
router.put('/batches/:id', authMiddleware, requirePermission('batches', 'update'), async (req, res) => {
  try {
    const batchId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    // Проверка UUID формата
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(batchId)) {
      return res.status(400).json({ error: 'Неверный ID партии' })
    }

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(UpdateBatchSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    // Проверяем что партия существует и принадлежит отелю
    const existing = await dbQuery(
      'SELECT * FROM batches WHERE id = $1 AND hotel_id = $2',
      [batchId, hotelId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Партия не найдена' })
    }

    const data = validation.data
    const updates = []
    const values = []
    let paramIndex = 1

    // Динамически строим UPDATE запрос
    if (data.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex++}`)
      values.push(data.quantity)
    }
    if (data.expiryDate !== undefined) {
      updates.push(`expiry_date = $${paramIndex++}`)
      values.push(data.expiryDate)
    }
    if (data.productionDate !== undefined) {
      updates.push(`production_date = $${paramIndex++}`)
      values.push(data.productionDate)
    }
    if (data.supplierName !== undefined) {
      updates.push(`supplier_name = $${paramIndex++}`)
      values.push(data.supplierName)
    }
    if (data.batchNumber !== undefined) {
      updates.push(`batch_number = $${paramIndex++}`)
      values.push(data.batchNumber)
    }
    if (data.purchasePrice !== undefined) {
      updates.push(`purchase_price = $${paramIndex++}`)
      values.push(data.purchasePrice)
    }
    if (data.departmentId !== undefined) {
      updates.push(`department_id = $${paramIndex++}`)
      values.push(data.departmentId)
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(data.notes)
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(data.status)
    }

    updates.push(`updated_at = NOW()`)
    values.push(batchId, hotelId)

    const result = await dbQuery(`
      UPDATE batches SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex++}
      RETURNING *
    `, values)

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'update',
      entity_type: 'batch',
      entity_id: batchId,
      details: { changes: Object.keys(data) }
    })

    res.json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Update batch error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/batches/:id/collect
 * Быстрый сбор партии
 */
router.post('/batches/:id/collect', authMiddleware, requirePermission('batches', 'update'), async (req, res) => {
  try {
    const batchId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    // Проверка UUID формата
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(batchId)) {
      return res.status(400).json({ error: 'Неверный ID партии' })
    }

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(QuickCollectSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const { quantity, type, reason } = validation.data

    // Проверяем партию
    const batch = await dbQuery(
      'SELECT * FROM batches WHERE id = $1 AND hotel_id = $2',
      [batchId, hotelId]
    )

    if (batch.rows.length === 0) {
      return res.status(404).json({ error: 'Партия не найдена' })
    }

    if (batch.rows[0].quantity < quantity) {
      return res.status(400).json({
        error: `Недостаточно количества. Доступно: ${batch.rows[0].quantity}`
      })
    }

    // Транзакция: создаём collection и обновляем batch
    await dbQuery('BEGIN')

    try {
      // Создаём запись сбора
      await dbQuery(`
        INSERT INTO collections (batch_id, quantity, type, reason, collected_by_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [batchId, quantity, type, reason, req.user.id])

      // Обновляем количество
      const newQuantity = batch.rows[0].quantity - quantity
      const newStatus = newQuantity === 0 ? 'collected' : batch.rows[0].status

      const updated = await dbQuery(`
        UPDATE batches 
        SET quantity = $1, status = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [newQuantity, newStatus, batchId])

      await dbQuery('COMMIT')

      await logAudit({
        hotel_id: hotelId,
        user_id: req.user.id,
        user_name: req.user.name || req.user.login,
        action: 'collect',
        entity_type: 'batch',
        entity_id: batchId,
        details: { quantity, type, reason }
      })

      res.json({
        message: 'Сбор выполнен',
        batch: updated.rows[0]
      })

    } catch (err) {
      await dbQuery('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Inventory] Collect batch error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * DELETE /api/batches/:id
 * Удалить партию
 */
router.delete('/batches/:id', authMiddleware, requirePermission('batches', 'delete'), async (req, res) => {
  try {
    const batchId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    // Проверка UUID формата
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(batchId)) {
      return res.status(400).json({ error: 'Неверный ID партии' })
    }

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const result = await dbQuery(
      'DELETE FROM batches WHERE id = $1 AND hotel_id = $2 RETURNING id',
      [batchId, hotelId]
    )

    if (result.rows.length === 0) {
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
    console.error('[Inventory] Delete batch error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ========================================
// Products
// ========================================

/**
 * GET /api/products/catalog
 * Получить простой список продуктов для выбора в шаблонах
 */
router.get('/products/catalog', authMiddleware, async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    const result = await dbQuery(`
      SELECT p.id, p.name, p.unit, p.barcode, p.default_shelf_life,
             c.id as category_id, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.hotel_id = $1
      ORDER BY c.sort_order, c.name, p.name
    `, [hotelId])

    res.json({
      success: true,
      products: result.rows
    })
  } catch (error) {
    console.error('[Inventory] Get products catalog error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * GET /api/products/status/expired
 * Получить просроченные продукты (партии)
 */
router.get('/products/status/expired', authMiddleware, async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    const result = await dbQuery(`
      SELECT b.*, p.name as product_name, p.unit, c.name as category_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE b.hotel_id = $1 
        AND b.quantity > 0 
        AND b.expiry_date < CURRENT_DATE
      ORDER BY b.expiry_date ASC
    `, [hotelId])

    res.json({
      success: true,
      items: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error('[Inventory] Get expired products error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * GET /api/products/status/expiring-soon
 * Получить скоро истекающие продукты (партии)
 */
router.get('/products/status/expiring-soon', authMiddleware, async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)
    const days = parseInt(req.query.days) || 7

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    const result = await dbQuery(`
      SELECT b.*, p.name as product_name, p.unit, c.name as category_name,
             (b.expiry_date - CURRENT_DATE) as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE b.hotel_id = $1 
        AND b.quantity > 0 
        AND b.expiry_date >= CURRENT_DATE
        AND b.expiry_date <= CURRENT_DATE + $2::interval
      ORDER BY b.expiry_date ASC
    `, [hotelId, `${days} days`])

    res.json({
      success: true,
      items: result.rows,
      count: result.rows.length,
      days
    })
  } catch (error) {
    console.error('[Inventory] Get expiring soon error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * GET /api/products
 * Получить список продуктов
 */
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const validation = validate(ProductFiltersSchema, req.query)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    const filters = validation.data
    const { page, limit, sortBy, sortOrder, ...where } = filters
    const offset = (page - 1) * limit

    let sql = `
      SELECT p.*, c.name as category_name, d.name as department_name,
             COALESCE(SUM(b.quantity), 0) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status != 'collected'
      WHERE p.hotel_id = $1
    `
    const params = [hotelId]
    let paramIndex = 2

    // Фильтрация по отделу - ключевое изменение!
    if (where.departmentId) {
      sql += ` AND p.department_id = $${paramIndex++}`
      params.push(where.departmentId)
    }

    if (where.categoryId) {
      sql += ` AND p.category_id = $${paramIndex++}`
      params.push(where.categoryId)
    }

    if (where.storageType) {
      sql += ` AND p.storage_type = $${paramIndex++}`
      params.push(where.storageType)
    }

    if (where.search) {
      sql += ` AND (p.name ILIKE $${paramIndex++} OR p.barcode ILIKE $${paramIndex++})`
      const searchPattern = `%${where.search}%`
      params.push(searchPattern, searchPattern)
    }

    sql += ` GROUP BY p.id, c.name, d.name`

    if (where.hasStock) {
      sql += ` HAVING COALESCE(SUM(b.quantity), 0) > 0`
    }

    const sortColumn = {
      name: 'p.name',
      createdAt: 'p.created_at',
      stock: 'total_stock'
    }[sortBy] || 'p.name'

    sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const products = await dbQuery(sql, params)

    res.json({
      items: products.rows,
      page,
      limit
    })

  } catch (error) {
    console.error('[Inventory] Get products error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/products
 * Создать продукт
 */
router.post('/products', authMiddleware, requirePermission('products', 'create'), async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(CreateProductSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const data = validation.data

    const result = await dbQuery(`
      INSERT INTO products (
        hotel_id, category_id, department_id, name, description, default_shelf_life,
        unit, storage_type, min_stock, barcode, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      hotelId,
      data.categoryId || null,
      data.departmentId || req.user.departmentId || null,
      data.name,
      data.description || null,
      data.defaultShelfLife || 7,
      data.unit || 'pcs',
      data.storageType || 'room_temp',
      data.minStock || 0,
      data.barcode || null,
      data.imageUrl || null
    ])

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'create',
      entity_type: 'product',
      entity_id: result.rows[0].id,
      details: { name: data.name }
    })

    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Create product error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PUT /api/products/:id
 * Обновить продукт
 */
router.put('/products/:id', authMiddleware, requirePermission('products', 'update'), async (req, res) => {
  try {
    const productId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(UpdateProductSchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    // Проверяем что продукт существует и принадлежит отелю
    const existing = await dbQuery(
      'SELECT * FROM products WHERE id = $1 AND hotel_id = $2',
      [productId, hotelId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Продукт не найден' })
    }

    const data = validation.data
    const updates = []
    const values = []
    let paramIndex = 1

    // Динамически строим UPDATE запрос
    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    if (data.categoryId !== undefined) {
      updates.push(`category_id = $${paramIndex++}`)
      values.push(data.categoryId)
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(data.description)
    }
    if (data.defaultShelfLife !== undefined) {
      updates.push(`default_shelf_life = $${paramIndex++}`)
      values.push(data.defaultShelfLife)
    }
    if (data.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`)
      values.push(data.unit)
    }
    if (data.storageType !== undefined) {
      updates.push(`storage_type = $${paramIndex++}`)
      values.push(data.storageType)
    }
    if (data.minStock !== undefined) {
      updates.push(`min_stock = $${paramIndex++}`)
      values.push(data.minStock)
    }
    if (data.barcode !== undefined) {
      updates.push(`barcode = $${paramIndex++}`)
      values.push(data.barcode)
    }
    if (data.imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`)
      values.push(data.imageUrl)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' })
    }

    updates.push(`updated_at = NOW()`)
    values.push(productId, hotelId)

    const result = await dbQuery(`
      UPDATE products SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex++}
      RETURNING *
    `, values)

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'update',
      entity_type: 'product',
      entity_id: productId,
      details: { changes: Object.keys(data) }
    })

    res.json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Update product error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * DELETE /api/products/:id
 * Удалить продукт
 */
router.delete('/products/:id', authMiddleware, requirePermission('products', 'delete'), async (req, res) => {
  try {
    const productId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const result = await dbQuery(
      'DELETE FROM products WHERE id = $1 AND hotel_id = $2 RETURNING id, name',
      [productId, hotelId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Продукт не найден' })
    }

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'delete',
      entity_type: 'product',
      entity_id: productId,
      details: { name: result.rows[0].name }
    })

    res.json({ success: true, id: productId })

  } catch (error) {
    console.error('[Inventory] Delete product error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ========================================
// Categories
// ========================================

/**
 * GET /api/categories
 * Получить список категорий
 */
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'hotel_id is required' })
    }

    const result = await dbQuery(`
      SELECT c.*, 
             COUNT(DISTINCT p.id) as products_count,
             COUNT(DISTINCT b.id) as batches_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN batches b ON p.id = b.product_id AND b.status != 'collected'
      WHERE c.hotel_id = $1
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `, [hotelId])

    res.json(result.rows)

  } catch (error) {
    console.error('[Inventory] Get categories error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * POST /api/categories
 * Создать категорию
 */
router.post('/categories', authMiddleware, requirePermission('categories', 'create'), async (req, res) => {
  try {
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(CreateCategorySchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    const data = validation.data

    // Проверяем уникальность имени
    const existing = await dbQuery(
      'SELECT id FROM categories WHERE name = $1 AND hotel_id = $2',
      [data.name, hotelId]
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Категория с таким именем уже существует' })
    }

    const result = await dbQuery(`
      INSERT INTO categories (hotel_id, name, description, color, icon, parent_id, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      hotelId,
      data.name,
      data.description,
      data.color,
      data.icon,
      data.parentId,
      data.sortOrder
    ])

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'create',
      entity_type: 'category',
      entity_id: result.rows[0].id,
      details: { name: data.name }
    })

    res.status(201).json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Create category error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * PUT /api/categories/:id
 * Обновить категорию
 */
router.put('/categories/:id', authMiddleware, requirePermission('categories', 'update'), async (req, res) => {
  try {
    const categoryId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    const validation = validate(UpdateCategorySchema, req.body)

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        details: validation.errors
      })
    }

    // Проверяем что категория существует и принадлежит отелю
    const existing = await dbQuery(
      'SELECT * FROM categories WHERE id = $1 AND hotel_id = $2',
      [categoryId, hotelId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    const data = validation.data
    const updates = []
    const values = []
    let paramIndex = 1

    // Динамически строим UPDATE запрос
    if (data.name !== undefined) {
      // Проверяем уникальность имени (кроме текущей категории)
      const duplicate = await dbQuery(
        'SELECT id FROM categories WHERE name = $1 AND hotel_id = $2 AND id != $3',
        [data.name, hotelId, categoryId]
      )
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: 'Категория с таким именем уже существует' })
      }
      updates.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(data.description)
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      values.push(data.color)
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`)
      values.push(data.icon)
    }
    if (data.parentId !== undefined) {
      updates.push(`parent_id = $${paramIndex++}`)
      values.push(data.parentId)
    }
    if (data.sortOrder !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`)
      values.push(data.sortOrder)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' })
    }

    values.push(categoryId, hotelId)

    const result = await dbQuery(`
      UPDATE categories SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex++}
      RETURNING *
    `, values)

    await logAudit({
      hotel_id: hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'update',
      entity_type: 'category',
      entity_id: categoryId,
      details: { changes: Object.keys(data) }
    })

    res.json(result.rows[0])

  } catch (error) {
    console.error('[Inventory] Update category error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

/**
 * DELETE /api/categories/:id
 * Удалить категорию
 */
router.delete('/categories/:id', authMiddleware, requirePermission('categories', 'delete'), async (req, res) => {
  try {
    const categoryId = req.params.id
    const hotelId = getEffectiveHotelId(req)

    if (!hotelId) {
      return res.status(400).json({ error: 'Не указан отель' })
    }

    // Проверяем что категория существует и принадлежит отелю
    const existing = await dbQuery(
      'SELECT id, name FROM categories WHERE id = $1 AND hotel_id = $2',
      [categoryId, hotelId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' })
    }

    const categoryName = existing.rows[0].name

    // Проверяем нет ли продуктов в этой категории
    const products = await dbQuery(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [categoryId]
    )

    if (parseInt(products.rows[0].count) > 0) {
      // Убираем категорию у продуктов (не удаляем продукты)
      await dbQuery(
        'UPDATE products SET category_id = NULL WHERE category_id = $1',
        [categoryId]
      )
    }

    // Удаляем категорию
    await dbQuery(
      'DELETE FROM categories WHERE id = $1 AND hotel_id = $2',
      [categoryId, hotelId]
    )

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
    console.error('[Inventory] Delete category error:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

export default router
