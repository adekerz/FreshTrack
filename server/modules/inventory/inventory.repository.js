/**
 * Inventory Repository
 *
 * Data access layer for inventory entities (batches, products, categories).
 * All SQL queries are centralized here. Controller handles HTTP, validation, and audit.
 */
import { query as dbQuery } from '../../db/postgres.js'
import { getClient } from '../../db/postgres.js'

// ===== HELPERS =====

export async function findFirstActiveHotel() {
  const result = await dbQuery('SELECT id FROM hotels WHERE is_active = TRUE LIMIT 1')
  return result.rows[0] || null
}

// ===== BATCH QUERIES =====

/**
 * Find batches with filtering, sorting, pagination
 * Returns { rows, total }
 */
export async function findBatches(hotelId, { departmentId, categoryId, productId, status, expiringWithin, expiredOnly, minQuantity, search, sortBy, sortOrder, page, limit } = {}) {
  const offset = ((page || 1) - 1) * (limit || 20)

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

  if (productId) {
    sql += ` AND b.product_id = $${paramIndex++}`
    params.push(productId)
  }
  if (categoryId) {
    sql += ` AND p.category_id = $${paramIndex++}`
    params.push(categoryId)
  }
  if (departmentId) {
    sql += ` AND b.department_id = $${paramIndex++}`
    params.push(departmentId)
  }
  if (status) {
    sql += ` AND b.status = $${paramIndex++}`
    params.push(status)
  }
  if (expiringWithin !== undefined) {
    sql += ` AND b.expiry_date <= CURRENT_DATE + $${paramIndex++}::interval`
    params.push(`${expiringWithin} days`)
  }
  if (expiredOnly) {
    sql += ` AND b.expiry_date < CURRENT_DATE`
  }
  if (minQuantity !== undefined) {
    sql += ` AND b.quantity >= $${paramIndex++}`
    params.push(minQuantity)
  }
  if (search) {
    sql += ` AND (p.name ILIKE $${paramIndex++} OR b.batch_number ILIKE $${paramIndex++})`
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern)
  }

  const sortColumn = {
    expiryDate: 'b.expiry_date',
    quantity: 'b.quantity',
    createdAt: 'b.created_at',
    productName: 'p.name'
  }[sortBy] || 'b.expiry_date'

  sql += ` ORDER BY ${sortColumn} ${(sortOrder || 'asc').toUpperCase()}`
  sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  params.push(limit || 20, offset)

  const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM')
    .replace(/ORDER BY.*/, '')

  const [batchesResult, countResult] = await Promise.all([
    dbQuery(sql, params),
    dbQuery(countSql.replace(/LIMIT.*/, ''), params.slice(0, -2))
  ])

  return {
    rows: batchesResult.rows,
    total: parseInt(countResult.rows[0]?.total || 0)
  }
}

export async function findBatchById(batchId, hotelId) {
  const result = await dbQuery(
    'SELECT * FROM batches WHERE id = $1 AND hotel_id = $2',
    [batchId, hotelId]
  )
  return result.rows[0] || null
}

export async function findExistingBatchForMerge(productId, expiryDate, departmentId, hotelId) {
  const result = await dbQuery(`
    SELECT * FROM batches
    WHERE product_id = $1
      AND expiry_date = $2
      AND department_id = $3
      AND hotel_id = $4
      AND status = 'active'
    LIMIT 1
  `, [productId, expiryDate, departmentId, hotelId])
  return result.rows[0] || null
}

export async function updateBatchQuantity(batchId, newQuantity) {
  const result = await dbQuery(`
    UPDATE batches
    SET quantity = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [newQuantity, batchId])
  return result.rows[0]
}

export async function createBatch({ hotelId, departmentId, productId, quantity, expiryDate, batchNumber, status, addedBy }) {
  const result = await dbQuery(`
    INSERT INTO batches (
      hotel_id, department_id, product_id, quantity,
      expiry_date, batch_number, status, added_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [hotelId, departmentId, productId, quantity, expiryDate, batchNumber, status, addedBy])
  return result.rows[0]
}

export async function updateBatch(batchId, hotelId, data) {
  const updates = []
  const values = []
  let paramIndex = 1

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
  return result.rows[0]
}

/**
 * Collect batch within a transaction
 * Creates collection record and updates batch quantity
 */
export async function collectBatch(batchId, { quantity, type, reason, userId, currentQuantity, currentStatus }) {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    await client.query(`
      INSERT INTO collections (batch_id, quantity, type, reason, collected_by_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [batchId, quantity, type, reason, userId])

    const newQuantity = currentQuantity - quantity
    const newStatus = newQuantity === 0 ? 'collected' : currentStatus

    const updated = await client.query(`
      UPDATE batches
      SET quantity = $1, status = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [newQuantity, newStatus, batchId])

    await client.query('COMMIT')
    return updated.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function clearAllActiveBatches(hotelId, departmentId = null) {
  if (departmentId) {
    const result = await dbQuery(
      `DELETE FROM batches WHERE hotel_id = $1 AND department_id = $2 AND status = 'active' RETURNING id`,
      [hotelId, departmentId]
    )
    return result.rows
  }
  const result = await dbQuery(
    `DELETE FROM batches WHERE hotel_id = $1 AND status = 'active' RETURNING id`,
    [hotelId]
  )
  return result.rows
}

export async function deleteBatch(batchId, hotelId) {
  const result = await dbQuery(
    'DELETE FROM batches WHERE id = $1 AND hotel_id = $2 RETURNING id',
    [batchId, hotelId]
  )
  return result.rows[0] || null
}

// ===== PRODUCT QUERIES =====

export async function findProductByName(name, hotelId) {
  const result = await dbQuery(
    `SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND hotel_id = $2`,
    [name.trim(), hotelId]
  )
  return result.rows[0] || null
}

export async function findCategoryByName(name, hotelId) {
  const result = await dbQuery(
    `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND hotel_id = $2`,
    [name.trim(), hotelId]
  )
  return result.rows[0] || null
}

export async function createProductInline(hotelId, departmentId, categoryId, name) {
  const result = await dbQuery(`
    INSERT INTO products (hotel_id, department_id, category_id, name, unit)
    VALUES ($1, $2, $3, $4, 'pcs')
    RETURNING id
  `, [hotelId, departmentId, categoryId, name.trim()])
  return result.rows[0]
}

export async function findProductOwnership(productId, hotelId) {
  const result = await dbQuery(
    'SELECT id FROM products WHERE id = $1 AND hotel_id = $2',
    [productId, hotelId]
  )
  return result.rows[0] || null
}

export async function findProductsCatalog(hotelId) {
  const result = await dbQuery(`
    SELECT p.id, p.name, p.unit, p.barcode, p.default_shelf_life,
           c.id as category_id, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.hotel_id = $1
    ORDER BY c.sort_order, c.name, p.name
  `, [hotelId])
  return result.rows
}

export async function findExpiredBatches(hotelId) {
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
  return result.rows
}

export async function findExpiringSoonBatches(hotelId, days) {
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
  return result.rows
}

export async function findProducts(hotelId, { departmentId, categoryId, storageType, search, hasStock, sortBy, sortOrder, page, limit } = {}) {
  const effectiveLimit = limit || 20
  const offset = ((page || 1) - 1) * effectiveLimit

  const params = [hotelId]
  let paramIndex = 2
  let whereExtra = ''

  if (departmentId) {
    whereExtra += ` AND p.department_id = $${paramIndex++}`
    params.push(departmentId)
  }
  if (categoryId) {
    whereExtra += ` AND p.category_id = $${paramIndex++}`
    params.push(categoryId)
  }
  if (storageType) {
    whereExtra += ` AND p.storage_type = $${paramIndex++}`
    params.push(storageType)
  }
  if (search) {
    whereExtra += ` AND (p.name ILIKE $${paramIndex++} OR p.barcode ILIKE $${paramIndex++})`
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern)
  }

  const havingClause = hasStock ? ` HAVING COALESCE(SUM(b.quantity), 0) > 0` : ''

  // Count query (counts groups, not rows)
  const countSql = `
    SELECT COUNT(*) as total FROM (
      SELECT p.id
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.status != 'collected'
      WHERE p.hotel_id = $1${whereExtra}
      GROUP BY p.id${havingClause}
    ) t
  `

  // Data query
  const sortColumn = {
    name: 'p.name',
    createdAt: 'p.created_at',
    stock: 'total_stock'
  }[sortBy] || 'p.name'

  const dataSql = `
    SELECT p.*, c.name as category_name, d.name as department_name,
           COALESCE(SUM(b.quantity), 0) as total_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN departments d ON p.department_id = d.id
    LEFT JOIN batches b ON p.id = b.product_id AND b.status != 'collected'
    WHERE p.hotel_id = $1${whereExtra}
    GROUP BY p.id, p.hotel_id, p.category_id, p.department_id, p.name, p.name_en, p.name_kk, p.description, p.barcode, p.default_shelf_life, p.unit, p.storage_type, p.min_stock, p.image_url, p.is_active, p.created_at, c.name, d.name${havingClause}
    ORDER BY ${sortColumn} ${(sortOrder || 'asc').toUpperCase()}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `

  const filterParams = [...params]
  params.push(effectiveLimit, offset)

  const [dataResult, countResult] = await Promise.all([
    dbQuery(dataSql, params),
    dbQuery(countSql, filterParams)
  ])

  return {
    rows: dataResult.rows,
    total: parseInt(countResult.rows[0]?.total || 0)
  }
}

export async function findProductById(productId, hotelId) {
  const result = await dbQuery(
    'SELECT * FROM products WHERE id = $1 AND hotel_id = $2',
    [productId, hotelId]
  )
  return result.rows[0] || null
}

export async function createProduct(hotelId, data) {
  const result = await dbQuery(`
    INSERT INTO products (
      hotel_id, category_id, department_id, name, description, default_shelf_life,
      unit, storage_type, min_stock, barcode, image_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    hotelId,
    data.categoryId || null,
    data.departmentId || null,
    data.name,
    data.description || null,
    data.defaultShelfLife || 7,
    data.unit || 'pcs',
    data.storageType || 'room_temp',
    data.minStock || 0,
    data.barcode || null,
    data.imageUrl || null
  ])
  return result.rows[0]
}

export async function updateProduct(productId, hotelId, data) {
  const updates = []
  const values = []
  let paramIndex = 1

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

  if (updates.length === 0) return null

  updates.push(`updated_at = NOW()`)
  values.push(productId, hotelId)

  const result = await dbQuery(`
    UPDATE products SET ${updates.join(', ')}
    WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex++}
    RETURNING *
  `, values)
  return result.rows[0]
}

export async function deleteProduct(productId, hotelId) {
  const result = await dbQuery(
    'DELETE FROM products WHERE id = $1 AND hotel_id = $2 RETURNING id, name',
    [productId, hotelId]
  )
  return result.rows[0] || null
}

// ===== CATEGORY QUERIES =====

export async function findCategories(hotelId) {
  const result = await dbQuery(`
    SELECT c.*,
           COUNT(DISTINCT p.id) as products_count,
           COUNT(DISTINCT b.id) as batches_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    LEFT JOIN batches b ON p.id = b.product_id AND b.status != 'collected'
    WHERE c.hotel_id = $1
    GROUP BY c.id, c.hotel_id, c.name, c.name_en, c.name_kk, c.description, c.color, c.icon, c.parent_id, c.sort_order, c.is_active, c.created_at, c.department_id
    ORDER BY c.sort_order, c.name
  `, [hotelId])
  return result.rows
}

export async function findCategoryById(categoryId, hotelId) {
  const result = await dbQuery(
    'SELECT * FROM categories WHERE id = $1 AND hotel_id = $2',
    [categoryId, hotelId]
  )
  return result.rows[0] || null
}

export async function checkCategoryNameExists(name, hotelId, excludeId = null) {
  if (excludeId) {
    const result = await dbQuery(
      'SELECT id FROM categories WHERE name = $1 AND hotel_id = $2 AND id != $3',
      [name, hotelId, excludeId]
    )
    return result.rows.length > 0
  }
  const result = await dbQuery(
    'SELECT id FROM categories WHERE name = $1 AND hotel_id = $2',
    [name, hotelId]
  )
  return result.rows.length > 0
}

export async function createCategory(hotelId, data) {
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
  return result.rows[0]
}

export async function updateCategory(categoryId, hotelId, data) {
  const updates = []
  const values = []
  let paramIndex = 1

  if (data.name !== undefined) {
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

  if (updates.length === 0) return null

  values.push(categoryId, hotelId)

  const result = await dbQuery(`
    UPDATE categories SET ${updates.join(', ')}
    WHERE id = $${paramIndex++} AND hotel_id = $${paramIndex++}
    RETURNING *
  `, values)
  return result.rows[0]
}

export async function countProductsInCategory(categoryId) {
  const result = await dbQuery(
    'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
    [categoryId]
  )
  return parseInt(result.rows[0].count)
}

export async function clearCategoryFromProducts(categoryId) {
  await dbQuery(
    'UPDATE products SET category_id = NULL WHERE category_id = $1',
    [categoryId]
  )
}

export async function deleteCategory(categoryId, hotelId) {
  const result = await dbQuery(
    'DELETE FROM categories WHERE id = $1 AND hotel_id = $2 RETURNING id',
    [categoryId, hotelId]
  )
  return result.rows[0] || null
}
