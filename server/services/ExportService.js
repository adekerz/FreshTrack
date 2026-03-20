/**
 * FreshTrack Export Service
 * Unified data export functionality for CSV, Excel (XLSX), and JSON formats
 *
 * Phase 4+6: Provides consistent export interface across all data types
 * - Supports CSV, Excel (XLSX), and JSON formats
 * - Uses snapshots for deleted entity data (e.g., collection history)
 * - Integrates with AuditService for export action logging
 */

import ExcelJS from 'exceljs'
import { logError } from '../utils/logger.js'
import { logAudit } from '../db/database.js'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

/**
 * Export formats
 */
export const ExportFormat = {
  CSV: 'csv',
  XLSX: 'xlsx',
  EXCEL: 'xlsx', // Alias for compatibility
  JSON: 'json',
}

/**
 * MIME types for each format
 */
export const MimeTypes = {
  [ExportFormat.CSV]: 'text/csv; charset=utf-8',
  [ExportFormat.XLSX]:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [ExportFormat.JSON]: 'application/json; charset=utf-8',
}

/**
 * Default column mappings for each entity type
 */
const EntityColumns = {
  products: [
    { key: 'name', header: 'Название' },
    { key: 'barcode', header: 'Штрих-код' },
    { key: 'category_name', header: 'Категория' },
    { key: 'unit', header: 'Ед.изм.' },
    { key: 'default_shelf_life', header: 'Срок хранения (дней)' },
    { key: 'created_at', header: 'Дата создания' },
  ],
  inventory: [
    { key: 'name', header: 'Товар' },
    { key: 'category_name', header: 'Категория' },
    { key: 'total_quantity', header: 'Количество' },
    { key: 'unit', header: 'Ед.изм.' },
    { key: 'nearest_expiry', header: 'Срок годности' },
    { key: 'batch_count', header: 'Партий' },
  ],
  batches: [
    { key: 'product_name', header: 'Продукт' },
    { key: 'batch_number', header: 'Номер партии' },
    { key: 'quantity', header: 'Количество' },
    { key: 'expiry_date', header: 'Срок годности' },
    { key: 'status', header: 'Статус' },
    { key: 'days_until_expiry', header: 'Дней до истечения' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'created_at', header: 'Дата добавления' },
  ],
  categories: [
    { key: 'name', header: 'Название' },
    { key: 'description', header: 'Описание' },
    { key: 'created_at', header: 'Дата создания' },
  ],
  departments: [
    { key: 'name', header: 'Название' },
    { key: 'description', header: 'Описание' },
    { key: 'email', header: 'Email' },
    { key: 'telegram_chat_id', header: 'Telegram Chat ID' },
    { key: 'created_at', header: 'Дата создания' },
  ],
  auditLogs: [
    { key: 'created_at', header: 'Дата/Время' },
    { key: 'user_name', header: 'Пользователь' },
    { key: 'action', header: 'Действие' },
    { key: 'entity_type', header: 'Тип объекта' },
    { key: 'entity_id', header: 'ID объекта' },
    { key: 'details', header: 'Детали' },
    { key: 'ip_address', header: 'IP адрес' },
  ],
  users: [
    { key: 'name', header: 'Имя' },
    { key: 'email', header: 'Email' },
    { key: 'login', header: 'Логин' },
    { key: 'role', header: 'Роль' },
    { key: 'hotel_name', header: 'Отель' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'is_active', header: 'Активен' },
    { key: 'lastLogin', header: 'Последний вход' },
    { key: 'createdAt', header: 'Дата регистрации' },
  ],
  marshaCodes: [
    { key: 'code', header: 'Код' },
    { key: 'hotelName', header: 'Название отеля' },
    { key: 'city', header: 'Город' },
    { key: 'country', header: 'Страна' },
    { key: 'region', header: 'Регион' },
    { key: 'brand', header: 'Бренд' },
    { key: 'isAssigned', header: 'Назначен' },
    { key: 'assignedHotelName', header: 'Назначен отелю' },
    { key: 'assignedAt', header: 'Дата назначения' },
  ],
  // Collections = collection history (API: ch.*, scheduled: quantity/reason)
  collections: [
    { key: 'collected_at', header: 'Дата/Время' },
    { key: 'product_name', header: 'Продукт' },
    { key: 'category_name', header: 'Категория' },
    { key: 'quantity_collected', header: 'Количество' },
    { key: 'collection_reason', header: 'Причина' },
    { key: 'expiry_date', header: 'Срок годности' },
    { key: 'batch_number', header: 'Номер партии' },
    { key: 'collected_by_name', header: 'Пользователь' },
    { key: 'department_name', header: 'Отдел' },
  ],
  collectionHistory: [
    { key: 'created_at', header: 'Дата/Время' },
    { key: 'product_name', header: 'Продукт' },
    { key: 'category_name', header: 'Категория' },
    { key: 'quantity', header: 'Количество' },
    { key: 'reason', header: 'Причина' },
    { key: 'expiry_date', header: 'Срок годности' },
    { key: 'batch_number', header: 'Номер партии' },
    { key: 'user_name', header: 'Пользователь' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'notes', header: 'Примечания' },
  ],
}

/**
 * Reason labels for localization
 */
const ReasonLabels = {
  expired: 'Истёк срок',
  damaged: 'Повреждён',
  manual: 'Ручное списание',
  quality: 'Проблемы с качеством',
  other: 'Другое',
  // Phase 8: Collection reasons
  CONSUMPTION: 'Расход',
  TRANSFER: 'Перемещение',
  SAMPLE: 'Образец',
  ADJUSTMENT: 'Корректировка',
}

/**
 * Status labels for batches/inventory
 */
const StatusLabels = {
  expired: 'Просрочено',
  today: 'Сегодня',
  critical: 'Критично',
  warning: 'Внимание',
  good: 'В норме',
}

/**
 * Action labels for audit logs
 */
const ActionLabels = {
  create: 'Создание',
  update: 'Обновление',
  delete: 'Удаление',
  collect: 'Списание',
  fifo_collect: 'FIFO списание',
  login: 'Вход',
  logout: 'Выход',
}

/**
 * Export Service class
 */
export class ExportService {
  // Maximum rows for export (protection against full DB dump)
  static MAX_EXPORT_ROWS = parseInt(process.env.MAX_EXPORT_ROWS) || 10000

  /**
   * Format cell value for export
   * @param {any} value - Raw value
   * @param {string} key - Column key
   * @returns {string} - Formatted value
   */
  static formatValue(value, key) {
    if (value === null || value === undefined) {
      return ''
    }

    // Date formatting
    if (key.includes('_at') || key === 'expiry_date') {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return key === 'expiry_date'
          ? date.toLocaleDateString('ru-RU')
          : date.toLocaleString('ru-RU')
      }
    }

    // Boolean formatting
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет'
    }

    // Reason labels
    if (
      (key === 'reason' || key === 'collection_reason') &&
      ReasonLabels[value]
    ) {
      return ReasonLabels[value]
    }

    // Status labels
    if ((key === 'status' || key === 'expiryStatus') && StatusLabels[value]) {
      return StatusLabels[value]
    }

    // Action labels
    if (key === 'action' && ActionLabels[value]) {
      return ActionLabels[value]
    }

    // JSON objects
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  /**
   * Export data to CSV format
   * @param {Array} data - Array of objects to export
   * @param {string} entityType - Type of entity
   * @param {Object} options - { columns, includeHeaders, delimiter }
   * @returns {string} - CSV string
   */
  static toCSV(data, entityType, options = {}) {
    let {
      columns = EntityColumns[entityType] || [],
      includeHeaders = true,
      delimiter = ',',
    } = options

    // Auto-detect columns from first data object if no columns provided
    if ((!columns || columns.length === 0) && data && data.length > 0) {
      const firstItem = data[0]
      columns = Object.keys(firstItem).map((key) => ({
        key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      }))
    }

    if (!data || data.length === 0) {
      return includeHeaders ? columns.map((c) => c.header).join(delimiter) : ''
    }

    const rows = []

    // Add header row
    if (includeHeaders) {
      rows.push(columns.map((c) => `"${c.header}"`).join(delimiter))
    }

    // Add data rows
    for (const item of data) {
      const row = columns.map((col) => {
        const value = this.formatValue(item[col.key], col.key)
        // Escape quotes and wrap in quotes for CSV safety
        return `"${String(value).replace(/"/g, '""')}"`
      })
      rows.push(row.join(delimiter))
    }

    return rows.join('\n')
  }

  /**
   * Export data to JSON format
   * @param {Array} data - Array of objects to export
   * @param {string} entityType - Type of entity
   * @param {Object} options - { pretty, includeMetadata }
   * @returns {string} - JSON string
   */
  static toJSON(data, entityType, options = {}) {
    const { pretty = true, includeMetadata = true } = options

    const output = includeMetadata
      ? {
          exportedAt: new Date().toISOString(),
          entityType,
          totalRecords: data?.length || 0,
          data: data || [],
        }
      : data || []

    return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output)
  }

  /**
   * Report titles for header block
   */
  static ReportTitles = {
    products: 'Продукты',
    batches: 'Все партии',
    inventory: 'Инвентарь',
    categories: 'Категории',
    departments: 'Отделы',
    auditLogs: 'Журнал действий',
    collections: 'История сборов',
    collectionHistory: 'История сборов',
  }

  /**
   * Export data to XLSX format using ExcelJS
   * @param {Array} data - Array of objects to export
   * @param {string} entityType - Type of entity
   * @param {Object} options - { columns, sheetName }
   * @returns {Promise<Buffer>} - Excel file buffer
   */
  static async toXLSX(data, entityType, options = {}) {
    let { columns = EntityColumns[entityType] || [], sheetName = entityType } =
      options

    // Auto-detect columns from first data object if no columns provided
    if ((!columns || columns.length === 0) && data && data.length > 0) {
      const firstItem = data[0]
      columns = Object.keys(firstItem).map((key) => ({
        key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        width: 20,
      }))
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'FreshTrack'
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet(sheetName, {
      pageSetup: { fitToPage: true, fitToWidth: 1 },
      views: [{ state: 'frozen', ySplit: 4 }],
    })

    // Цвета брендинга FreshTrack
    const colors = {
      headerBg: 'FF2D2D2D',
      headerFg: 'FFFFFFFF',
      titleBg: 'FFF5F0E8',
      titleBorder: 'FFC4A35A',
      rowAlt: 'FFFAFAFA',
      rowBorder: 'FFE8E4DC',
      statusExpired: 'FFC4554D',
      statusCritical: 'FFE67E22',
      statusWarning: 'FFFEF3CD',
      statusWarningFg: 'FF5C4813',
      statusGood: 'FF4A7C59',
      statusGoodFg: 'FFFFFFFF',
    }

    const reportTitle = this.ReportTitles[entityType] || entityType
    const exportDate = new Date().toLocaleString('ru-RU')
    const rowCount = (data || []).length

    // Заголовок: FreshTrack | Название отчёта
    worksheet.mergeCells(1, 1, 1, columns.length)
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `FreshTrack  •  ${reportTitle}`
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1A1A1A' } }
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.titleBg },
    }
    titleCell.alignment = { vertical: 'middle' }
    titleCell.border = {
      bottom: { style: 'medium', color: { argb: colors.titleBorder } },
    }
    worksheet.getRow(1).height = 28

    // Метаданные: дата, записей
    worksheet.mergeCells(2, 1, 2, columns.length)
    const metaCell = worksheet.getCell('A2')
    metaCell.value = `Дата экспорта: ${exportDate}  •  Записей: ${rowCount}`
    metaCell.font = { size: 9, color: { argb: 'FF6B6560' } }
    worksheet.getRow(2).height = 18

    // Пустая строка
    worksheet.getRow(3).height = 8

    // Шапка таблицы (строка 4)
    const headerRow = 4
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c]
      const cell = worksheet.getCell(headerRow, c + 1)
      cell.value = col.header
      cell.font = { bold: true, size: 10, color: { argb: colors.headerFg } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colors.headerBg },
      }
      cell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
        wrapText: true,
      }
      cell.border = {
        top: { style: 'thin', color: { argb: colors.headerBg } },
        bottom: { style: 'thin', color: { argb: colors.titleBorder } },
        left: { style: 'thin', color: { argb: colors.rowBorder } },
        right: { style: 'thin', color: { argb: colors.rowBorder } },
      }
    }
    worksheet.getRow(headerRow).height = 24

    // Ширины колонок
    columns.forEach((col, idx) => {
      const w =
        col.width ||
        (col.key && (col.key.includes('name') || col.key.includes('details'))
          ? 25
          : 15)
      worksheet.getColumn(idx + 1).width = Math.min(w, 50)
    })

    // Функция стиля статуса для ячейки
    const getStatusStyle = (item, col) => {
      const status = item.expiryStatus || item.status
      const val = (item[col.key] || '').toString().toLowerCase()
      if (
        status === 'expired' ||
        val.includes('просроч') ||
        val.includes('истек')
      ) {
        return { fill: colors.statusExpired, font: colors.headerFg, bold: true }
      }
      if (status === 'critical' || val.includes('критич')) {
        return {
          fill: colors.statusCritical,
          font: colors.headerFg,
          bold: true,
        }
      }
      if (status === 'warning' || val.includes('внимани')) {
        return {
          fill: colors.statusWarning,
          font: colors.statusWarningFg,
          bold: true,
        }
      }
      if (status === 'good' || val.includes('норм') || val.includes('хорош')) {
        return {
          fill: colors.statusGood,
          font: colors.statusGoodFg,
          bold: true,
        }
      }
      return null
    }

    const isStatusCol = (key) =>
      key === 'expiryStatus' || key === 'status' || key === 'statusLabel'

    // Строки данных
    const dataRows = data || []
    for (let r = 0; r < dataRows.length; r++) {
      const item = dataRows[r]
      const rowNum = headerRow + 1 + r
      const isAlt = r % 2 === 1
      const rowFill = isAlt ? colors.rowAlt : 'FFFFFFFF'

      for (let c = 0; c < columns.length; c++) {
        const col = columns[c]
        const cell = worksheet.getCell(rowNum, c + 1)
        const val = this.formatValue(item[col.key], col.key)
        cell.value = val

        const statusStyle = isStatusCol(col.key)
          ? getStatusStyle(item, col)
          : null
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusStyle ? statusStyle.fill : rowFill },
        }
        cell.font = statusStyle
          ? {
              bold: statusStyle.bold,
              size: 10,
              color: { argb: statusStyle.font },
            }
          : { size: 10, color: { argb: 'FF1A1A1A' } }
        cell.alignment = { vertical: 'middle' }
        cell.border = {
          bottom: { style: 'thin', color: { argb: colors.rowBorder } },
          left: { style: 'thin', color: { argb: colors.rowBorder } },
          right: { style: 'thin', color: { argb: colors.rowBorder } },
        }
      }
      worksheet.getRow(rowNum).height = 20
    }

    // Auto-filter
    if (dataRows.length > 0) {
      worksheet.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: headerRow + dataRows.length, column: columns.length },
      }
    }

    return await workbook.xlsx.writeBuffer()
  }

  /**
   * Export data to XLSX-compatible format (returns array for xlsx library)
   * @deprecated Use toXLSX() for real Excel file generation
   * @param {Array} data - Array of objects to export
   * @param {string} entityType - Type of entity
   * @param {Object} options - { columns, sheetName }
   * @returns {Object} - { headers: [], rows: [], sheetName }
   */
  static toXLSXData(data, entityType, options = {}) {
    const {
      columns = EntityColumns[entityType] || [],
      sheetName = entityType,
    } = options

    const headers = columns.map((c) => c.header)
    const rows = (data || []).map((item) =>
      columns.map((col) => this.formatValue(item[col.key], col.key))
    )

    return {
      headers,
      rows,
      sheetName,
    }
  }

  /**
   * Create export response with proper headers
   * @param {Object} res - Express response object
   * @param {Array} data - Data to export
   * @param {string} entityType - Type of entity
   * @param {string} format - Export format (csv, xlsx, json)
   * @param {Object} options - Export options
   */
  static async sendExport(res, data, entityType, format, options = {}) {
    // Проверка размера экспорта
    if (data.length > this.MAX_EXPORT_ROWS) {
      const error = new Error(
        `Export too large (${data.length} rows). ` +
          `Maximum: ${this.MAX_EXPORT_ROWS} rows. ` +
          `Please apply filters to reduce the dataset.`
      )
      error.statusCode = 400
      error.details = {
        totalRows: data.length,
        maxRows: this.MAX_EXPORT_ROWS,
        suggestion: 'Apply date filters or contact support for bulk export.',
        entityType,
      }
      throw error
    }
    const filename = options.filename || `${entityType}_export_${Date.now()}`
    const normalizedFormat =
      format?.toLowerCase() === 'excel'
        ? ExportFormat.XLSX
        : format?.toLowerCase()

    // Generate export ID for tracking
    const exportId = uuidv4()

    // Audit logging для экспорта
    if (options.user) {
      try {
        await logAudit({
          hotel_id: options.user.hotel_id || options.user.hotelId,
          user_id: options.user.id,
          user_name: options.user.name || options.user.login,
          action: 'EXPORT',
          entity_type: 'DATA_EXPORT',
          entity_id: exportId,
          details: {
            exportId,
            format: normalizedFormat,
            entityType,
            rowCount: data.length,
            filename,
            columns: data.length > 0 ? Object.keys(data[0]) : [],
            filters: options.filters || {},
          },
          snapshot_after: {
            exportId,
            format: normalizedFormat,
            entityType,
            rowCount: data.length,
            timestamp: new Date().toISOString(),
            userAgent: options.userAgent,
            ipAddress: options.ipAddress,
          },
          ip_address: options.ipAddress,
        })
      } catch (auditError) {
        logError('ExportService', 'Failed to log export audit', auditError)
        // Don't fail export if audit logging fails
      }
    }

    // Set export ID in response header для tracking
    res.setHeader('X-Export-ID', exportId)

    try {
      switch (normalizedFormat) {
        case ExportFormat.CSV:
          res.setHeader('Content-Type', MimeTypes[ExportFormat.CSV])
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}.csv"`
          )
          // BOM + разделитель ";" для корректного открытия в Excel (RU)
          res.send(
            '\ufeff' +
              this.toCSV(data, entityType, { ...options, delimiter: ';' })
          )
          break

        case ExportFormat.JSON:
          res.setHeader('Content-Type', MimeTypes[ExportFormat.JSON])
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}.json"`
          )
          res.send(this.toJSON(data, entityType, options))
          break

        case ExportFormat.XLSX:
          const buffer = await this.toXLSX(data, entityType, options)
          res.setHeader('Content-Type', MimeTypes[ExportFormat.XLSX])
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}.xlsx"`
          )
          res.send(buffer)
          break

        default:
          res.status(400).json({
            success: false,
            error: 'UNSUPPORTED_FORMAT',
            message: `Unsupported export format: ${format}. Use: csv, xlsx, json`,
          })
      }
    } catch (error) {
      logError('ExportService', error)
      res.status(500).json({
        success: false,
        error: 'EXPORT_FAILED',
        message: 'Failed to generate export file',
      })
    }
  }

  /**
   * Get MIME type for format
   * @param {string} format - Export format
   * @returns {string} - MIME type
   */
  static getMimeType(format) {
    const normalizedFormat =
      format?.toLowerCase() === 'excel'
        ? ExportFormat.XLSX
        : format?.toLowerCase()
    return MimeTypes[normalizedFormat] || 'application/octet-stream'
  }

  /**
   * Get available columns for entity type
   * @param {string} entityType - Type of entity
   * @returns {Array} - Array of column definitions
   */
  static getColumnsForEntity(entityType) {
    return EntityColumns[entityType] || []
  }

  /**
   * Build export summary for reporting
   * @param {Array} data - Exported data
   * @param {string} entityType - Type of entity
   * @returns {Object} - Export summary
   */
  static buildExportSummary(data, entityType) {
    return {
      entityType,
      totalRecords: data?.length || 0,
      exportedAt: new Date().toISOString(),
      availableFormats: Object.values(ExportFormat),
      columns: this.getColumnsForEntity(entityType).map((c) => c.key),
    }
  }
}

export default ExportService
