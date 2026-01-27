/**
 * Audit Verification Job
 * Periodically verifies audit trail integrity
 */

import { AuditIntegrityService } from '../services/AuditIntegrityService.js'
import { SecurityAlertService } from '../services/SecurityAlertService.js'
import { logInfo, logError, logWarn } from '../utils/logger.js'

let verificationInterval = null

export async function startAuditVerificationJob() {
  // Проверка integrity каждые 6 часов
  const intervalMs = parseInt(process.env.AUDIT_VERIFICATION_INTERVAL) || 6 * 60 * 60 * 1000 // 6 hours
  
  const runVerification = async () => {
    try {
      logInfo('AuditVerification', 'Starting audit trail verification...')
      
      // Проверяем последние 1000 записей
      const result = await AuditIntegrityService.verifyRecent(1000)
      
      if (result.valid) {
        logInfo('AuditVerification', `✓ Audit trail integrity verified (${result.totalRecords} records)`)
      } else {
        logWarn('AuditVerification', `✗ Audit trail integrity compromised!`, {
          errors: result.errors,
          totalRecords: result.totalRecords
        })
        
        // Send security alert to SUPER_ADMINs
        await SecurityAlertService.sendAlert('audit_integrity_violation', {
          totalRecords: result.totalRecords,
          errorsCount: result.errors.length,
          errors: result.errors.slice(0, 5), // First 5 errors
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      logError('AuditVerification', 'Audit verification job failed', error)
    }
  }
  
  // Run immediately on start (in production only)
  if (process.env.NODE_ENV === 'production') {
    // Wait 5 minutes before first run to let server stabilize
    setTimeout(runVerification, 5 * 60 * 1000)
  }
  
  // Schedule periodic runs
  verificationInterval = setInterval(runVerification, intervalMs)
  
  logInfo('AuditVerification', `Audit verification job started (runs every ${intervalMs / 1000 / 60} minutes)`)
}

export function stopAuditVerificationJob() {
  if (verificationInterval) {
    clearInterval(verificationInterval)
    verificationInterval = null
    logInfo('AuditVerification', 'Audit verification job stopped')
  }
}
