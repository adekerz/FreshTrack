/**
 * Audit Integrity Service
 * Verifies hash chain integrity to detect tampering
 */

import { query } from '../db/database.js'
import crypto from 'crypto'
import { logError, logInfo, logWarn } from '../utils/logger.js'

export class AuditIntegrityService {
  
  /**
   * Верификация всей цепи (expensive operation!)
   * @param {Date} startDate - Optional start date filter
   * @param {Date} endDate - Optional end date filter
   * @param {Array} rows - Optional pre-fetched rows (for testing)
   */
  static async verifyChain(startDate = null, endDate = null, rows = null) {
    try {
      if (!rows) {
        let queryText = `
          SELECT id, entity_type, entity_id, action, user_id, 
                 snapshot_after, created_at, previous_hash, current_hash
          FROM audit_logs
          WHERE archived = FALSE
        `
        
        const params = []
        if (startDate && endDate) {
          queryText += ` AND created_at BETWEEN $1 AND $2`
          params.push(startDate, endDate)
        }
        
        queryText += ` ORDER BY created_at ASC`
        
        const result = await query(queryText, params)
        rows = result.rows
      }
      
      if (rows.length === 0) {
        return { valid: true, errors: [], totalRecords: 0 }
      }
      
      const errors = []
      let expectedPreviousHash = '0000000000000000000000000000000000000000000000000000000000000000'
      
      for (const row of rows) {
        // Проверяем previous_hash
        if (row.previous_hash !== expectedPreviousHash) {
          errors.push({
            id: row.id,
            type: 'broken_chain',
            expected: expectedPreviousHash,
            actual: row.previous_hash,
            timestamp: row.created_at
          })
        }
        
        // Пересчитываем current_hash
        const calculatedHash = this.calculateHash(row)
        
        if (calculatedHash !== row.current_hash) {
          errors.push({
            id: row.id,
            type: 'tampered_data',
            expected: calculatedHash,
            actual: row.current_hash,
            timestamp: row.created_at
          })
          
          // Помечаем как скомпрометированный
          await query(
            'UPDATE audit_logs SET verified = FALSE WHERE id = $1',
            [row.id]
          )
        }
        
        expectedPreviousHash = row.current_hash
      }
      
      // Check for archived records in date range (if specified)
      let archivedRecordsSkipped = 0
      if (startDate && endDate) {
        try {
          const archivedResult = await query(`
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE archived = TRUE 
              AND created_at BETWEEN $1 AND $2
          `, [startDate, endDate])
          
          archivedRecordsSkipped = parseInt(archivedResult.rows[0]?.count || 0)
          
          if (archivedRecordsSkipped > 0) {
            logWarn('AuditIntegrity', `Verification skipped ${archivedRecordsSkipped} archived records in date range`)
          }
        } catch (error) {
          logWarn('AuditIntegrity', 'Failed to count archived records', error)
        }
      }
      
      return {
        valid: errors.length === 0,
        totalRecords: rows.length,
        archivedRecordsSkipped,
        errors
      }
    } catch (error) {
      logError('AuditIntegrity', 'Failed to verify chain', error)
      throw error
    }
  }
  
  /**
   * Вычисление хеша (должно совпадать с БД функцией)
   */
  static calculateHash(entry) {
    const data = 
      entry.id +
      (entry.entity_type || '') +
      (entry.entity_id || '') +
      (entry.action || '') +
      (entry.user_id || '') +
      JSON.stringify(entry.snapshot_after || {}) +
      entry.created_at.toISOString() +
      (entry.previous_hash || '0000000000000000000000000000000000000000000000000000000000000000')
    
    return crypto.createHash('sha256').update(data).digest('hex')
  }
  
  /**
   * Быстрая проверка последних N записей
   */
  static async verifyRecent(limit = 100) {
    try {
      const { rows } = await query(`
        SELECT id, entity_type, entity_id, action, user_id,
               snapshot_after, created_at, previous_hash, current_hash
        FROM audit_logs
        WHERE archived = FALSE
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit])
      
      // Reverse to get chronological order
      return this.verifyChain(null, null, rows.reverse())
    } catch (error) {
      logError('AuditIntegrity', 'Failed to verify recent entries', error)
      throw error
    }
  }
  
  /**
   * Export audit trail для external verification
   */
  static async exportForVerification(hotelId, startDate, endDate) {
    try {
      const { rows } = await query(`
        SELECT id, entity_type, entity_id, action, 
               created_at, previous_hash, current_hash,
               user_id, snapshot_after
        FROM audit_logs
        WHERE hotel_id = $1
          AND created_at BETWEEN $2 AND $3
          AND archived = FALSE
        ORDER BY created_at ASC
      `, [hotelId, startDate, endDate])
      
      // JSON Lines format для streaming
      const jsonLines = rows.map(row => JSON.stringify(row)).join('\n')
      
      return {
        format: 'jsonl',
        data: jsonLines,
        metadata: {
          hotelId,
          startDate,
          endDate,
          totalRecords: rows.length,
          exportedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      logError('AuditIntegrity', 'Failed to export audit trail', error)
      throw error
    }
  }
  
  /**
   * Get integrity status summary
   */
  static async getIntegrityStatus() {
    try {
      const totalResult = await query('SELECT COUNT(*) as count FROM audit_logs WHERE archived = FALSE')
      const unverifiedResult = await query(
        'SELECT COUNT(*) as count FROM audit_logs WHERE verified = FALSE AND archived = FALSE'
      )
      const stateResult = await query(
        'SELECT last_hash, last_entry_id, updated_at FROM audit_chain_state WHERE id = 1'
      )
      
      return {
        totalEntries: parseInt(totalResult.rows[0].count),
        unverifiedEntries: parseInt(unverifiedResult.rows[0].count),
        chainState: stateResult.rows[0] || null,
        status: parseInt(unverifiedResult.rows[0].count) > 0 ? 'compromised' : 'healthy'
      }
    } catch (error) {
      logError('AuditIntegrity', 'Failed to get integrity status', error)
      throw error
    }
  }
}
