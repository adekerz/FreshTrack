/**
 * Audit Controller
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import { getAuditLogs } from '../../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction,
  superAdminOnly
} from '../../middleware/auth.js'
import { UnifiedFilterService } from '../../services/FilterService.js'
import { ExportService } from '../../services/ExportService.js'
import { logAudit, AuditAction, AuditEntityType, auditService } from '../../services/AuditService.js'
import { AuditIntegrityService } from '../../services/AuditIntegrityService.js'
import { rateLimitExport } from '../../middleware/rateLimiter.js'
import { requireAllowlistedIP } from '../../middleware/ipAllowlist.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { query as dbQuery } from '../../db/postgres.js'

const router = Router()

router.get('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.AUDIT, PermissionAction.READ), async (req, res) => {
  try {
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    
    const dbFilters = {
      user_id: filters.userId,
      action: filters.action,
      entity_type: filters.entityType,
      entity_id: req.query.entity_id,
      start_date: filters.dateFrom?.toISOString(),
      end_date: filters.dateTo?.toISOString(),
      limit: filters.limit,
      offset: filters.offset
    }
    
    const logs = await getAuditLogs(req.hotelId, dbFilters)
    
    let filteredLogs = logs
    if (filters.search) {
      filteredLogs = UnifiedFilterService.filterBySearch(logs, filters.search, [
        'user_name', 'action', 'entity_type', 'details'
      ])
    }
    
    res.json({ 
      success: true, 
      ...UnifiedFilterService.createPaginatedResponse(filteredLogs, filteredLogs.length, filters),
      logs: filteredLogs
    })
  } catch (error) {
    logError('Get audit logs error', error)
    res.status(500).json({ success: false, error: 'Failed to get audit logs' })
  }
})

router.get('/export', 
  authMiddleware, 
  hotelIsolation, 
  requirePermission(PermissionResource.AUDIT, PermissionAction.EXPORT),
  rateLimitExport,
  requireAllowlistedIP,
  async (req, res) => {
    try {
      const filters = UnifiedFilterService.parseCommonFilters(req.query, { isExport: true })
      
      const dbFilters = {
        user_id: filters.userId,
        action: filters.action,
        entity_type: filters.entityType,
        start_date: filters.dateFrom?.toISOString(),
        end_date: filters.dateTo?.toISOString(),
        limit: filters.limit,
        offset: 0
      }
      
      const logs = await getAuditLogs(req.hotelId, dbFilters)
      const { format = 'xlsx' } = req.query
      
      // Check export size limit
      if (logs.length > ExportService.MAX_EXPORT_ROWS) {
        return res.status(400).json({
          success: false,
          error: `Export too large (${logs.length} rows). Maximum: ${ExportService.MAX_EXPORT_ROWS} rows. Please apply date filters.`
        })
      }

      await logAudit({
        user_id: req.user.id,
        user_name: req.user.name,
        hotel_id: req.hotelId,
        action: AuditAction.EXPORT,
        entity_type: AuditEntityType.SETTINGS,
        entity_id: 'ALL',
        details: { 
          action: `Exported audit logs in ${format} format`,
          format, 
          recordCount: logs.length,
          filters: { 
            userId: filters.userId, 
            action: filters.action, 
            entityType: filters.entityType,
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString()
          }
        },
        ip_address: req.ip
      })

      await ExportService.sendExport(res, logs, 'auditLogs', format, {
        filename: `audit_logs_${new Date().toISOString().split('T')[0]}`,
        sheetName: 'Audit Logs',
        user: req.user,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        filters: dbFilters
      })
    } catch (error) {
      logError('Export audit logs error', error)
      res.status(500).json({ success: false, error: 'Failed to export audit logs' })
    }
  }
)

router.get('/actions', authMiddleware, hotelIsolation, requirePermission(PermissionResource.AUDIT, PermissionAction.READ), async (req, res) => {
  try {
    const actions = [
      'login', 'logout', 'create', 'update', 'delete',
      'view_report', 'export', 'import', 'change_password',
      'update_profile', 'write_off', 'collect', 'fifo_collect'
    ]
    res.json({ success: true, actions })
  } catch (error) {
    logError('Get audit actions error', error)
    res.status(500).json({ success: false, error: 'Failed to get audit actions' })
  }
})

router.get('/entity-types', authMiddleware, hotelIsolation, requirePermission(PermissionResource.AUDIT, PermissionAction.READ), async (req, res) => {
  try {
    const entityTypes = [
      'user', 'hotel', 'department', 'category', 'product',
      'batch', 'write_off', 'notification', 'settings', 'report',
      'collection', 'delivery_template'
    ]
    res.json({ success: true, entity_types: entityTypes })
  } catch (error) {
    logError('Get entity types error', error)
    res.status(500).json({ success: false, error: 'Failed to get entity types' })
  }
})

router.get('/entity/:type/:id', 
  authMiddleware, 
  hotelIsolation, 
  requirePermission(PermissionResource.AUDIT, PermissionAction.READ),
  async (req, res) => {
    try {
      const { type, id } = req.params
      const { limit = 50 } = req.query

      const validEntityTypes = Object.values(AuditEntityType)
      if (!validEntityTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ENTITY_TYPE',
          message: `Invalid entity type. Valid types: ${validEntityTypes.join(', ')}`
        })
      }

      const history = await auditService.getEntityHistory(
        req.hotelId, 
        type, 
        id, 
        parseInt(limit)
      )

      const timeline = history.map(log => ({
        id: log.id,
        action: log.action,
        timestamp: log.created_at,
        user: {
          id: log.user_id,
          name: log.user_display_name || log.user_name || log.user_login
        },
        details: log.details,
        changes: log.changes_diff,
        snapshotBefore: log.snapshot_before,
        snapshotAfter: log.snapshot_after
      }))

      res.json({
        success: true,
        entityType: type,
        entityId: id,
        historyCount: timeline.length,
        timeline
      })
    } catch (error) {
      logError('Get entity history error', error)
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get entity history' 
      })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// AUDIT INTEGRITY ENDPOINTS (SUPER_ADMIN only)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/audit/verify-integrity
 * Verify audit trail integrity (SUPER_ADMIN only)
 */
router.get('/verify-integrity', 
  authMiddleware,
  requireMFA,
  superAdminOnly, 
  async (req, res) => {
    try {
      const { startDate, endDate, limit } = req.query
      
      let result
      if (startDate && endDate) {
        result = await AuditIntegrityService.verifyChain(
          new Date(startDate),
          new Date(endDate)
        )
      } else {
        result = await AuditIntegrityService.verifyRecent(
          parseInt(limit) || 1000
        )
      }
      
      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      logError('Verify integrity error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/audit/integrity-status
 * Get integrity status summary (SUPER_ADMIN only)
 */
router.get('/integrity-status',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const status = await AuditIntegrityService.getIntegrityStatus()
      
      res.json({
        success: true,
        ...status
      })
    } catch (error) {
      logError('Get integrity status error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/audit/exports/recent
 * Get recent export activity (SUPER_ADMIN only)
 */
router.get('/exports/recent',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const { limit = 50 } = req.query
      
      const { rows } = await dbQuery(`
        SELECT 
          id,
          user_id,
          created_at,
          snapshot_after->>'exportId' as export_id,
          snapshot_after->>'format' as format,
          snapshot_after->>'rowCount' as row_count,
          snapshot_after->>'ipAddress' as ip_address,
          snapshot_after->>'userAgent' as user_agent,
          user_name
        FROM audit_logs
        WHERE entity_type = 'DATA_EXPORT'
          AND archived = FALSE
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit])
      
      res.json({ 
        success: true, 
        exports: rows 
      })
    } catch (error) {
      logError('Get recent exports error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/audit/export-verified
 * Export audit trail с hash chain для external verification (SUPER_ADMIN only)
 */
router.get('/export-verified',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const { hotelId, startDate, endDate } = req.query
      
      if (!hotelId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'hotelId, startDate, and endDate are required'
        })
      }
      
      const result = await AuditIntegrityService.exportForVerification(
        hotelId,
        new Date(startDate),
        new Date(endDate)
      )
      
      res.setHeader('Content-Type', 'application/x-ndjson')
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${hotelId}-${Date.now()}.jsonl"`)
      res.send(result.data)
    } catch (error) {
      logError('Export verified audit trail error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/audit/archived
 * Get archived audit logs (SUPER_ADMIN only)
 * For forensics and compliance - shows logs older than retention period
 */
router.get('/archived',
  authMiddleware,
  requireMFA,
  superAdminOnly,
  async (req, res) => {
    try {
      const { startDate, endDate, limit = 100 } = req.query
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        })
      }
      
      const { rows } = await dbQuery(`
        SELECT 
          id,
          entity_type,
          entity_id,
          action,
          user_id,
          user_name,
          hotel_id,
          details,
          snapshot_after,
          created_at,
          previous_hash,
          current_hash,
          verified,
          archived,
          archived_at
        FROM audit_logs
        WHERE archived = TRUE
          AND created_at BETWEEN $1 AND $2
        ORDER BY created_at DESC
        LIMIT $3
      `, [startDate, endDate, parseInt(limit)])
      
      // Get total count
      const countResult = await dbQuery(`
        SELECT COUNT(*) as count
        FROM audit_logs
        WHERE archived = TRUE
          AND created_at BETWEEN $1 AND $2
      `, [startDate, endDate])
      
      res.json({
        success: true,
        logs: rows,
        count: rows.length,
        totalArchived: parseInt(countResult.rows[0].count),
        note: 'These are archived records (older than retention period). Hash chain may be incomplete due to archival.',
        dateRange: { startDate, endDate }
      })
    } catch (error) {
      logError('Get archived audit logs error', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
