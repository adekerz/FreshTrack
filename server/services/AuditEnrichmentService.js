/**
 * Audit Enrichment Service
 * Human-readable metadata for audit logs (does not modify audit_logs table)
 */

import { query } from '../db/postgres.js'
import { logError, logInfo } from '../utils/logger.js'

let _UAParser = undefined
async function getUAParser() {
  if (_UAParser !== undefined) return _UAParser
  try {
    const m = await import('ua-parser-js')
    _UAParser = m.default
  } catch {
    _UAParser = null
  }
  return _UAParser
}

export class AuditEnrichmentService {
  /**
   * Generate human-readable description for a log entry
   */
  static generateHumanReadableDescription(log) {
    const action = (log.action || '').toUpperCase().replace(/-/g, '_')
    const entityType = (log.entity_type || '').toUpperCase()

    const actionMap = {
      CREATE: 'Создан',
      UPDATE: 'Обновлен',
      DELETE: 'Удален',
      LOGIN: 'Вход в систему',
      LOGOUT: 'Выход из системы',
      COLLECT: 'Выполнен сбор',
      PASSWORD_CHANGE: 'Изменен пароль',
      PASSWORD_RESET: 'Сброшен пароль',
      RESEND_PASSWORD: 'Повторно отправлен пароль',
      EMAIL_CHANGED: 'Изменен email',
      EMAIL_VERIFIED: 'Подтвержден email',
      ROLE_CHANGED: 'Изменена роль',
      MFA_ENABLED: 'Включена MFA',
      MFA_DISABLED: 'Отключена MFA',
      MFA_SETUP: 'Настроена MFA',
      EXPORT: 'Экспорт данных',
      IMPORT: 'Импорт данных',
      WRITE_OFF: 'Списание',
      SETTINGS_UPDATE: 'Изменены настройки',
      CLEAR_CACHE: 'Очищен кэш',
      USER_ACTIVATED: 'Активирован пользователь',
      USER_DEACTIVATED: 'Деактивирован пользователь',
      TOGGLE: 'Переключен статус',
      ASSIGN_MARSHA: 'Назначен MARSHA код',
      RELEASE_MARSHA: 'Освобожден MARSHA код',
      APPROVE_JOIN: 'Одобрена заявка',
      REJECT_JOIN: 'Отклонена заявка',
      GDPR_EXPORT: 'GDPR экспорт',
      GDPR_DELETE: 'GDPR удаление'
    }

    const entityMap = {
      PRODUCT: 'продукт',
      BATCH: 'партия',
      USER: 'пользователь',
      ACCOUNT: 'аккаунт',
      CATEGORY: 'категория',
      DEPARTMENT: 'отдел',
      HOTEL: 'отель',
      SETTINGS: 'настройки',
      SETTINGS_CACHE: 'кэш настроек',
      WRITE_OFF: 'списание',
      COLLECTION: 'сбор',
      MARSHA_CODE: 'MARSHA код',
      NOTIFICATION_RULE: 'правило уведомлений',
      TEMPLATE: 'шаблон',
      JOIN_REQUEST: 'заявка на вступление'
    }

    const actionText = actionMap[action] || action
    const entityText = entityMap[entityType] || entityType?.toLowerCase() || 'объект'

    const snapshotAfter = typeof log.snapshot_after === 'string' ? tryParse(log.snapshot_after) : log.snapshot_after
    const snapshotBefore = typeof log.snapshot_before === 'string' ? tryParse(log.snapshot_before) : log.snapshot_before
    const name = snapshotAfter?.name ?? snapshotBefore?.name ?? ''

    if (name) return `${actionText} ${entityText} "${name}"`
    return `${actionText} ${entityText}`
  }

  /**
   * Generate human-readable details (changes, etc.)
   */
  static generateHumanReadableDetails(log) {
    const action = (log.action || '').toUpperCase().replace(/-/g, '_')
    const snapshotAfter = typeof log.snapshot_after === 'string' ? tryParse(log.snapshot_after) : log.snapshot_after
    const snapshotBefore = typeof log.snapshot_before === 'string' ? tryParse(log.snapshot_before) : log.snapshot_before

    if (action === 'CREATE' && snapshotAfter) {
      const details = []
      if (snapshotAfter.name) details.push(`Название: ${snapshotAfter.name}`)
      if (snapshotAfter.quantity !== undefined) details.push(`Количество: ${snapshotAfter.quantity}`)
      if (snapshotAfter.unit) details.push(`Единица: ${snapshotAfter.unit}`)
      if (snapshotAfter.expiry_date) details.push(`Срок годности: ${snapshotAfter.expiry_date}`)
      if (snapshotAfter.category_name) details.push(`Категория: ${snapshotAfter.category_name}`)
      return details.length > 0 ? details.join(', ') : null
    }

    if (action === 'UPDATE' && snapshotBefore && snapshotAfter) {
      const changes = []
      const allKeys = new Set([...Object.keys(snapshotBefore), ...Object.keys(snapshotAfter)])
      const skipKeys = ['id', 'created_at', 'updated_at', 'hotel_id', '_snapshot_type', '_snapshot_time']

      for (const key of allKeys) {
        if (skipKeys.includes(key)) continue
        const oldVal = snapshotBefore[key]
        const newVal = snapshotAfter[key]
        if (oldVal !== newVal) {
          const fieldName = this.getFieldName(key)
          changes.push(`${fieldName}: ${oldVal} → ${newVal}`)
        }
      }
      return changes.length > 0 ? changes.join(', ') : 'Без изменений'
    }

    if (action === 'DELETE' && snapshotBefore) {
      return `Удален объект: ${snapshotBefore.name || 'без названия'}`
    }

    if (['LOGIN', 'LOGOUT'].includes(action) && log.ip_address) {
      return `IP: ${log.ip_address}`
    }

    return null
  }

  static getFieldName(key) {
    const fieldNames = {
      name: 'Название',
      quantity: 'Количество',
      unit: 'Единица',
      expiry_date: 'Срок годности',
      price: 'Цена',
      category_name: 'Категория',
      status: 'Статус',
      email: 'Email',
      role: 'Роль',
      is_active: 'Активность'
    }
    return fieldNames[key] || key
  }

  /**
   * Parse User-Agent (optional ua-parser-js)
   */
  static async parseUserAgent(userAgent) {
    if (!userAgent) return { browser_name: null, os_name: null, device_type: 'desktop' }
    const UAParser = await getUAParser()
    if (!UAParser) return { browser_name: null, os_name: null, device_type: 'desktop' }
    try {
      const parser = new UAParser(userAgent)
      const result = parser.getResult()
      return {
        browser_name: result.browser?.name || null,
        os_name: result.os?.name || null,
        device_type: result.device?.type || 'desktop'
      }
    } catch {
      return { browser_name: null, os_name: null, device_type: 'desktop' }
    }
  }

  /**
   * Get severity for action from DB or fallback
   */
  static async getSeverity(action, entityType) {
    try {
      const normAction = (action || '').toUpperCase().replace(/-/g, '_')
      const result = await query(
        'SELECT severity FROM audit_action_severity WHERE action = $1',
        [normAction]
      )
      if (result.rows?.length > 0) return result.rows[0].severity
      if (entityType?.toUpperCase() === 'USER') return 'important'
      if (normAction === 'DELETE') return 'critical'
      return 'normal'
    } catch (err) {
      return 'normal'
    }
  }

  /**
   * Enrich one audit log entry (create metadata row if missing)
   */
  static async enrichAuditLog(log) {
    if (!log?.id) return log
    try {
      const existing = await query(
        'SELECT id FROM audit_logs_metadata WHERE audit_log_id = $1',
        [log.id]
      )
      if (existing.rows?.length > 0) {
        const meta = await query(
          'SELECT * FROM audit_logs_metadata WHERE audit_log_id = $1',
          [log.id]
        )
        return { ...log, metadata: meta.rows[0] }
      }

      const description = this.generateHumanReadableDescription(log)
      const details = this.generateHumanReadableDetails(log)
      const uaData = await this.parseUserAgent(log.user_agent)
      const severity = await this.getSeverity(log.action, log.entity_type)

      const insert = await query(
        `INSERT INTO audit_logs_metadata (
          audit_log_id, human_readable_description, human_readable_details,
          severity, user_agent, browser_name, os_name, device_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          log.id,
          description,
          details,
          severity,
          log.user_agent || null,
          uaData.browser_name,
          uaData.os_name,
          uaData.device_type
        ]
      )
      return { ...log, metadata: insert.rows[0] }
    } catch (err) {
      logError('AuditEnrichmentService.enrichAuditLog', err)
      return log
    }
  }

  /**
   * Bulk enrich existing logs (no metadata yet)
   */
  static async enrichExistingLogs(limit = 1000) {
    try {
      logInfo('AuditEnrichmentService', `Starting enrichment of up to ${limit} logs`)

      const result = await query(
        `SELECT al.*
         FROM audit_logs al
         LEFT JOIN audit_logs_metadata alm ON al.id = alm.audit_log_id
         WHERE alm.id IS NULL AND al.archived = FALSE
         ORDER BY al.created_at DESC
         LIMIT $1`,
        [limit]
      )
      const rows = result.rows || []

      for (const log of rows) {
        const parsed = { ...log }
        if (parsed.snapshot_after && typeof parsed.snapshot_after === 'string') {
          try { parsed.snapshot_after = JSON.parse(parsed.snapshot_after) } catch {}
        }
        if (parsed.snapshot_before && typeof parsed.snapshot_before === 'string') {
          try { parsed.snapshot_before = JSON.parse(parsed.snapshot_before) } catch {}
        }
        await this.enrichAuditLog(parsed)
      }

      logInfo('AuditEnrichmentService', `Enriched ${rows.length} logs`)
      return { success: true, enriched: rows.length }
    } catch (err) {
      logError('AuditEnrichmentService.enrichExistingLogs', err)
      throw err
    }
  }
}

function tryParse(str) {
  if (!str) return null
  try {
    return typeof str === 'string' ? JSON.parse(str) : str
  } catch {
    return null
  }
}
