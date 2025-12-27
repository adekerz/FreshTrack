/**
 * FreshTrack FIFO Collection API - Phase 8
 * 
 * Endpoints for automated batch collection using FIFO algorithm.
 * Employees specify product and quantity - system picks oldest batches first.
 */

import express from 'express'
import * as CollectionService from '../services/CollectionService.js'
import { ExportService, ExportFormat } from '../services/ExportService.js'
import { auditService, AuditAction, AuditEntityType } from '../services/AuditService.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/fifo-collect/preview
 * Preview which batches will be affected by FIFO collection
 * 
 * Query params:
 * - productId: UUID (required)
 * - quantity: number (required)
 * 
 * Response:
 * - success: boolean
 * - affectedBatches: Array of batches that will be collected from
 * - totalAvailable: Total available quantity
 */
router.get('/preview', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.READ), async (req, res) => {
  try {
    const { productId, quantity } = req.query

    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_PRODUCT_ID',
        message: 'Product ID is required' 
      })
    }

    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: CollectionService.CollectionError.INVALID_QUANTITY,
        message: 'Valid quantity is required' 
      })
    }

    const preview = await CollectionService.previewCollection({
      productId,
      quantity: parseInt(quantity),
      hotelId: req.hotelId,
      departmentId: req.departmentId
    })

    if (!preview.success) {
      const statusCode = preview.error === CollectionService.CollectionError.INSUFFICIENT_STOCK 
        ? 409 
        : 400
      return res.status(statusCode).json(preview)
    }

    res.json(preview)
  } catch (error) {
    console.error('FIFO preview error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'PREVIEW_FAILED',
      message: 'Failed to generate collection preview' 
    })
  }
})

/**
 * POST /api/fifo-collect/collect
 * Execute FIFO collection - actually collects from batches
 * 
 * Body:
 * - productId: UUID (required)
 * - quantity: number (required)
 * - reason: string (optional, default: 'consumption')
 * - notes: string (optional)
 * 
 * Response:
 * - success: boolean
 * - totalCollected: number
 * - historyEntries: Array of collection history records
 * - batchesAffected: number
 * - batchesDeleted: number
 */
router.post('/collect', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const { productId, quantity, reason, notes } = req.body

      if (!productId) {
        return res.status(400).json({ 
          success: false, 
          error: 'MISSING_PRODUCT_ID',
          message: 'Product ID is required' 
        })
      }

      if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: CollectionService.CollectionError.INVALID_QUANTITY,
          message: 'Valid quantity is required' 
        })
      }

      const result = await CollectionService.collect({
        productId,
        quantity: parseInt(quantity),
        userId: req.user.id,
        hotelId: req.hotelId,
        departmentId: req.departmentId,
        reason: reason || CollectionService.CollectionReason.CONSUMPTION,
        notes
      })

      if (!result.success) {
        const statusCode = result.error === CollectionService.CollectionError.INSUFFICIENT_STOCK 
          ? 409 
          : 400
        return res.status(statusCode).json(result)
      }

      res.json(result)
    } catch (error) {
      console.error('FIFO collect error:', error)
      res.status(500).json({ 
        success: false, 
        error: 'COLLECTION_FAILED',
        message: 'Failed to execute collection' 
      })
    }
  }
)

/**
 * GET /api/fifo-collect/history
 * Get collection history with filters
 * 
 * Query params:
 * - productId: UUID (optional)
 * - userId: UUID (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - limit: number (optional, default: 100)
 * - offset: number (optional, default: 0)
 */
router.get('/history', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission(PermissionResource.BATCHES, PermissionAction.READ),
  async (req, res) => {
    try {
      const { productId, userId, startDate, endDate, limit, offset } = req.query

      const history = await CollectionService.getCollectionHistory(req.hotelId, {
        departmentId: req.canAccessAllDepartments ? null : req.departmentId,
        productId,
        userId,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
      })

      res.json({ 
        success: true, 
        history,
        count: history.length
      })
    } catch (error) {
      console.error('Get collection history error:', error)
      res.status(500).json({ 
        success: false, 
        error: 'FETCH_FAILED',
        message: 'Failed to get collection history' 
      })
    }
  }
)

/**
 * GET /api/fifo-collect/history/export
 * Export collection history with filters
 * 
 * Query params:
 * - format: 'csv' | 'xlsx' | 'json' (optional, default from settings or 'xlsx')
 * - productId: UUID (optional)
 * - userId: UUID (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */
router.get('/history/export', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission(PermissionResource.REPORTS, PermissionAction.EXPORT),
  async (req, res) => {
    try {
      const { productId, userId, startDate, endDate, format = 'xlsx' } = req.query

      // Fetch history with export limit (10000 records max)
      const history = await CollectionService.getCollectionHistory(req.hotelId, {
        departmentId: req.canAccessAllDepartments ? null : req.departmentId,
        productId,
        userId,
        startDate,
        endDate,
        limit: 10000,
        offset: 0
      })

      // Log export action
      await auditService.log({
        userId: req.user.id,
        hotelId: req.hotelId,
        departmentId: req.departmentId,
        action: AuditAction.EXPORT,
        entityType: AuditEntityType.BATCH,
        entityId: 'ALL',
        details: `Exported collection history in ${format} format`,
        snapshotAfter: { 
          format, 
          recordCount: history.length,
          filters: { productId, userId, startDate, endDate }
        },
        req
      })

      // Send export using ExportService
      await ExportService.sendExport(res, history, 'collectionHistory', format, {
        filename: `collection_history_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Collection History'
      })
    } catch (error) {
      console.error('Export collection history error:', error)
      res.status(500).json({ 
        success: false, 
        error: 'EXPORT_FAILED',
        message: 'Failed to export collection history' 
      })
    }
  }
)

/**
 * GET /api/fifo-collect/stats
 * Get collection statistics
 * 
 * Query params:
 * - period: 'day' | 'week' | 'month' | 'year' (optional, default: 'month')
 * - departmentId: UUID (optional, for hotel admins)
 */
router.get('/stats', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  async (req, res) => {
    try {
      const { period, departmentId } = req.query

      // Use provided departmentId only if user has access to all departments
      const deptId = req.canAccessAllDepartments 
        ? (departmentId || null)
        : req.departmentId

      const stats = await CollectionService.getCollectionStats(
        req.hotelId,
        deptId,
        period || 'month'
      )

      res.json({ 
        success: true, 
        ...stats
      })
    } catch (error) {
      console.error('Get collection stats error:', error)
      res.status(500).json({ 
        success: false, 
        error: 'STATS_FAILED',
        message: 'Failed to get collection statistics' 
      })
    }
  }
)

/**
 * GET /api/fifo-collect/reasons
 * Get list of available collection reasons
 */
router.get('/reasons', authMiddleware, (req, res) => {
  res.json({
    success: true,
    reasons: Object.entries(CollectionService.CollectionReason).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase()
    }))
  })
})

export default router
