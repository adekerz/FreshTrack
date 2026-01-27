/**
 * Cleanup Jobs
 * Periodic cleanup tasks for expired verification codes, etc.
 */

import { query } from '../db/postgres.js'
import { logInfo } from '../utils/logger.js'
import cron from 'node-cron'

/**
 * Cleanup expired email verification tokens
 * Runs every hour
 * Note: After migration 043, departments no longer use code-based verification
 * Users use link-based verification with email_verification_token (migration 045)
 */
export async function cleanupExpiredVerificationCodes() {
  try {
    // Check if email_verification_token column exists (migration 045)
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
        AND column_name = 'email_verification_token'
    `)
    
    if (columnCheck.rows.length === 0) {
      // Column doesn't exist yet, migration 045 not applied
      return
    }
    
    // Cleanup expired user verification tokens (older than 7 days)
    const expiredDate = new Date()
    expiredDate.setDate(expiredDate.getDate() - 7)
    
    const userResult = await query(`
      UPDATE users 
      SET email_verification_token = NULL
      WHERE email_verification_token IS NOT NULL
        AND created_at < $1
    `, [expiredDate])
    
    if (userResult.rowCount > 0) {
      logInfo('Cleanup', `Cleaned up ${userResult.rowCount} expired user verification tokens`)
    }
  } catch (error) {
    // Only log if it's not a "column doesn't exist" error
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
