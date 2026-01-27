/**
 * FIFO Collect Controller
 * 
 * Automated batch collection using FIFO algorithm.
 */

import { Router } from 'express'
import * as CollectionService from '../../services/CollectionService.js'
import { ExportService } from '../../services/ExportService.js'
import { auditService, AuditAction, AuditEntityType } from '../../services/AuditService.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import { logError } from '../../utils/logger.js'

const router = Router()

/**
 * GET /api/fifo-collect/preview
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
    logError('FIFOCollect', error)
    res.status(500).json({ 
      success: false, 
      error: 'PREVIEW_FAILED',
      message: 'Failed to generate collection preview' 
    })
  }
})

/**
 * POST /api/fifo-collect/collect
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
        userName: req.user.name || req.user.login || 'Unknown',
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
      logError('FIFOCollect', error)
      res.status(500).json({ 
        success: false, 
        error: 'COLLECTION_FAILED',
        message: error.message || 'Failed to execute collection'
      })
    }
  }
)

/**
 * GET /api/fifo-collect/history
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
      logError('FIFOCollect', error)
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
 */
router.get('/history/export', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission(PermissionResource.REPORTS, PermissionAction.EXPORT),
  async (req, res) => {
    try {
      const { productId, userId, startDate, endDate, format = 'xlsx' } = req.query

      const history = await CollectionService.getCollectionHistory(req.hotelId, {
        departmentId: req.canAccessAllDepartments ? null : req.departmentId,
        productId,
        userId,
        startDate,
        endDate,
        limit: 10000,
        offset: 0
      })

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

      await ExportService.sendExport(res, history, 'collectionHistory', format, {
        filename: `collection_history_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Collection History',
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        filters: req.query
      })
    } catch (error) {
      logError('FIFOCollect', error)
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
 */
router.get('/stats', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  async (req, res) => {
    try {
      const { period, departmentId } = req.query

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
      logError('FIFOCollect', error)
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
