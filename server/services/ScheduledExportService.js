/**
 * ScheduledExportService
 * Manages automatic execution of scheduled exports via cron jobs
 * Sends reports via email and/or Telegram
 */

import crypto from 'crypto'
import cron from 'node-cron'
import { query } from '../db/postgres.js'
import { ExportService } from './ExportService.js'
import { sendEmail, emailTemplate } from './EmailService.js'
import { TelegramService } from './TelegramService.js'
import { logInfo, logError, logWarn } from '../utils/logger.js'
import {
  HEALTH_SUMMARY_QUERY,
  EXPIRY_FORECAST_QUERY,
  COLLECTION_ACTIVITY_QUERY,
  PRODUCT_TURNOVER_QUERY,
  DEPARTMENT_SCORECARD_QUERY,
  COLLECTION_REASONS_QUERY,
  BATCH_AGE_DISTRIBUTION_QUERY,
  WEEKLY_SUMMARY_QUERY,
} from '../modules/reports/report-queries.js'

// Russian labels for export types (for email/telegram display)
const TYPE_LABELS = {
  products: 'Продукты',
  batches: 'Все партии',
  inventory: 'Инвентарь',
  collections: 'История сборов',
  categories: 'Категории',
  departments: 'Отделы',
  audit: 'Журнал действий',
  'health-summary': 'Здоровье инвентаря',
  'expiry-forecast': 'Прогноз истечения',
  'collection-activity': 'Активность сборов',
  'product-turnover': 'Оборот продуктов',
  'department-scorecard': 'Рейтинг отделов',
  'collection-reasons': 'Причины сборов',
  'batch-age-distribution': 'Распределение по возрасту',
  'weekly-summary': 'Еженедельный отчёт',
}

// Map scheduled export type → ExportService entity type key
const ENTITY_TYPE_MAP = {
  audit: 'auditLogs',
}

// Custom columns for inventory (scheduled export returns per-batch rows)
const INVENTORY_COLUMNS = [
  { key: 'product_name', header: 'Продукт' },
  { key: 'category_name', header: 'Категория' },
  { key: 'department_name', header: 'Отдел' },
  { key: 'expiry_date', header: 'Срок годности' },
  { key: 'quantity', header: 'Количество' },
  { key: 'unit', header: 'Ед.изм.' },
  { key: 'status', header: 'Статус' },
  { key: 'days_until_expiry', header: 'Дней до истечения' },
]

// Russian column definitions for analytics report types
const ANALYTICS_COLUMNS = {
  'health-summary': [
    { key: 'department', header: 'Отдел' },
    { key: 'total_batches', header: 'Всего партий' },
    { key: 'good', header: 'Хорошие' },
    { key: 'warning', header: 'Внимание' },
    { key: 'critical', header: 'Критично' },
    { key: 'expired', header: 'Просрочено' },
    { key: 'health_score', header: 'Health Score' },
  ],
  'expiry-forecast': [
    { key: 'product', header: 'Продукт' },
    { key: 'department', header: 'Отдел' },
    { key: 'category', header: 'Категория' },
    { key: 'expiry_date', header: 'Дата истечения' },
    { key: 'days_left', header: 'Дней осталось' },
    { key: 'quantity', header: 'Количество' },
    { key: 'unit', header: 'Ед.изм.' },
    { key: 'batch_number', header: 'Партия №' },
    { key: 'status', header: 'Статус' },
  ],
  'collection-activity': [
    { key: 'collected_at', header: 'Дата' },
    { key: 'product_name', header: 'Продукт' },
    { key: 'category_name', header: 'Категория' },
    { key: 'department', header: 'Отдел' },
    { key: 'collected_by', header: 'Кто собрал' },
    { key: 'quantity_collected', header: 'Количество' },
    { key: 'collection_reason', header: 'Причина' },
    { key: 'batch_number', header: 'Партия №' },
    { key: 'expiry_date', header: 'Срок годности' },
  ],
  'product-turnover': [
    { key: 'product', header: 'Продукт' },
    { key: 'category', header: 'Категория' },
    { key: 'total_batches', header: 'Партий' },
    { key: 'current_stock', header: 'Остаток' },
    { key: 'total_collected', header: 'Собрано' },
    { key: 'expired_batches', header: 'Просрочено' },
    { key: 'consumption_rate_pct', header: 'Доля потребления %' },
    { key: 'turnover_ratio', header: 'Коэффициент оборота' },
  ],
  'department-scorecard': [
    { key: 'department', header: 'Отдел' },
    { key: 'total_batches', header: 'Всего партий' },
    { key: 'expired_count', header: 'Просрочено' },
    { key: 'expiry_rate_pct', header: 'Доля истечений %' },
    { key: 'avg_days_to_expiry', header: 'Ср. дней до истечения' },
    { key: 'collections_this_month', header: 'Сборов за месяц' },
    { key: 'health_score', header: 'Health Score' },
  ],
  'collection-reasons': [
    { key: 'reason', header: 'Причина' },
    { key: 'transaction_count', header: 'Транзакций' },
    { key: 'total_quantity', header: 'Всего кол-во' },
    { key: 'percentage', header: 'Доля %' },
  ],
  'batch-age-distribution': [
    { key: 'age_range', header: 'Диапазон' },
    { key: 'batch_count', header: 'Партий' },
    { key: 'total_quantity', header: 'Количество' },
    { key: 'percentage', header: 'Доля %' },
  ],
  'weekly-summary': [
    { key: 'total_batches', header: 'Всего партий' },
    { key: 'good', header: 'Хорошие' },
    { key: 'expired', header: 'Просрочено' },
    { key: 'health_score', header: 'Health Score' },
    { key: 'prev_health_score', header: 'Health Score (пред.)' },
    { key: 'health_delta', header: 'Изменение' },
    { key: 'collections', header: 'Сборов за неделю' },
    { key: 'collected_qty', header: 'Собрано ед.' },
  ],
}

class ScheduledExportService {
  constructor() {
    this.jobs = new Map()
    this.isRunning = false
  }

  /**
   * Save export file to database and return download URL
   */
  async saveExportFile(
    fileBuffer,
    {
      hotelId,
      departmentId,
      scheduledExportId,
      fileName,
      contentType,
      expiryHours,
      bundleToken,
    }
  ) {
    const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(
        `File size ${fileBuffer.length} exceeds maximum ${MAX_FILE_SIZE} bytes`
      )
    }

    const result = await query(
      `INSERT INTO export_files (hotel_id, department_id, scheduled_export_id, file_data, file_name, content_type, file_size, expires_at, bundle_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + interval '1 hour' * $8, $9)
       RETURNING token`,
      [
        hotelId,
        departmentId,
        scheduledExportId,
        fileBuffer,
        fileName,
        contentType,
        fileBuffer.length,
        expiryHours,
        bundleToken || null,
      ]
    )

    const token = result.rows[0].token
    return {
      token,
      fileName,
      fileSize: fileBuffer.length,
    }
  }

  /**
   * Initialize the service and start monitoring for due exports
   */
  async initialize() {
    if (this.isRunning) {
      logWarn('ScheduledExportService', 'Already initialized')
      return
    }

    logInfo(
      'ScheduledExportService',
      'Initializing scheduled exports service...'
    )

    // Check for due exports every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.checkDueExports()
      } catch (error) {
        logError('ScheduledExportService', 'Error checking due exports', error)
      }
    })

    this.isRunning = true
    logInfo(
      'ScheduledExportService',
      'Scheduled exports service started successfully'
    )
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
          h.name as hotel_name,
          u.email as creator_email,
          u.telegram_chat_id as creator_telegram_chat_id
        FROM scheduled_exports se
        LEFT JOIN departments d ON se.department_id = d.id
        LEFT JOIN hotels h ON se.hotel_id = h.id
        LEFT JOIN users u ON se.created_by = u.id
        WHERE se.is_active = true AND se.next_run_at <= $1`,
        [now]
      )

      if (result.rows.length > 0) {
        logInfo(
          'ScheduledExportService',
          `Found ${result.rows.length} due exports`
        )

        for (const schedule of result.rows) {
          // Execute each schedule independently (don't let one failure block others)
          this.executeScheduledExport(schedule).catch((error) => {
            logError(
              'ScheduledExportService',
              `Failed to execute schedule ${schedule.id}`,
              error
            )
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

      const deliveryMethod = schedule.delivery_method
      const departmentEmail =
        schedule.email_override || schedule.department_email
      const telegramChatId =
        schedule.telegram_chat_id_override || schedule.telegram_chat_id
      const departmentName = schedule.department_name
      const linkExpiryHours = schedule.link_expiry_hours || 72

      // ВАЖНО: Логируем детали расписания для отладки
      logInfo('ScheduledExportService', 'Schedule details:', {
        id: schedule.id,
        departmentName,
        email: departmentEmail,
        telegram: telegramChatId,
        deliveryMethod,
        exportTypes,
        exportFormats,
        isTest,
      })

      // Проверяем что email/telegram настроены для выбранного способа доставки
      if (
        (deliveryMethod === 'email' || deliveryMethod === 'both') &&
        !departmentEmail
      ) {
        throw new Error(`Department email not configured for ${departmentName}`)
      }

      if (
        (deliveryMethod === 'telegram' || deliveryMethod === 'both') &&
        !telegramChatId
      ) {
        throw new Error(`Telegram chat ID not configured for ${departmentName}`)
      }

      const filters =
        typeof schedule.filters === 'object'
          ? schedule.filters
          : JSON.parse(schedule.filters || '{}')

      // Generate bundle token for grouping all files from this export run
      const bundleToken = crypto.randomUUID()

      // Generate each requested export
      for (const exportType of exportTypes) {
        for (const format of exportFormats) {
          try {
            logInfo(
              'ScheduledExportService',
              `Generating ${exportType} in ${format} format`
            )

            // Fetch data for export
            const data = await this.fetchExportData(
              exportType,
              schedule,
              filters
            )

            // Generate file
            let buffer
            let filename
            let mimeType

            // Map to ExportService entity type + optional custom columns
            const entityType = ENTITY_TYPE_MAP[exportType] || exportType
            const extraOptions =
              exportType === 'inventory'
                ? { columns: INVENTORY_COLUMNS }
                : ANALYTICS_COLUMNS[exportType]
                  ? { columns: ANALYTICS_COLUMNS[exportType] }
                  : {}
            const dateStr = new Date().toISOString().split('T')[0]

            if (format === 'excel' || format === 'xlsx') {
              buffer = await ExportService.toXLSX(data, entityType, {
                sheetName: TYPE_LABELS[exportType] || exportType,
                ...extraOptions,
              })
              filename = `${exportType}_${dateStr}.xlsx`
              mimeType =
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            } else if (format === 'csv') {
              const csvData = ExportService.toCSV(
                data,
                entityType,
                extraOptions
              )
              buffer = Buffer.from(csvData, 'utf-8')
              filename = `${exportType}_${dateStr}.csv`
              mimeType = 'text/csv'
            } else if (format === 'pdf') {
              const html = this.generatePDFHtml(data, exportType, schedule)
              buffer = await this.renderHtmlToPdf(html)
              filename = `${exportType}_${dateStr}.pdf`
              mimeType = 'application/pdf'
            } else {
              logWarn('ScheduledExportService', `Unsupported format: ${format}`)
              continue
            }

            // Save to database and get download URL
            const downloadInfo = await this.saveExportFile(buffer, {
              hotelId: schedule.hotel_id,
              departmentId: schedule.department_id,
              scheduledExportId: schedule.id,
              fileName: filename,
              contentType: mimeType,
              expiryHours: linkExpiryHours,
              bundleToken,
            })

            exportResults.push({
              type: exportType,
              format,
              filename,
              mimeType,
              recordCount: data.length,
              size: buffer.length,
              token: downloadInfo.token,
            })

            logInfo(
              'ScheduledExportService',
              `Generated ${filename} (${data.length} records)`
            )
          } catch (error) {
            logError(
              'ScheduledExportService',
              `Failed to generate ${exportType} (${format})`,
              error
            )
            exportResults.push({
              type: exportType,
              format,
              error: error.message,
            })
          }
        }
      }

      // Check if we have any successful exports
      const successfulExports = exportResults.filter((r) => !r.error)

      if (successfulExports.length === 0) {
        throw new Error('All export generations failed')
      }

      // Send via Email (uses pre-computed departmentEmail which respects recipient_type)
      if (
        schedule.delivery_method === 'email' ||
        schedule.delivery_method === 'both'
      ) {
        try {
          if (!departmentEmail) {
            logWarn(
              'ScheduledExportService',
              'No email configured for delivery'
            )
          } else {
            await this.sendEmailWithLinks(
              departmentEmail,
              successfulExports,
              schedule,
              isTest,
              bundleToken
            )
            emailSent = true
            logInfo(
              'ScheduledExportService',
              `Email sent to ${departmentEmail}`
            )
          }
        } catch (error) {
          logError('ScheduledExportService', 'Failed to send email', error)
        }
      }

      // Send via Telegram (uses pre-computed telegramChatId which respects recipient_type)
      if (
        schedule.delivery_method === 'telegram' ||
        schedule.delivery_method === 'both'
      ) {
        try {
          if (!telegramChatId) {
            logWarn(
              'ScheduledExportService',
              'No Telegram chat configured for delivery'
            )
          } else {
            await this.sendTelegramWithLinks(
              telegramChatId,
              successfulExports,
              schedule,
              isTest,
              bundleToken
            )
            telegramSent = true
            logInfo(
              'ScheduledExportService',
              `Telegram message sent to ${telegramChatId}`
            )
          }
        } catch (error) {
          logError(
            'ScheduledExportService',
            'Failed to send Telegram message',
            error
          )
        }
      }

      // Determine status
      const failedExports = exportResults.filter((r) => r.error)
      const status =
        emailSent || telegramSent
          ? failedExports.length > 0
            ? 'partial'
            : 'success'
          : 'failed'

      // Log execution
      await this.logExecution(
        schedule.id,
        status,
        exportResults,
        emailSent,
        telegramSent,
        startTime
      )

      // Update schedule (calculate next run, update last run status)
      if (!isTest) {
        await this.updateScheduleAfterRun(schedule, status)
      }

      logInfo(
        'ScheduledExportService',
        `Scheduled export ${schedule.id} completed: ${status}`
      )
    } catch (error) {
      logError(
        'ScheduledExportService',
        `Scheduled export ${schedule.id} failed`,
        error
      )

      // Log failed execution
      await this.logExecution(
        schedule.id,
        'failed',
        exportResults,
        emailSent,
        telegramSent,
        startTime,
        error.message
      )

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
  async getExportData(exportType, schedule, filters) {
    const hotelId = schedule.hotel_id
    const departmentId = schedule.department_id
    let queryText = ''
    const queryParams = [hotelId]

    switch (exportType) {
      case 'products':
        queryText = `
          SELECT
            p.name,
            p.barcode,
            c.name as category_name,
            p.unit,
            p.default_shelf_life,
            p.created_at
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE p.hotel_id = $1
          ORDER BY p.name LIMIT 10000
        `
        break

      case 'batches':
        queryText = `
          SELECT
            b.batch_number,
            p.name as product_name,
            d.name as department_name,
            b.quantity,
            b.expiry_date,
            b.status,
            (b.expiry_date - CURRENT_DATE) AS days_until_expiry,
            b.created_at
          FROM batches b
          JOIN products p ON b.product_id = p.id
          LEFT JOIN departments d ON p.department_id = d.id
          WHERE b.hotel_id = $1
        `
        if (departmentId) {
          queryText += ` AND d.id = $${queryParams.length + 1}`
          queryParams.push(departmentId)
        }
        queryText += ` ORDER BY b.created_at DESC LIMIT 10000`
        break

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
        if (departmentId) {
          queryText += ` AND d.id = $${queryParams.length + 1}`
          queryParams.push(departmentId)
        }
        queryText += ` ORDER BY b.expiry_date LIMIT 10000`
        break

      case 'collections':
        queryText = `
          SELECT
            ch.collected_at,
            ch.product_name,
            ch.category_name,
            d.name as department_name,
            ch.quantity_collected,
            ch.collection_reason,
            u.name as collected_by_name,
            ch.batch_number,
            ch.expiry_date
          FROM collection_history ch
          LEFT JOIN departments d ON ch.department_id = d.id
          LEFT JOIN users u ON ch.user_id = u.id
          WHERE ch.hotel_id = $1
        `
        if (departmentId) {
          queryText += ` AND ch.department_id = $${queryParams.length + 1}`
          queryParams.push(departmentId)
        }
        queryText += ` ORDER BY ch.collected_at DESC LIMIT 10000`
        break

      case 'categories':
        queryText = `
          SELECT
            name,
            description,
            created_at
          FROM categories
          WHERE hotel_id = $1
          ORDER BY name LIMIT 10000
        `
        break

      case 'departments':
        queryText = `
          SELECT
            name,
            description,
            email,
            telegram_chat_id,
            created_at
          FROM departments
          WHERE hotel_id = $1
          ORDER BY name LIMIT 10000
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
          ORDER BY a.created_at DESC LIMIT 1000
        `
        break

      default:
        throw new Error(`Unknown export type: ${exportType}`)
    }

    const result = await query(queryText, queryParams)
    return result.rows
  }

  /**
   * Fetch analytics report data using shared report-queries
   */
  async getAnalyticsReportData(exportType, schedule) {
    const hotelId = schedule.hotel_id
    const departmentId = schedule.department_id
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = new Date()

    switch (exportType) {
      case 'health-summary': {
        const r = await query(HEALTH_SUMMARY_QUERY, [
          hotelId,
          departmentId || null,
        ])
        return r.rows
      }
      case 'expiry-forecast': {
        const r = await query(EXPIRY_FORECAST_QUERY, [
          hotelId,
          14,
          departmentId || null,
        ])
        return r.rows
      }
      case 'collection-activity': {
        const r = await query(COLLECTION_ACTIVITY_QUERY, [
          hotelId,
          dateFrom,
          dateTo,
          departmentId || null,
        ])
        return r.rows
      }
      case 'product-turnover': {
        const r = await query(PRODUCT_TURNOVER_QUERY, [
          hotelId,
          dateFrom,
          dateTo,
        ])
        return r.rows
      }
      case 'department-scorecard': {
        const r = await query(DEPARTMENT_SCORECARD_QUERY, [hotelId])
        return r.rows
      }
      case 'collection-reasons': {
        const r = await query(COLLECTION_REASONS_QUERY, [
          hotelId,
          dateFrom,
          dateTo,
          departmentId || null,
        ])
        return r.rows
      }
      case 'batch-age-distribution': {
        const r = await query(BATCH_AGE_DISTRIBUTION_QUERY, [
          hotelId,
          departmentId || null,
        ])
        return r.rows
      }
      case 'weekly-summary': {
        const r = await query(WEEKLY_SUMMARY_QUERY, [hotelId])
        return r.rows.length > 0 ? [r.rows[0]] : []
      }
      default:
        return null
    }
  }

  // Keep old method name for backward compatibility; routes analytics types to getAnalyticsReportData
  async fetchExportData(exportType, schedule, filters) {
    const analyticsTypes = [
      'health-summary',
      'expiry-forecast',
      'collection-activity',
      'product-turnover',
      'department-scorecard',
      'collection-reasons',
      'batch-age-distribution',
      'weekly-summary',
    ]
    if (analyticsTypes.includes(exportType)) {
      return this.getAnalyticsReportData(exportType, schedule)
    }
    return this.getExportData(exportType, schedule, filters)
  }

  /**
   * Render HTML string to PDF buffer via Puppeteer
   * Requires: npm install puppeteer-core
   * On Railway/Docker: set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
   */
  async renderHtmlToPdf(html) {
    const puppeteer = await import('puppeteer-core')
    const browser = await puppeteer.default.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const buffer = await page.pdf({
        format: 'A4',
        landscape: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        printBackground: true,
      })
      return buffer
    } finally {
      await browser.close()
    }
  }

  /**
   * Generate HTML table for PDF export (FreshTrack branded)
   */
  generatePDFHtml(data, exportType, schedule) {
    const label = TYPE_LABELS[exportType] || exportType
    const dateStr = new Date().toLocaleString('ru-RU')

    // Use Russian column definitions from ANALYTICS_COLUMNS / INVENTORY_COLUMNS
    // Fall back to auto-detected keys if not defined
    let colDefs = ANALYTICS_COLUMNS[exportType] || null
    if (!colDefs && exportType === 'inventory') colDefs = INVENTORY_COLUMNS
    if (!colDefs && data.length > 0) {
      colDefs = Object.keys(data[0]).map((k) => ({ key: k, header: k }))
    }
    colDefs = colDefs || []

    const StatusLabels = {
      expired: 'Просрочено',
      today: 'Сегодня',
      critical: 'Критично',
      warning: 'Внимание',
      good: 'В норме',
    }
    const ReasonLabels = {
      expired: 'Истёк срок',
      damaged: 'Повреждён',
      manual: 'Ручное списание',
      quality: 'Проблемы с качеством',
      other: 'Другое',
      CONSUMPTION: 'Расход',
      TRANSFER: 'Перемещение',
      SAMPLE: 'Образец',
      ADJUSTMENT: 'Корректировка',
    }

    const formatVal = (val, key) => {
      if (val === null || val === undefined) return '—'
      if ((key.includes('_at') || key === 'expiry_date') && val) {
        const d = new Date(val)
        if (!isNaN(d.getTime()))
          return key === 'expiry_date'
            ? d.toLocaleDateString('ru-RU')
            : d.toLocaleString('ru-RU')
      }
      if (key === 'status' && StatusLabels[val]) return StatusLabels[val]
      if (
        (key === 'reason' || key === 'collection_reason') &&
        ReasonLabels[val]
      )
        return ReasonLabels[val]
      if (typeof val === 'boolean') return val ? 'Да' : 'Нет'
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }

    const statusStyle = (val) => {
      if (val === 'expired' || val === 'today')
        return 'background:#FDDEDE;color:#C4554D;font-weight:600'
      if (val === 'critical')
        return 'background:#FFE4CC;color:#E67E22;font-weight:600'
      if (val === 'warning')
        return 'background:#FEF3CD;color:#5C4813;font-weight:600'
      if (val === 'good')
        return 'background:#D4EDDA;color:#4A7C59;font-weight:600'
      return ''
    }

    const headerCells = colDefs.map((c) => `<th>${c.header}</th>`).join('')
    const bodyRows = data
      .map((row, i) => {
        const bg = i % 2 === 1 ? '#FAFAFA' : '#FFFFFF'
        const cells = colDefs
          .map((c) => {
            const raw = row[c.key]
            const val = formatVal(raw, c.key)
            const extra =
              c.key === 'status' ? ` style="${statusStyle(raw)}"` : ''
            return `<td${extra}>${val}</td>`
          })
          .join('')
        return `<tr style="background:${bg}">${cells}</tr>`
      })
      .join('')

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${label}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1A1A1A; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
      padding: 12px 16px; background: #F5F0E8; border-bottom: 2px solid #C4A35A; margin-bottom: 14px; }
    .logo { font-size: 14pt; font-weight: 700; color: #1A1A1A; }
    .logo-sub { font-size: 8pt; color: #6B6560; }
    .report-info { text-align: right; font-size: 8pt; color: #6B6560; }
    h1 { font-size: 13pt; font-weight: 500; margin-bottom: 2px; }
    .subtitle { font-size: 9pt; color: #6B6560; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #2D2D2D; color: #FFF; font-weight: 600; text-align: left;
      padding: 7px 9px; border-bottom: 2px solid #C4A35A; font-size: 8pt; }
    td { padding: 6px 9px; border-bottom: 1px solid #E8E4DC;
      border-left: 1px solid #E8E4DC; border-right: 1px solid #E8E4DC; font-size: 8pt; }
    .footer { margin-top: 14px; font-size: 7pt; color: #9CA3AF; border-top: 1px solid #E5E2DE; padding-top: 6px;
      display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">FreshTrack</div>
      <div class="logo-sub">FreshTrack System</div>
    </div>
    <div class="report-info">
      <div>Дата: ${dateStr}</div>
      <div>Записей: ${data.length}</div>
    </div>
  </div>
  <h1>${label}</h1>
  <p class="subtitle">${schedule.department_name}${schedule.hotel_name ? ' • ' + schedule.hotel_name : ''}</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">
    <span>© ${new Date().getFullYear()} FreshTrack</span>
    <span>${label} • ${dateStr}</span>
  </div>
</body>
</html>`
  }

  /**
   * Generate HTML for email with export reports
   */
  generateEmailHTML(departmentName, exports, isTest = false, bundleUrl = '') {
    const reportRows = exports
      .map((exp) => {
        const label = TYPE_LABELS[exp.type] || exp.type
        const sizeKB = exp.size ? Math.round(exp.size / 1024) : 0
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:600;">${label}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;">${exp.format.toUpperCase()}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;">${sizeKB} KB</td>
          </tr>`
      })
      .join('')

    const content = `
      <h2 style="margin-top:0;">Отчёты FreshTrack</h2>
      ${isTest ? '<p style="background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:10px 14px;border-radius:6px;">🧪 Тестовая отправка — данные могут не отражать реальный отчёт</p>' : ''}
      <p>Здравствуйте!</p>
      <p>Высылаем запланированные отчёты для отдела <strong>${departmentName}</strong>.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <thead>
          <tr style="border-bottom:2px solid #eee;">
            <th style="padding:8px 0;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Отчёт</th>
            <th style="padding:8px 0;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Формат</th>
            <th style="padding:8px 0;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Размер</th>
          </tr>
        </thead>
        <tbody>${reportRows}</tbody>
      </table>

      <div style="text-align:center;margin:24px 0;">
        <a href="${bundleUrl}" style="display:inline-block;background:#2D2D2D;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">📥 Скачать отчёты</a>
      </div>

      <p style="color:#888;font-size:14px;">🔐 Для скачивания файлов потребуется PIN-код.</p>
      <p style="color:#888;font-size:13px;">Дата отправки: ${new Date().toLocaleString('ru-RU')}</p>
    `

    return emailTemplate(content, { title: 'Отчёты FreshTrack' })
  }

  /**
   * Send email with download links (instead of attachments)
   */
  async sendEmailWithLinks(to, exports, schedule, isTest, bundleToken) {
    const testPrefix = isTest ? '[ТЕСТ] ' : ''
    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const bundleUrl = `${appUrl}/download/bundle/${bundleToken}`

    const html = this.generateEmailHTML(
      schedule.department_name,
      exports,
      isTest,
      bundleUrl
    )

    await sendEmail({
      to,
      subject: `${testPrefix}Отчеты FreshTrack - ${schedule.department_name} - ${new Date().toLocaleDateString('ru-RU')}`,
      html,
    })
  }

  /**
   * Send Telegram message with download links (instead of file attachments)
   */
  async sendTelegramWithLinks(chatId, exports, schedule, isTest, bundleToken) {
    const testPrefix = isTest ? '🧪 <b>[ТЕСТ]</b> ' : ''
    const appUrl = process.env.APP_URL || 'http://localhost:5173'
    const bundleUrl = `${appUrl}/download/bundle/${bundleToken}`

    const reportLines = exports
      .map((exp) => {
        const label = TYPE_LABELS[exp.type] || exp.type
        const sizeKB = exp.size ? Math.round(exp.size / 1024) : 0
        return `• ${label} (${exp.format.toUpperCase()}, ${sizeKB} KB)`
      })
      .join('\n')

    const expiryHours = schedule.link_expiry_hours || 72

    const message = `${testPrefix}📊 <b>Отчёты FreshTrack</b>
<b>Отель:</b> ${schedule.hotel_name}
<b>Отдел:</b> ${schedule.department_name}

<b>Файлы отчётов (${exports.length}):</b>
${reportLines}

📥 <a href="${bundleUrl}">Скачать отчёты</a>

🔐 Для скачивания потребуется PIN
⏰ Ссылки действительны: ${expiryHours} ч
📅 ${new Date().toLocaleString('ru-RU')}`

    await TelegramService.sendMessage(chatId, message, { parse_mode: 'HTML' })
  }

  /**
   * Log execution to database
   */
  async logExecution(
    scheduleId,
    status,
    exportResults,
    emailSent,
    telegramSent,
    startTime,
    errorMessage = null
  ) {
    const duration = Date.now() - startTime
    const successfulExports = exportResults.filter((r) => !r.error)

    const details = {
      successful: successfulExports.map((e) => ({
        type: e.type,
        format: e.format,
        recordCount: e.recordCount,
        size: e.size,
      })),
      failed: exportResults
        .filter((r) => r.error)
        .map((e) => ({ type: e.type, format: e.format, error: e.error })),
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
          duration,
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
    const timeStr = schedule.send_time ?? schedule.time
    const [hours, minutes] = (
      typeof timeStr === 'string' ? timeStr : String(timeStr)
    )
      .split(':')
      .map(Number)

    const tz = schedule.timezone || 'UTC'
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map((p) => [p.type, p.value])
    )
    const year = Number(parts.year)
    const month = Number(parts.month) - 1
    const day = Number(parts.day)
    const nowHour = Number(parts.hour === '24' ? '0' : parts.hour)
    const nowMinute = Number(parts.minute)
    const nowMinutes = nowHour * 60 + nowMinute
    const targetMinutes = hours * 60 + minutes

    let nextYear = year,
      nextMonth = month,
      nextDay = day

    if (schedule.schedule_type === 'daily') {
      // After execution, always schedule for next day
      const d = new Date(year, month, day + 1)
      nextYear = d.getFullYear()
      nextMonth = d.getMonth()
      nextDay = d.getDate()
    } else if (schedule.schedule_type === 'weekly') {
      const d = new Date(year, month, day + 7)
      nextYear = d.getFullYear()
      nextMonth = d.getMonth()
      nextDay = d.getDate()
    } else if (schedule.schedule_type === 'monthly') {
      const d = new Date(year, month + 1, 1)
      nextYear = d.getFullYear()
      nextMonth = d.getMonth()
      const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate()
      nextDay = Math.min(schedule.day_of_month || day, lastDay)
    }

    // Convert timezone-local date back to UTC
    const fakeUtc = new Date(
      Date.UTC(nextYear, nextMonth, nextDay, hours, minutes, 0)
    )
    const fmtCheck = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const cp = Object.fromEntries(
      fmtCheck.formatToParts(fakeUtc).map((p) => [p.type, p.value])
    )
    const fakeInTz = new Date(
      `${cp.year}-${cp.month}-${cp.day}T${cp.hour === '24' ? '00' : cp.hour}:${cp.minute}:${cp.second}Z`
    )
    const offsetMs = fakeInTz.getTime() - fakeUtc.getTime()
    return new Date(fakeUtc.getTime() - offsetMs)
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    logInfo(
      'ScheduledExportService',
      'Shutting down scheduled exports service...'
    )
    this.isRunning = false
    // Cron jobs will stop automatically
  }
}

// Export singleton instance
const scheduledExportService = new ScheduledExportService()
export default scheduledExportService
