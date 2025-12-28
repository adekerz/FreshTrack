/**
 * CollectionService - Phase 8: FIFO Collection Logic
 * 
 * Implements automated batch collection using First-In-First-Out algorithm.
 * Employees only need to specify product and quantity - system automatically
 * picks from oldest expiry dates first.
 * 
 * Features:
 * - FIFO algorithm (earliest expiry first)
 * - Transaction locking (prevents race conditions)
 * - Snapshot preservation (history remains even if batch deleted)
 * - Preview mode (shows affected batches before confirmation)
 */

import { query, getClient } from '../db/postgres.js'
import { logError } from '../utils/logger.js'
import { v4 as uuidv4 } from 'uuid'
import { auditService, AuditAction, AuditEntityType } from './AuditService.js'

// Collection reasons
export const CollectionReason = {
  CONSUMPTION: 'consumption',
  MINIBAR: 'minibar',
  SALE: 'sale',
  DAMAGED: 'damaged',
  OTHER: 'other'
}

// Error codes
export const CollectionError = {
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  NO_ACTIVE_BATCHES: 'NO_ACTIVE_BATCHES',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  INVALID_DEPARTMENT: 'INVALID_DEPARTMENT'
}

/**
 * Preview FIFO collection - shows which batches will be affected
 * Use this before actual collection to confirm with user
 * 
 * @param {Object} params
 * @param {string} params.productId - Product ID to collect
 * @param {number} params.quantity - Quantity to collect
 * @param {string} params.hotelId - Hotel ID
 * @param {string} params.departmentId - Department ID
 * @returns {Object} Preview result with affected batches
 */
export async function previewCollection({
  productId,
  quantity,
  hotelId,
  departmentId
}) {
  if (!quantity || quantity <= 0) {
    return {
      success: false,
      error: CollectionError.INVALID_QUANTITY,
      message: 'Quantity must be greater than 0'
    }
  }

  // Get active batches sorted by expiry (FIFO)
  const batchesResult = await query(`
    SELECT b.id, b.quantity, b.expiry_date, b.batch_number,
           p.name as product_name, p.name_en, c.name as category_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE b.product_id = $1 
      AND b.hotel_id = $2 
      AND b.department_id = $3
      AND b.status = 'active' 
      AND b.quantity > 0
    ORDER BY b.expiry_date ASC, b.added_at ASC
  `, [productId, hotelId, departmentId])

  const batches = batchesResult.rows

  if (batches.length === 0) {
    return {
      success: false,
      error: CollectionError.NO_ACTIVE_BATCHES,
      message: 'No active batches found for this product'
    }
  }

  const totalAvailable = batches.reduce((sum, b) => sum + parseInt(b.quantity), 0)

  if (totalAvailable < quantity) {
    return {
      success: false,
      error: CollectionError.INSUFFICIENT_STOCK,
      message: `Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity}`,
      available: totalAvailable,
      requested: quantity
    }
  }

  // Calculate what will be collected from each batch
  let remainingToCollect = quantity
  const affectedBatches = []

  for (const batch of batches) {
    if (remainingToCollect <= 0) break

    const batchQty = parseInt(batch.quantity)
    const takeFromThisBatch = Math.min(batchQty, remainingToCollect)

    affectedBatches.push({
      batchId: batch.id,
      expiryDate: batch.expiry_date,
      batchNumber: batch.batch_number,
      currentQuantity: batchQty,
      collectQuantity: takeFromThisBatch,
      remainingQuantity: batchQty - takeFromThisBatch,
      willBeDeleted: batchQty === takeFromThisBatch,
      productName: batch.product_name,
      categoryName: batch.category_name
    })

    remainingToCollect -= takeFromThisBatch
  }

  return {
    success: true,
    productId,
    productName: batches[0]?.product_name,
    categoryName: batches[0]?.category_name,
    totalRequested: quantity,
    totalAvailable,
    affectedBatches,
    batchCount: affectedBatches.length
  }
}

/**
 * Execute FIFO collection - actually collects from batches
 * Uses transaction with row locking to prevent race conditions
 * 
 * @param {Object} params
 * @param {string} params.productId - Product ID to collect
 * @param {number} params.quantity - Quantity to collect
 * @param {string} params.userId - User performing collection
 * @param {string} params.hotelId - Hotel ID
 * @param {string} params.departmentId - Department ID
 * @param {string} params.reason - Collection reason (optional)
 * @param {string} params.notes - Additional notes (optional)
 * @returns {Object} Collection result with history entries
 */
export async function collect({
  productId,
  quantity,
  userId,
  hotelId,
  departmentId,
  reason = CollectionReason.CONSUMPTION,
  notes = null
}) {
  if (!quantity || quantity <= 0) {
    return {
      success: false,
      error: CollectionError.INVALID_QUANTITY,
      message: 'Quantity must be greater than 0'
    }
  }

  if (!productId || !hotelId || !departmentId) {
    return {
      success: false,
      error: CollectionError.INVALID_DEPARTMENT,
      message: 'Product ID, Hotel ID and Department ID are required'
    }
  }

  const client = await getClient()

  try {
    await client.query('BEGIN')

    // 1. Get active batches with FOR UPDATE lock (prevents race conditions)
    const batchesResult = await client.query(`
      SELECT b.id, b.quantity, b.expiry_date, b.batch_number, b.product_id,
             p.name as product_name, c.name as category_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE b.product_id = $1 
        AND b.hotel_id = $2 
        AND b.department_id = $3
        AND b.status = 'active' 
        AND b.quantity > 0
      ORDER BY b.expiry_date ASC, b.added_at ASC
      FOR UPDATE
    `, [productId, hotelId, departmentId])

    const batches = batchesResult.rows

    if (batches.length === 0) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: CollectionError.NO_ACTIVE_BATCHES,
        message: 'No active batches found for this product'
      }
    }

    const totalAvailable = batches.reduce((sum, b) => sum + parseInt(b.quantity), 0)

    if (totalAvailable < quantity) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: CollectionError.INSUFFICIENT_STOCK,
        message: `Insufficient stock. Available: ${totalAvailable}, Requested: ${quantity}`,
        available: totalAvailable,
        requested: quantity
      }
    }

    // 2. Process FIFO collection
    let remainingToCollect = quantity
    const historyEntries = []
    const deletedBatchIds = []

    for (const batch of batches) {
      if (remainingToCollect <= 0) break

      const batchQty = parseInt(batch.quantity)
      const takeFromThisBatch = Math.min(batchQty, remainingToCollect)
      const quantityRemaining = batchQty - takeFromThisBatch

      // 2a. Create collection history with snapshot
      const historyId = uuidv4()
      await client.query(`
        INSERT INTO collection_history (
          id, batch_id, product_id, hotel_id, department_id, user_id,
          quantity_collected, quantity_remaining,
          expiry_date, product_name, category_name, batch_number,
          collection_reason, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        historyId,
        batch.id,
        productId,
        hotelId,
        departmentId,
        userId,
        takeFromThisBatch,
        quantityRemaining,
        batch.expiry_date,
        batch.product_name,
        batch.category_name,
        batch.batch_number,
        reason,
        notes
      ])

      historyEntries.push({
        historyId,
        batchId: batch.id,
        quantityCollected: takeFromThisBatch,
        quantityRemaining,
        expiryDate: batch.expiry_date,
        productName: batch.product_name
      })

      // 2b. Update or delete batch
      if (quantityRemaining === 0) {
        // Delete batch when fully consumed
        await client.query('DELETE FROM batches WHERE id = $1', [batch.id])
        deletedBatchIds.push(batch.id)
      } else {
        // Update remaining quantity
        await client.query(
          'UPDATE batches SET quantity = $1 WHERE id = $2',
          [quantityRemaining, batch.id]
        )
      }

      remainingToCollect -= takeFromThisBatch
    }

    await client.query('COMMIT')

    // 3. Log audit (outside transaction)
    try {
      await auditService.log({
        userId,
        hotelId,
        action: AuditAction.COLLECT || 'fifo_collect',
        entityType: AuditEntityType.BATCH || 'collection',
        entityId: historyEntries[0]?.historyId,
        details: {
          productId,
          productName: batches[0]?.product_name,
          totalCollected: quantity,
          batchesAffected: historyEntries.length,
          batchesDeleted: deletedBatchIds.length,
          reason
        }
      })
    } catch (auditError) {
      logError('CollectionService', auditError)
      // Don't fail the collection for audit errors
    }

    return {
      success: true,
      totalCollected: quantity,
      historyEntries,
      batchesAffected: historyEntries.length,
      batchesDeleted: deletedBatchIds.length,
      productName: batches[0]?.product_name,
      categoryName: batches[0]?.category_name
    }

  } catch (error) {
    await client.query('ROLLBACK')
    logError('CollectionService', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get collection history with filters
 * 
 * @param {string} hotelId
 * @param {Object} filters
 * @returns {Array} Collection history entries
 */
export async function getCollectionHistory(hotelId, filters = {}) {
  const { departmentId, productId, userId, startDate, endDate, limit = 100, offset = 0 } = filters

  let queryText = `
    SELECT ch.*, u.name as user_name, d.name as department_name
    FROM collection_history ch
    LEFT JOIN users u ON ch.user_id = u.id
    LEFT JOIN departments d ON ch.department_id = d.id
    WHERE ch.hotel_id = $1
  `
  const params = [hotelId]
  let paramIndex = 2

  if (departmentId) {
    queryText += ` AND ch.department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  if (productId) {
    queryText += ` AND ch.product_id = $${paramIndex++}`
    params.push(productId)
  }

  if (userId) {
    queryText += ` AND ch.user_id = $${paramIndex++}`
    params.push(userId)
  }

  if (startDate) {
    queryText += ` AND ch.collected_at >= $${paramIndex++}`
    params.push(startDate)
  }

  if (endDate) {
    queryText += ` AND ch.collected_at <= $${paramIndex++}`
    params.push(endDate)
  }

  queryText += ` ORDER BY ch.collected_at DESC`
  queryText += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
  params.push(limit, offset)

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Get collection statistics
 * 
 * @param {string} hotelId
 * @param {string} departmentId - Optional
 * @param {string} period - 'day', 'week', 'month', 'year'
 * @returns {Object} Collection statistics
 */
export async function getCollectionStats(hotelId, departmentId = null, period = 'month') {
  let dateFilter = ''
  switch (period) {
    case 'day':
      dateFilter = "AND ch.collected_at >= CURRENT_DATE"
      break
    case 'week':
      dateFilter = "AND ch.collected_at >= CURRENT_DATE - INTERVAL '7 days'"
      break
    case 'month':
      dateFilter = "AND ch.collected_at >= CURRENT_DATE - INTERVAL '30 days'"
      break
    case 'year':
      dateFilter = "AND ch.collected_at >= CURRENT_DATE - INTERVAL '365 days'"
      break
  }

  let whereClause = 'ch.hotel_id = $1'
  const params = [hotelId]
  let paramIndex = 2

  if (departmentId) {
    whereClause += ` AND ch.department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  // Total stats
  const totalsResult = await query(`
    SELECT 
      COUNT(*) as total_transactions,
      COALESCE(SUM(quantity_collected), 0) as total_quantity,
      COUNT(DISTINCT product_id) as unique_products,
      COUNT(DISTINCT user_id) as unique_users
    FROM collection_history ch
    WHERE ${whereClause} ${dateFilter}
  `, params)

  // Top products
  const topProductsResult = await query(`
    SELECT 
      product_name,
      category_name,
      SUM(quantity_collected) as total_collected,
      COUNT(*) as transaction_count
    FROM collection_history ch
    WHERE ${whereClause} ${dateFilter}
    GROUP BY product_name, category_name
    ORDER BY total_collected DESC
    LIMIT 10
  `, params)

  // By reason
  const byReasonResult = await query(`
    SELECT 
      collection_reason,
      SUM(quantity_collected) as total_collected,
      COUNT(*) as transaction_count
    FROM collection_history ch
    WHERE ${whereClause} ${dateFilter}
    GROUP BY collection_reason
    ORDER BY total_collected DESC
  `, params)

  // Daily trend
  const trendResult = await query(`
    SELECT 
      DATE(collected_at) as date,
      SUM(quantity_collected) as total_collected,
      COUNT(*) as transaction_count
    FROM collection_history ch
    WHERE ${whereClause} ${dateFilter}
    GROUP BY DATE(collected_at)
    ORDER BY date ASC
  `, params)

  const totals = totalsResult.rows[0]

  return {
    period,
    totals: {
      transactions: parseInt(totals.total_transactions),
      quantity: parseInt(totals.total_quantity),
      uniqueProducts: parseInt(totals.unique_products),
      uniqueUsers: parseInt(totals.unique_users)
    },
    topProducts: topProductsResult.rows,
    byReason: byReasonResult.rows,
    dailyTrend: trendResult.rows
  }
}

export default {
  CollectionReason,
  CollectionError,
  previewCollection,
  collect,
  getCollectionHistory,
  getCollectionStats
}


