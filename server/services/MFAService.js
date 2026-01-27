/**
 * MFA Service
 * Handles TOTP-based multi-factor authentication
 */

import { authenticator } from 'otplib'
import qrcode from 'qrcode'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { query } from '../db/database.js'
import { logError, logInfo } from '../utils/logger.js'

// Configure TOTP
authenticator.options = {
  window: [1, 1], // Allow 1 step clock skew
  step: 30 // 30 second time steps
}

export class MFAService {
  
  /**
   * Генерация секрета и QR кода
   */
  static async setupMFA(userId, userName) {
    try {
      const secret = authenticator.generateSecret()
      const issuer = process.env.MFA_ISSUER || 'FreshTrack'
      const otpauth = authenticator.keyuri(userName, issuer, secret)
      
      // Генерация backup кодов (10 штук, 8 символов)
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      )
      
      // Hash backup кодов перед сохранением
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => bcrypt.hash(code, 10))
      )
      
      // Временное сохранение (не активировано пока пользователь не подтвердит)
      await query(
        `UPDATE users 
         SET mfa_secret = $1, mfa_backup_codes = $2, mfa_enabled = FALSE
         WHERE id = $3`,
        [secret, hashedBackupCodes, userId]
      )
      
      // Генерация QR кода
      const qrCodeDataUrl = await qrcode.toDataURL(otpauth)
      
      // Audit log
      await this.logMFAEvent(userId, 'setup', null, null, true)
      
      logInfo('MFA', `MFA setup initiated for user ${userId}`)
      
      return {
        secret, // показываем один раз для manual entry
        qrCode: qrCodeDataUrl,
        backupCodes // показываем один раз, пользователь должен сохранить
      }
    } catch (error) {
      logError('MFA', `Failed to setup MFA for user ${userId}`, error)
      throw error
    }
  }
  
  /**
   * Верификация TOTP кода
   */
  static async verifyTOTP(userId, token, ipAddress, userAgent) {
    try {
      const { rows } = await query(
        'SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1',
        [userId]
      )
      
      if (rows.length === 0 || !rows[0].mfa_secret) {
        throw new Error('MFA not set up')
      }
      
      const { mfa_secret } = rows[0]
      
      // Проверка rate limiting (5 попыток в час)
      // Используем индекс idx_mfa_audit_failures для быстрого поиска
      const recentFailures = await query(
        `SELECT COUNT(*) as count FROM mfa_audit_log 
         WHERE user_id = $1 
           AND event_type = 'verify_fail' 
           AND created_at > NOW() - INTERVAL '1 hour'`,
        [userId]
      )
      
      if (parseInt(recentFailures.rows[0].count) >= 5) {
        await this.logMFAEvent(userId, 'verify_fail', ipAddress, userAgent, false)
        throw new Error('Too many failed attempts. Try again in 1 hour.')
      }
      
      // Верификация токена (с window для clock skew)
      const isValid = authenticator.verify({
        token,
        secret: mfa_secret
      })
      
      await this.logMFAEvent(
        userId, 
        isValid ? 'verify_success' : 'verify_fail', 
        ipAddress, 
        userAgent, 
        isValid
      )
      
      if (!isValid) {
        throw new Error('Invalid verification code')
      }
      
      logInfo('MFA', `MFA verification successful for user ${userId}`)
      return true
    } catch (error) {
      logError('MFA', `MFA verification failed for user ${userId}`, error)
      throw error
    }
  }
  
  /**
   * Верификация backup кода
   */
  static async verifyBackupCode(userId, code, ipAddress, userAgent) {
    try {
      const { rows } = await query(
        'SELECT mfa_backup_codes FROM users WHERE id = $1',
        [userId]
      )
      
      if (rows.length === 0 || !rows[0].mfa_backup_codes) {
        throw new Error('No backup codes available')
      }
      
      const hashedCodes = rows[0].mfa_backup_codes || []
      
      // Проверяем каждый хеш
      for (let i = 0; i < hashedCodes.length; i++) {
        const isMatch = await bcrypt.compare(code, hashedCodes[i])
        
        if (isMatch) {
          // Удаляем использованный код
          const updatedCodes = hashedCodes.filter((_, idx) => idx !== i)
          
          await query(
            'UPDATE users SET mfa_backup_codes = $1 WHERE id = $2',
            [updatedCodes, userId]
          )
          
          await this.logMFAEvent(userId, 'backup_used', ipAddress, userAgent, true)
          
          logInfo('MFA', `Backup code used for user ${userId}`)
          return true
        }
      }
      
      await this.logMFAEvent(userId, 'verify_fail', ipAddress, userAgent, false)
      throw new Error('Invalid backup code')
    } catch (error) {
      logError('MFA', `Backup code verification failed for user ${userId}`, error)
      throw error
    }
  }
  
  /**
   * Финализация setup (после первой успешной верификации)
   */
  static async enableMFA(userId) {
    try {
      await query(
        'UPDATE users SET mfa_enabled = TRUE WHERE id = $1',
        [userId]
      )
      
      logInfo('MFA', `MFA enabled for user ${userId}`)
    } catch (error) {
      logError('MFA', `Failed to enable MFA for user ${userId}`, error)
      throw error
    }
  }
  
  /**
   * Отключение MFA (требует TOTP verification)
   */
  static async disableMFA(userId, token, ipAddress, userAgent) {
    try {
      await this.verifyTOTP(userId, token, ipAddress, userAgent)
      
      await query(
        `UPDATE users 
         SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_backup_codes = NULL 
         WHERE id = $1`,
        [userId]
      )
      
      await this.logMFAEvent(userId, 'disable', ipAddress, userAgent, true)
      
      logInfo('MFA', `MFA disabled for user ${userId}`)
    } catch (error) {
      logError('MFA', `Failed to disable MFA for user ${userId}`, error)
      throw error
    }
  }
  
  /**
   * Audit logging
   */
  static async logMFAEvent(userId, eventType, ipAddress, userAgent, success) {
    try {
      await query(
        `INSERT INTO mfa_audit_log (user_id, event_type, ip_address, user_agent, success)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, eventType, ipAddress || null, userAgent || null, success]
      )
    } catch (error) {
      logError('MFA', `Failed to log MFA event`, error)
      // Don't throw - audit logging failure shouldn't break the flow
    }
  }
  
  /**
   * Check if MFA is required for user
   */
  static async isMFARequired(userId) {
    try {
      const { rows } = await query(
        'SELECT mfa_required, mfa_enabled FROM users WHERE id = $1',
        [userId]
      )
      
      if (rows.length === 0) return false
      
      return rows[0].mfa_required && !rows[0].mfa_enabled
    } catch (error) {
      logError('MFA', `Failed to check MFA requirement for user ${userId}`, error)
      return false
    }
  }
}
