/**
 * Audit Logs SSE (Server-Sent Events)
 * Real-time stream of new audit log entries to connected clients
 */

import { query } from '../../db/postgres.js'
import { logInfo, logError } from '../../utils/logger.js'

export const sseConnections = new Map()

/**
 * Parse audit row (details, snapshots JSON)
 */
function parseAuditRow(row) {
  const parsed = { ...row }
  if (parsed.details && typeof parsed.details === 'string') {
    try {
      parsed.details = JSON.parse(parsed.details)
    } catch {}
  }
  if (parsed.snapshot_after && typeof parsed.snapshot_after === 'string') {
    try {
      parsed.snapshot_after = JSON.parse(parsed.snapshot_after)
    } catch {}
  }
  if (parsed.snapshot_before && typeof parsed.snapshot_before === 'string') {
    try {
      parsed.snapshot_before = JSON.parse(parsed.snapshot_before)
    } catch {}
  }
  return parsed
}

/**
 * GET /api/audit-logs/stream — SSE endpoint
 * Requires auth (token in query for EventSource), hotelIsolation, audit read permission
 */
export async function auditLogsSSE(req, res) {
  const hotelId = req.hotelId
  const role = req.user?.role

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const clientId = `${req.user.id}-${Date.now()}`

  sseConnections.set(clientId, { res, hotelId, role })

  logInfo('SSE', `Client connected: ${clientId}`)

  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`)

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
    } catch {
      clearInterval(heartbeat)
      sseConnections.delete(clientId)
    }
  }, 30000)

  req.on('close', () => {
    clearInterval(heartbeat)
    sseConnections.delete(clientId)
    logInfo('SSE', `Client disconnected: ${clientId}`)
  })
}

/**
 * Enrich audit log for broadcast (metadata + user/department names)
 */
async function enrichLogForBroadcast(log) {
  if (!log?.id) return log

  const { rows } = await query(
    `SELECT al.*,
       u.name as user_name_join, u.login as user_login_join,
       d.name as department_name,
       alm.human_readable_description, alm.human_readable_details, alm.severity,
       alm.browser_name, alm.os_name, alm.device_type
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN audit_logs_metadata alm ON al.id = alm.audit_log_id
     WHERE al.id = $1`,
    [log.id]
  )

  const row = rows[0]
  if (!row) return parseAuditRow({ ...log })

  const parsed = parseAuditRow(row)
  parsed.user_name = parsed.user_name || row.user_name_join || row.user_login_join
  parsed.department_name = row.department_name
  parsed.human_readable_description = parsed.human_readable_description ?? row.human_readable_description
  parsed.human_readable_details = parsed.human_readable_details ?? row.human_readable_details
  return parsed
}

/**
 * Broadcast new audit log to connected clients (same hotel or SUPER_ADMIN)
 */
export async function broadcastAuditLog(auditLog) {
  if (!auditLog?.hotel_id && auditLog?.hotelId) {
    auditLog.hotel_id = auditLog.hotelId
  }

  const enrichedLog = await enrichLogForBroadcast(auditLog)

  for (const [clientId, connection] of sseConnections.entries()) {
    try {
      const canSee =
        connection.role === 'SUPER_ADMIN' ||
        connection.hotelId === enrichedLog.hotel_id

      if (canSee) {
        connection.res.write(
          `data: ${JSON.stringify({ type: 'new_log', log: enrichedLog })}\n\n`
        )
      }
    } catch (error) {
      logError('SSE Broadcast', error)
      sseConnections.delete(clientId)
    }
  }
}
