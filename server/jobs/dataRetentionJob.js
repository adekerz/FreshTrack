/**
 * Data Retention Job
 * Implements GDPR data retention policy
 * Deletes old audit logs and expired verification codes
 */

import { query } from '../db/database.js'
import { logInfo, logError } from '../utils/logger.js'

let retentionInterval = null

export async function startDataRetentionJob() {
  // Запускать раз в день
  const intervalMs = 24 * 60 * 60 * 1000 // 24 hours
  
  const runRetention = async () => {
    try {
      logInfo('DataRetention', 'Running data retention cleanup...')
      
      // GDPR: Архивация audit logs старше 7 лет (legal minimum)
      // Используем архив вместо DELETE для сохранения hash chain
      const retentionYears = parseInt(process.env.DATA_RETENTION_YEARS) || 7
      
      // Archive old audit logs (preserves hash chain integrity)
      const result = await query(
        `SELECT archive_old_audit_logs($1) as archived_count`,
        [retentionYears]
      )
      
      const archivedCount = parseInt(result.rows[0].archived_count) || 0
      logInfo('DataRetention', `Archived ${archivedCount} old audit logs (older than ${retentionYears} years)`)
      
      // Clean up old MFA audit logs (older than 1 year)
      const mfaCutoffDate = new Date()
      mfaCutoffDate.setFullYear(mfaCutoffDate.getFullYear() - 1)
      
      const mfaResult = await query(`
        DELETE FROM mfa_audit_log
        WHERE created_at < $1
      `, [mfaCutoffDate])
      
      logInfo('DataRetention', `Deleted ${mfaResult.rowCount} old MFA audit logs`)
      
    } catch (error) {
      logError('DataRetention', 'Data retention job failed', error)
    }
  }
  
  // Run immediately on start (in production only)
  if (process.env.NODE_ENV === 'production') {
    // Wait 10 minutes before first run
    setTimeout(runRetention, 10 * 60 * 1000)
  }
  
  // Schedule periodic runs
  retentionInterval = setInterval(runRetention, intervalMs)
  
  logInfo('DataRetention', 'Data retention job started (runs daily)')
}

export function stopDataRetentionJob() {
  if (retentionInterval) {
    clearInterval(retentionInterval)
    retentionInterval = null
    logInfo('DataRetention', 'Data retention job stopped')
  }
}
