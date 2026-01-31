/**
 * Cleanup Jobs
 * Periodic cleanup tasks for expired verification codes, etc.
 */

import { query } from '../db/postgres.js'
import { logInfo } from '../utils/logger.js'
import cron from 'node-cron'

/**
 * Cleanup expired verification data (OTP only; ссылки не используются)
 * Runs every hour
 */
export async function cleanupExpiredVerificationCodes() {
  try {
    // Очистка истёкших OTP (email_verification_otp_expires < now) — опционально, verify уже очищает
    const result = await query(`
      UPDATE users 
      SET email_verification_otp = NULL,
          email_verification_otp_expires = NULL
      WHERE email_verification_otp_expires IS NOT NULL
        AND email_verification_otp_expires < NOW()
    `)
    if (result.rowCount > 0) {
      logInfo('Cleanup', `Cleaned up ${result.rowCount} expired OTP verification records`)
    }
  } catch (error) {
    if (!error.message?.includes('does not exist')) {
      console.error('Cleanup expired codes error:', error)
    }
  }
}

/**
 * Start cleanup jobs
 */
export function startCleanupJobs() {
  // Run cleanup every hour
  cron.schedule('0 * * * *', cleanupExpiredVerificationCodes)
  logInfo('Cleanup', 'Cleanup jobs started (runs every hour)')
  
  // Run immediately on startup
  cleanupExpiredVerificationCodes()
}
