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
  PermissionAction
} from '../../middleware/auth.js'
import { UnifiedFilterService } from '../../services/FilterService.js'
import { ExportService } from '../../services/ExportService.js'
import { logAudit, AuditAction, AuditEntityType, auditService } from '../../services/AuditService.js'

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
        sheetName: 'Audit Logs'
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

export default router
