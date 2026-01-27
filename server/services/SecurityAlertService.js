/**
 * Security Alert Service
 * Sends security alerts to SUPER_ADMIN users
 */

import { query } from '../db/database.js'
import { logError, logInfo } from '../utils/logger.js'
import { sendEmail } from './EmailService.js'
import { logAudit } from '../db/database.js'

export class SecurityAlertService {
  
  /**
   * Send security alert to all SUPER_ADMIN users
   */
  static async sendAlert(type, details) {
    try {
      const admins = await this.getSuperAdmins()
      
      if (admins.length === 0) {
        logError('SecurityAlert', 'No SUPER_ADMIN users found to send alerts')
        return
      }
      
      const alertConfig = this.getAlertConfig(type)
      
      for (const admin of admins) {
        try {
          await sendEmail({
            to: admin.email,
            subject: alertConfig.subject,
            html: this.generateAlertEmail(type, details, alertConfig.priority)
          })
          
          logInfo('SecurityAlert', `Alert sent to ${admin.email}: ${type}`)
        } catch (emailError) {
          logError('SecurityAlert', `Failed to send alert to ${admin.email}`, emailError)
        }
      }
      
      // Log to audit
      await logAudit({
        hotel_id: null,
        user_id: null,
        user_name: 'System',
        action: 'security_alert',
        entity_type: 'SECURITY_ALERT',
        entity_id: type,
        details: {
          type,
          details,
          sentTo: admins.map(a => a.email),
          timestamp: new Date().toISOString()
        },
        ip_address: null
      })
    } catch (error) {
      logError('SecurityAlert', 'Failed to send security alert', error)
    }
  }
  
  /**
   * Get SUPER_ADMIN users
   */
  static async getSuperAdmins() {
    try {
      const { rows } = await query(`
        SELECT id, email, name
        FROM users
        WHERE role = 'SUPER_ADMIN'
          AND is_active = TRUE
          AND email IS NOT NULL
      `)
      return rows
    } catch (error) {
      logError('SecurityAlert', 'Failed to get SUPER_ADMIN users', error)
      return []
    }
  }
  
  /**
   * Get alert configuration
   */
  static getAlertConfig(type) {
    const configs = {
      'audit_integrity_violation': {
        subject: '🚨 CRITICAL: Audit Trail Integrity Compromised',
        priority: 'CRITICAL'
      },
      'export_suspicious': {
        subject: '⚠️ WARNING: Suspicious Data Export Detected',
        priority: 'HIGH'
      },
      'mfa_bypass_attempt': {
        subject: '⚠️ WARNING: MFA Bypass Attempt',
        priority: 'HIGH'
      },
      'multiple_failed_mfa': {
        subject: '⚠️ WARNING: Multiple Failed MFA Attempts',
        priority: 'MEDIUM'
      }
    }
    
    return configs[type] || {
      subject: '⚠️ Security Alert',
      priority: 'MEDIUM'
    }
  }
  
  /**
   * Generate alert email HTML
   */
  static generateAlertEmail(type, details, priority) {
    const priorityColor = priority === 'CRITICAL' ? '#dc2626' : '#ea580c'
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: monospace; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { border-left: 4px solid ${priorityColor}; padding-left: 16px; margin-bottom: 24px; }
          .details { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="color: ${priorityColor}; margin: 0;">Security Alert: ${type}</h2>
          <p><strong>Priority:</strong> ${priority}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
        <hr>
        <div class="details">
          <h3>Details:</h3>
          <pre>${JSON.stringify(details, null, 2)}</pre>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated security alert from FreshTrack.
        </p>
      </body>
      </html>
    `
  }
}
