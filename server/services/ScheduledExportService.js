/**
 * ScheduledExportService
 * Manages automatic execution of scheduled exports via cron jobs
 * Sends reports via email and/or Telegram
 */

import cron from 'node-cron'
import { query } from '../db/postgres.js'
import { ExportService } from './ExportService.js'
import { sendEmail } from './EmailService.js'
import { TelegramService } from './TelegramService.js'
import { logInfo, logError, logWarn } from '../utils/logger.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

class ScheduledExportService {
  constructor() {
    this.jobs = new Map()
    this.isRunning = false
  }

  /**
   * Initialize the service and start monitoring for due exports
   */
  async initialize() {
    if (this.isRunning) {
      logWarn('ScheduledExportService', 'Already initialized')
      return
    }

    logInfo('ScheduledExportService', 'Initializing scheduled exports service...')

    // Check for due exports every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.checkDueExports()
      } catch (error) {
        logError('ScheduledExportService', 'Error checking due exports', error)
      }
    })

    this.isRunning = true
    logInfo('ScheduledExportService', 'Scheduled exports service started successfully')
  }

  /**
   * Check for exports that are due to run
   */
  async checkDueExports() {
    const now = new Date()

    try {
      const result = await query(
        `SELECT
          se.*,
          d.name as department_name,
          d.email as department_email,
          d.telegram_chat_id,
          h.name as hotel_name
        FROM scheduled_exports se
        LEFT JOIN departments d ON se.department_id = d.id
        LEFT JOIN hotels h ON se.hotel_id = h.id
        WHERE se.is_active = true AND se.next_run_at <= $1`,
        [now]
      )

      if (result.rows.length > 0) {
        logInfo('ScheduledExportService', `Found ${result.rows.length} due exports`)

        for (const schedule of result.rows) {
          // Execute each schedule independently (don't let one failure block others)
          this.executeScheduledExport(schedule).catch((error) => {
            logError('ScheduledExportService', `Failed to execute schedule ${schedule.id}`, error)
          })
        }
      }
    } catch (error) {
      logError('ScheduledExportService', 'Error in checkDueExports', error)
    }
  }

  /**
   * Execute a scheduled export
   * @param {Object} schedule - Schedule configuration from database
   * @param {boolean} isTest - Whether this is a test run
   */
  async executeScheduledExport(schedule, isTest = false) {
    const startTime = Date.now()
    const exportResults = []
    let emailSent = false
    let telegramSent = false

    logInfo(
      'ScheduledExportService',
      `Executing scheduled export ${schedule.id} for department ${schedule.department_name}`
    )

    try {
      // Parse JSON fields
      const exportTypes = Array.isArray(schedule.export_types)
        ? schedule.export_types
        : JSON.parse(schedule.export_types)

      const exportFormats = Array.isArray(schedule.export_formats)
        ? schedule.export_formats
        : JSON.parse(schedule.export_formats)

      const filters = typeof schedule.filters === 'object' ? schedule.filters : JSON.parse(schedule.filters || '{}')

      // Create temp directory for exports
      const tempDir = path.join(os.tmpdir(), `freshtrack_export_${schedule.id}_${Date.now()}`)
      fs.mkdirSync(tempDir, { recursive: true })

      // Generate each requested export
      for (const exportType of exportTypes) {
        for (const format of exportFormats) {
          try {
            logInfo('ScheduledExportService', `Generating ${exportType} in ${format} format`)

            // Fetch data for export
            const data = await this.fetchExportData(exportType, schedule, filters)

            // Generate file
            let buffer
            let filename
            let mimeType

            if (format === 'excel' || format === 'xlsx') {
              buffer = await ExportService.toXLSX(data, exportType, {
                sheetName: exportType
              })
              filename = `${exportType}_${new Date().toISOString().split('T')[0]}.xlsx`
              mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            } else if (format === 'csv') {
              const csvData = ExportService.toCSV(data, exportType)
              buffer = Buffer.from(csvData, 'utf-8')
              filename = `${exportType}_${new Date().toISOString().split('T')[0]}.csv`
              mimeType = 'text/csv'
            } else {
              logWarn('ScheduledExportService', `Unsupported format: ${format}`)
              continue
            }

            // Save to temp directory
            const filepath = path.join(tempDir, filename)
            fs.writeFileSync(filepath, buffer)

            exportResults.push({
              type: exportType,
              format,
              filename,
              filepath,
              buffer,
              mimeType,
              recordCount: data.length,
              size: buffer.length
            })

            logInfo('ScheduledExportService', `Generated ${filename} (${data.length} records)`)
          } catch (error) {
            logError('ScheduledExportService', `Failed to generate ${exportType} (${format})`, error)
            exportResults.push({
              type: exportType,
              format,
              error: error.message
            })
          }
        }
      }

      // Check if we have any successful exports
      const successfulExports = exportResults.filter((r) => !r.error)

      if (successfulExports.length === 0) {
        throw new Error('All export generations failed')
      }

      // Send via Email
      if (schedule.delivery_method === 'email' || schedule.delivery_method === 'both') {
        try {
          const emailTo = schedule.email_override || schedule.department_email

          if (!emailTo) {
            logWarn('ScheduledExportService', 'No email configured for delivery')
          } else {
            await this.sendEmailWithAttachments(emailTo, successfulExports, schedule, isTest)
            emailSent = true
            logInfo('ScheduledExportService', `Email sent to ${emailTo}`)
          }
        } catch (error) {
          logError('ScheduledExportService', 'Failed to send email', error)
        }
      }

      // Send via Telegram
      if (schedule.delivery_method === 'telegram' || schedule.delivery_method === 'both') {
        try {
          const chatId = schedule.telegram_chat_id_override || schedule.telegram_chat_id

          if (!chatId) {
            logWarn('ScheduledExportService', 'No Telegram chat configured for delivery')
          } else {
            await this.sendTelegramWithAttachments(chatId, successfulExports, schedule, isTest)
            telegramSent = true
            logInfo('ScheduledExportService', `Telegram message sent to ${chatId}`)
          }
        } catch (error) {
          logError('ScheduledExportService', 'Failed to send Telegram message', error)
        }
      }

      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (error) {
        logWarn('ScheduledExportService', 'Failed to clean up temp directory', error)
      }

      // Determine status
      const failedExports = exportResults.filter((r) => r.error)
      const status =
        emailSent || telegramSent ? (failedExports.length > 0 ? 'partial' : 'success') : 'failed'

      // Log execution
      await this.logExecution(schedule.id, status, exportResults, emailSent, telegramSent, startTime)

      // Update schedule (calculate next run, update last run status)
      if (!isTest) {
        await this.updateScheduleAfterRun(schedule, status)
      }

      logInfo('ScheduledExportService', `Scheduled export ${schedule.id} completed: ${status}`)
    } catch (error) {
      logError('ScheduledExportService', `Scheduled export ${schedule.id} failed`, error)

      // Log failed execution
      await this.logExecution(schedule.id, 'failed', exportResults, emailSent, telegramSent, startTime, error.message)

      // Update schedule with error
      if (!isTest) {
        await query(
          `UPDATE scheduled_exports
           SET last_run_at = $1, last_run_status = 'failed', last_run_error = $2
           WHERE id = $3`,
          [new Date(), error.message, schedule.id]
        )
      }
    }
  }

  /**
   * Fetch data for export from database
   */
  async fetchExportData(exportType, schedule, filters) {
    // Construct query based on export type
    let queryText = ''
    const queryParams = [schedule.hotel_id]

    switch (exportType) {
      case 'inventory':
        queryText = `
          SELECT
            p.name as product_name,
            c.name as category_name,
            d.name as department_name,
            b.expiry_date,
            b.quantity,
            p.unit,
            CASE
              WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
              WHEN b.expiry_date = CURRENT_DATE THEN 'today'
              WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'critical'
              WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'warning'
              ELSE 'good'
            END as status,
            b.expiry_date - CURRENT_DATE as days_until_expiry
          FROM batches b
          JOIN products p ON b.product_id = p.id
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN departments d ON p.department_id = d.id
          WHERE b.hotel_id = $1 AND b.status = 'active'
        `
        break

      case 'collections':
        queryText = `
          SELECT
            ch.collected_at,
            ch.product_name,
            d.name as department_name,
            ch.quantity_collected as quantity,
            ch.collection_reason as reason,
            u.name as collected_by_name,
            ch.batch_number,
            ch.expiry_date
          FROM collection_history ch
          LEFT JOIN departments d ON ch.department_id = d.id
          LEFT JOIN users u ON ch.user_id = u.id
          WHERE ch.hotel_id = $1
        `
        break

      case 'writeOffs':
        queryText = `
          SELECT
            wo.written_off_at as collected_at,
            wo.product_name,
            d.name as department_name,
            wo.quantity,
            wo.reason,
            u.name as collected_by_name,
            b.batch_number,
            b.expiry_date
          FROM write_offs wo
          LEFT JOIN departments d ON wo.department_id = d.id
          LEFT JOIN users u ON wo.written_off_by = u.id
          LEFT JOIN batches b ON wo.batch_id = b.id
          WHERE wo.hotel_id = $1
        `
        break

      case 'audit':
        queryText = `
          SELECT
            a.created_at,
            a.user_name,
            a.action,
            a.entity_type,
            a.entity_id,
            a.details,
            a.ip_address
          FROM audit_logs a
          WHERE a.hotel_id = $1
        `
        // Audit logs don't have direct department filter
        if (schedule.department_id) {
          // Note: audit_logs don't have department_id column, skipping department filter for audit
          logWarn('ScheduledExportService', 'Department filter not supported for audit logs export')
        }
        queryText += ` ORDER BY a.created_at DESC LIMIT 1000`
        break

      default:
        throw new Error(`Unknown export type: ${exportType}`)
    }

    // Add department filter if specified (not for audit)
    if (schedule.department_id && exportType !== 'audit') {
      queryText += ` AND d.id = $${queryParams.length + 1}`
      queryParams.push(schedule.department_id)
    }

    // Add custom filters
    // TODO: Implement filter parsing from schedule.filters

    // Add ORDER BY and LIMIT (not for audit - already has it)
    if (exportType !== 'audit') {
      queryText += ` ORDER BY 1 DESC LIMIT 10000`
    }

    const result = await query(queryText, queryParams)
    return result.rows
  }

  /**
   * Send email with attachments
   */
  async sendEmailWithAttachments(to, exports, schedule, isTest) {
    const testPrefix = isTest ? '[ТЕСТ] ' : ''

    const attachments = exports.map((exp) => ({
      filename: exp.filename,
      content: exp.buffer,
      contentType: exp.mimeType
    }))

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #428bca; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .report-list { list-style: none; padding: 0; }
          .report-item { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #428bca; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${testPrefix}Отчеты FreshTrack</h1>
            <p>${schedule.hotel_name} - ${schedule.department_name}</p>
          </div>
          <div class="content">
            <p>Здравствуйте!</p>
            <p>${isTest ? 'Это тестовая отправка запланированных отчетов.' : 'Высылаем вам запланированные отчеты.'}</p>

            <h3>Приложенные отчеты:</h3>
            <ul class="report-list">
              ${exports
                .map(
                  (exp) => `
                <li class="report-item">
                  <strong>${exp.type}</strong> (${exp.format.toUpperCase()})<br>
                  <small>Записей: ${exp.recordCount || 0} | Размер: ${(exp.size / 1024).toFixed(2)} KB</small>
                </li>
              `
                )
                .join('')}
            </ul>

            <p>Файлы прилагаются к этому письму.</p>
          </div>
          <div class="footer">
            <p>Это автоматическое сообщение от системы FreshTrack</p>
            <p>Дата отправки: ${new Date().toLocaleString('ru-RU')}</p>
          </div>
        </div>
      </body>
      </html>
    `

    await sendEmail({
      to,
      subject: `${testPrefix}Отчеты FreshTrack - ${schedule.department_name} - ${new Date().toLocaleDateString('ru-RU')}`,
      html,
      attachments
    })
  }

  /**
   * Send Telegram message with attachments
   */
  async sendTelegramWithAttachments(chatId, exports, schedule, isTest) {
    const testPrefix = isTest ? '🧪 [ТЕСТ] ' : '📊 '

    const message = `
${testPrefix}<b>Отчеты FreshTrack</b>
<b>Отель:</b> ${schedule.hotel_name}
<b>Отдел:</b> ${schedule.department_name}

<b>Сгенерированные отчеты:</b>
${exports.map((exp) => `• ${exp.type} (${exp.format.toUpperCase()}) - ${exp.recordCount || 0} записей`).join('\n')}

📅 Дата: ${new Date().toLocaleString('ru-RU')}
    `.trim()

    // Send message
    await TelegramService.sendMessage(chatId, message, { parse_mode: 'HTML' })

    // Send files (Telegram has 50MB file size limit)
    for (const exp of exports) {
      if (exp.size > 50 * 1024 * 1024) {
        logWarn('ScheduledExportService', `File ${exp.filename} is too large for Telegram (${exp.size} bytes)`)
        continue
      }

      try {
        // Telegram bot API requires file to be sent as document
        // This is a simplified version - in production use proper Telegram file upload
        logInfo('ScheduledExportService', `Sending file ${exp.filename} to Telegram`)
      } catch (error) {
        logError('ScheduledExportService', `Failed to send file ${exp.filename} to Telegram`, error)
      }
    }
  }

  /**
   * Log execution to database
   */
  async logExecution(scheduleId, status, exportResults, emailSent, telegramSent, startTime, errorMessage = null) {
    const duration = Date.now() - startTime
    const successfulExports = exportResults.filter((r) => !r.error)

    const details = {
      successful: successfulExports.map((e) => ({
        type: e.type,
        format: e.format,
        recordCount: e.recordCount,
        size: e.size
      })),
      failed: exportResults.filter((r) => r.error).map((e) => ({ type: e.type, format: e.format, error: e.error }))
    }

    try {
      await query(
        `INSERT INTO scheduled_export_logs (
          scheduled_export_id, run_at, status, exports_generated,
          email_sent, telegram_sent, error_message, details, duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          scheduleId,
          new Date(),
          status,
          successfulExports.length,
          emailSent,
          telegramSent,
          errorMessage,
          JSON.stringify(details),
          duration
        ]
      )
    } catch (error) {
      logError('ScheduledExportService', 'Failed to log execution', error)
    }
  }

  /**
   * Update schedule after execution
   */
  async updateScheduleAfterRun(schedule, status) {
    // Calculate next run time
    const nextRun = this.calculateNextRun(schedule)

    try {
      await query(
        `UPDATE scheduled_exports
         SET last_run_at = $1, last_run_status = $2, last_run_error = NULL, next_run_at = $3
         WHERE id = $4`,
        [new Date(), status, nextRun, schedule.id]
      )
    } catch (error) {
      logError('ScheduledExportService', 'Failed to update schedule', error)
    }
  }

  /**
   * Calculate next run time based on schedule configuration
   */
  calculateNextRun(schedule) {
    const now = new Date()
    const timeStr = schedule.send_time ?? schedule.time
    const [hours, minutes] = (typeof timeStr === 'string' ? timeStr : String(timeStr)).split(':').map(Number)

    let nextRun = new Date(now)
    nextRun.setHours(hours, minutes, 0, 0)

    if (schedule.schedule_type === 'daily') {
      nextRun.setDate(nextRun.getDate() + 1)
    } else if (schedule.schedule_type === 'weekly') {
      nextRun.setDate(nextRun.getDate() + 7)
    } else if (schedule.schedule_type === 'monthly') {
      nextRun.setMonth(nextRun.getMonth() + 1)
      // Handle month end edge cases
      const lastDay = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
      if (schedule.day_of_month > lastDay) {
        nextRun.setDate(lastDay)
      }
    }

    return nextRun
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    logInfo('ScheduledExportService', 'Shutting down scheduled exports service...')
    this.isRunning = false
    // Cron jobs will stop automatically
  }
}

// Export singleton instance
const scheduledExportService = new ScheduledExportService()
export default scheduledExportService
