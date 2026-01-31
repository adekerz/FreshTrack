/**
 * FreshTrack Audit Service
 * Centralized audit logging with snapshots and diff calculation
 * 
 * Phase 4: Centralized Audit System
 * - Single entry point for all audit operations
 * - Snapshot management (before/after states)
 * - Automatic diff calculation
 * - Query interface for audit logs
 */

import { logAudit, createAuditSnapshot, getAuditLogs, query } from '../db/database.js'
import { AuditEnrichmentService } from './AuditEnrichmentService.js'
import { broadcastAuditLog } from '../modules/audit/audit.sse.js'
import { logError } from '../utils/logger.js'

/**
 * Audit action types
 */
export const AuditAction = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_CHANGE: 'password_change',
  
  // CRUD operations
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  
  // Batch operations
  COLLECT: 'collect',
  WRITE_OFF: 'write_off',
  RESTORE: 'restore',
  
  // Bulk operations
  IMPORT: 'import',
  EXPORT: 'export',
  BULK_UPDATE: 'bulk_update',
  BULK_DELETE: 'bulk_delete',
  
  // Settings
  SETTINGS_UPDATE: 'settings_update',
  
  // Reports
  VIEW_REPORT: 'view_report',
  GENERATE_REPORT: 'generate_report'
}

/**
 * Audit entity types
 */
export const AuditEntityType = {
  USER: 'user',
  HOTEL: 'hotel',
  DEPARTMENT: 'department',
  CATEGORY: 'category',
  PRODUCT: 'product',
  BATCH: 'batch',
  WRITE_OFF: 'write_off',
  COLLECTION: 'collection',
  NOTIFICATION: 'notification',
  SETTINGS: 'settings',
  REPORT: 'report',
  DELIVERY_TEMPLATE: 'delivery_template',
  SESSION: 'session'
}

/**
 * AuditService - Centralized audit management
 */
class AuditService {
  /**
   * Log an audit event
   * @param {Object} params - Audit parameters
   * @param {string} params.hotelId - Hotel ID
   * @param {string} params.userId - User ID
   * @param {string} params.userName - User name for display
   * @param {string} params.action - Action type (from AuditAction)
   * @param {string} params.entityType - Entity type (from AuditEntityType)
   * @param {string} params.entityId - Entity ID
   * @param {Object} params.details - Additional details
   * @param {string} params.ipAddress - Client IP address
   * @param {string} params.userAgent - User-Agent header (for enrichment)
   * @param {Object} params.snapshotBefore - State before change
   * @param {Object} params.snapshotAfter - State after change
   */
  async log({
    hotelId,
    userId,
    userName,
    action,
    entityType,
    entityId,
    details = null,
    ipAddress = null,
    userAgent = null,
    snapshotBefore = null,
    snapshotAfter = null
  }) {
    const id = await logAudit({
      hotel_id: hotelId,
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      snapshot_before: snapshotBefore,
      snapshot_after: snapshotAfter
    })
    // Enrich with human-readable metadata (async, non-blocking)
    AuditEnrichmentService.enrichAuditLog({
      id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      snapshot_before: snapshotBefore,
      snapshot_after: snapshotAfter,
      ip_address: ipAddress,
      user_agent: userAgent
    }).catch(() => {})

    // Broadcast to SSE clients (production only)
    if (process.env.NODE_ENV === 'production') {
      const logRow = {
        id,
        hotel_id: hotelId,
        user_id: userId,
        user_name: userName,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
        snapshot_before: snapshotBefore,
        snapshot_after: snapshotAfter
      }
      broadcastAuditLog(logRow).catch((err) => logError('Broadcast audit log', err))
    }

    return id
  }

  /**
   * Log an audit event from request context
   * Helper that extracts common fields from req object
   */
  async logFromRequest(req, {
    action,
    entityType,
    entityId,
    details = null,
    snapshotBefore = null,
    snapshotAfter = null
  }) {
    return this.log({
      hotelId: req.hotelId,
      userId: req.user?.id,
      userName: req.user?.name || req.user?.login,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get?.('user-agent') || null,
      snapshotBefore,
      snapshotAfter
    })
  }

  /**
   * Create a snapshot of an entity
   * Strips sensitive fields and adds metadata
   */
  createSnapshot(entity, entityType) {
    return createAuditSnapshot(entity, entityType)
  }

  /**
   * Enrich audit log with human-readable descriptions
   * @param {Object} log - Audit log entry
   * @returns {Object} - Enriched log entry
   */
  static enrichAuditLog(log) {
    // Человекочитаемое описание действия
    const descriptions = {
      'CREATE': 'Создан',
      'UPDATE': 'Обновлен',
      'DELETE': 'Удален',
      'LOGIN': 'Вход в систему',
      'LOGOUT': 'Выход из системы',
      'COLLECT': 'Выполнен сбор',
      'SETTINGSCHANGE': 'Изменены настройки',
      'EXPORT': 'Экспорт данных',
      'IMPORT': 'Импорт данных',
      'PASSWORD_CHANGE': 'Изменен пароль',
      'EMAIL_CHANGED': 'Изменен email',
      'EMAIL_VERIFIED': 'Email подтвержден'
    }

    const entityTypes = {
      'PRODUCT': 'продукт',
      'BATCH': 'партия',
      'USER': 'пользователь',
      'CATEGORY': 'категория',
      'DEPARTMENT': 'отдел',
      'HOTEL': 'отель',
      'SETTINGS': 'настройки'
    }

    // Формируем читаемое описание
    const action = descriptions[log.action?.toUpperCase()] || log.action || 'Действие'
    const entity = entityTypes[log.entity_type?.toUpperCase()] || log.entity_type?.toLowerCase() || 'объект'
    
    log.human_readable_description = `${action} ${entity}`

    // Извлечь ключевые изменения из snapshot_after
    if (log.snapshot_after) {
      const changes = []
      let snapshot = log.snapshot_after
      
      // Parse if string (should already be parsed in getAuditLogs, but handle both cases)
      if (typeof snapshot === 'string') {
        try {
          snapshot = JSON.parse(snapshot)
        } catch {
          snapshot = null
        }
      }

      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        if (snapshot.name) changes.push(`Название: ${snapshot.name}`)
        if (snapshot.quantity !== undefined) changes.push(`Количество: ${snapshot.quantity}`)
        if (snapshot.expiry_date) {
          try {
            const date = new Date(snapshot.expiry_date)
            if (!isNaN(date.getTime())) {
              changes.push(`Срок годности: ${date.toLocaleDateString('ru-RU')}`)
            } else {
              changes.push(`Срок годности: ${snapshot.expiry_date}`)
            }
          } catch {
            changes.push(`Срок годности: ${snapshot.expiry_date}`)
          }
        }
        if (snapshot.status) changes.push(`Статус: ${snapshot.status}`)
        if (snapshot.email) changes.push(`Email: ${snapshot.email}`)
        if (snapshot.role) changes.push(`Роль: ${snapshot.role}`)
        if (snapshot.newEmail) changes.push(`Новый email: ${snapshot.newEmail}`)
        if (snapshot.oldEmail) changes.push(`Старый email: ${snapshot.oldEmail}`)
      }

      if (changes.length > 0) {
        log.key_changes = changes.join(', ')
      }
    }

    return log
  }

  /**
   * Get audit logs with filtering
   * @param {string} hotelId - Hotel ID to filter by
   * @param {Object} filters - Filter options
   */
  async getLogs(hotelId, filters = {}) {
    const logs = await getAuditLogs(hotelId, filters)
    
    // Обогащение каждой записи
    return logs.map(log => this.constructor.enrichAuditLog(log))
  }

  /**
   * Get audit history for a specific entity
   */
  async getEntityHistory(hotelId, entityType, entityId, limit = 50) {
    const result = await query(`
      SELECT 
        al.*,
        u.name as user_display_name,
        u.login as user_login
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.hotel_id = $1 
        AND al.entity_type = $2 
        AND al.entity_id = $3
      ORDER BY al.created_at DESC
      LIMIT $4
    `, [hotelId, entityType, entityId, limit])
    
    return result.rows.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      snapshot_before: typeof log.snapshot_before === 'string' ? JSON.parse(log.snapshot_before) : log.snapshot_before,
      snapshot_after: typeof log.snapshot_after === 'string' ? JSON.parse(log.snapshot_after) : log.snapshot_after,
      changes_diff: typeof log.changes_diff === 'string' ? JSON.parse(log.changes_diff) : log.changes_diff
    }))
  }

  /**
   * Get recent activity for a user
   */
  async getUserActivity(hotelId, userId, limit = 50) {
    const result = await query(`
      SELECT * FROM audit_logs 
      WHERE hotel_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [hotelId, userId, limit])
    
    return result.rows.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
    }))
  }

  /**
   * Get audit statistics for a hotel
   */
  async getStats(hotelId, startDate = null, endDate = null) {
    let dateFilter = ''
    const params = [hotelId]
    let paramIndex = 2
    
    if (startDate) {
      dateFilter += ` AND DATE(created_at) >= $${paramIndex++}`
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ` AND DATE(created_at) <= $${paramIndex++}`
      params.push(endDate)
    }
    
    const [actionStats, entityStats, userStats] = await Promise.all([
      // Actions breakdown
      query(`
        SELECT action, COUNT(*) as count
        FROM audit_logs 
        WHERE hotel_id = $1 ${dateFilter}
        GROUP BY action
        ORDER BY count DESC
      `, params),
      
      // Entity types breakdown
      query(`
        SELECT entity_type, COUNT(*) as count
        FROM audit_logs 
        WHERE hotel_id = $1 ${dateFilter}
        GROUP BY entity_type
        ORDER BY count DESC
      `, params),
      
      // Top users by activity
      query(`
        SELECT 
          user_id, 
          user_name,
          COUNT(*) as count
        FROM audit_logs 
        WHERE hotel_id = $1 ${dateFilter}
        GROUP BY user_id, user_name
        ORDER BY count DESC
        LIMIT 10
      `, params)
    ])
    
    return {
      byAction: actionStats.rows,
      byEntityType: entityStats.rows,
      topUsers: userStats.rows
    }
  }

  /**
   * Search audit logs by snapshot content
   * Uses GIN index on snapshot columns
   */
  async searchSnapshots(hotelId, searchValue, entityType = null, limit = 50) {
    let queryText = `
      SELECT * FROM audit_logs 
      WHERE hotel_id = $1 
        AND (
          snapshot_before::text ILIKE $2 
          OR snapshot_after::text ILIKE $2
        )
    `
    const params = [hotelId, `%${searchValue}%`]
    let paramIndex = 3
    
    if (entityType) {
      queryText += ` AND entity_type = $${paramIndex++}`
      params.push(entityType)
    }
    
    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(limit)
    
    const result = await query(queryText, params)
    return result.rows
  }

  /**
   * Clean old audit logs (for maintenance)
   * Keeps logs for the specified retention period
   */
  async cleanOldLogs(hotelId, retentionDays = 365) {
    const result = await query(`
      DELETE FROM audit_logs 
      WHERE hotel_id = $1 
        AND created_at < NOW() - INTERVAL '1 day' * $2
      RETURNING id
    `, [hotelId, retentionDays])
    
    return {
      deletedCount: result.rows.length,
      retentionDays
    }
  }
}

// Export singleton instance
export const auditService = new AuditService()

// Re-export logAudit from database.js for backward compatibility
export { logAudit }

// Export class for testing
export default AuditService
