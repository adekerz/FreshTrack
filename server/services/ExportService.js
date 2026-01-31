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
  JSON: 'json'
}

/**
 * MIME types for each format
 */
export const MimeTypes = {
  [ExportFormat.CSV]: 'text/csv; charset=utf-8',
  [ExportFormat.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [ExportFormat.JSON]: 'application/json; charset=utf-8'
}

/**
 * Default column mappings for each entity type
 */
const EntityColumns = {
  products: [
    { key: 'name', header: 'Название' },
    { key: 'barcode', header: 'Штрих-код' },
    { key: 'category_name', header: 'Категория' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'total_quantity', header: 'Количество' },
    { key: 'unit', header: 'Ед.изм.' },
    { key: 'min_quantity', header: 'Мин. остаток' },
    { key: 'created_at', header: 'Дата создания' }
  ],
  batches: [
    { key: 'product_name', header: 'Продукт' },
    { key: 'batch_number', header: 'Номер партии' },
    { key: 'quantity', header: 'Количество' },
    { key: 'expiry_date', header: 'Срок годности' },
    { key: 'expiryStatus', header: 'Статус' },
    { key: 'daysLeft', header: 'Дней до истечения' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'created_at', header: 'Дата добавления' }
  ],
  writeOffs: [
    { key: 'product_name', header: 'Продукт' },
    { key: 'quantity', header: 'Количество' },
    { key: 'reason', header: 'Причина' },
    { key: 'expiry_status', header: 'Статус срока' },
    { key: 'department_name', header: 'Отдел' },
    { key: 'user_name', header: 'Пользователь' },
    { key: 'comment', header: 'Комментарий' },
    { key: 'created_at', header: 'Дата списания' }
  ],
  auditLogs: [
    { key: 'created_at', header: 'Дата/Время' },
    { key: 'user_name', header: 'Пользователь' },
    { key: 'action', header: 'Действие' },
    { key: 'entity_type', header: 'Тип объекта' },
    { key: 'entity_id', header: 'ID объекта' },
    { key: 'details', header: 'Детали' },
    { key: 'ip_address', header: 'IP адрес' }
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
    { key: 'createdAt', header: 'Дата регистрации' }
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
    { key: 'assignedAt', header: 'Дата назначения' }
  ],
  // Phase 8: Collection history with snapshot fields
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
    { key: 'notes', header: 'Примечания' }
  ]
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
  ADJUSTMENT: 'Корректировка'
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
  logout: 'Выход'
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
    if (key === 'reason' && ReasonLabels[value]) {
      return ReasonLabels[value]
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
    const { 
      columns = EntityColumns[entityType] || [], 
      includeHeaders = true,
      delimiter = ','
    } = options
    
    if (!data || data.length === 0) {
      return includeHeaders ? columns.map(c => c.header).join(delimiter) : ''
    }
    
    const rows = []
    
    // Add header row
    if (includeHeaders) {
      rows.push(columns.map(c => `"${c.header}"`).join(delimiter))
    }
    
    // Add data rows
    for (const item of data) {
      const row = columns.map(col => {
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
    
    const output = includeMetadata ? {
      exportedAt: new Date().toISOString(),
      entityType,
      totalRecords: data?.length || 0,
      data: data || []
    } : data || []
    
    return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output)
  }
  
  /**
   * Export data to XLSX format using ExcelJS
   * @param {Array} data - Array of objects to export
   * @param {string} entityType - Type of entity
   * @param {Object} options - { columns, sheetName }
   * @returns {Promise<Buffer>} - Excel file buffer
   */
  static async toXLSX(data, entityType, options = {}) {
    const { 
      columns = EntityColumns[entityType] || [],
      sheetName = entityType
    } = options
    
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'FreshTrack'
    workbook.created = new Date()
    
    const worksheet = workbook.addWorksheet(sheetName)
    
    // Set up columns with headers and widths
    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 20
    }))
    
    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    
    // Add data rows
    for (const item of (data || [])) {
      const row = {}
      for (const col of columns) {
        row[col.key] = this.formatValue(item[col.key], col.key)
      }
      worksheet.addRow(row)
    }
    
    // Auto-filter for all columns
    if (data && data.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: data.length + 1, column: columns.length }
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
      sheetName = entityType
    } = options
    
    const headers = columns.map(c => c.header)
    const rows = (data || []).map(item => 
      columns.map(col => this.formatValue(item[col.key], col.key))
    )
    
    return {
      headers,
      rows,
      sheetName
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
        entityType
      }
      throw error
    }
    const filename = options.filename || `${entityType}_export_${Date.now()}`
    const normalizedFormat = format?.toLowerCase() === 'excel' ? ExportFormat.XLSX : format?.toLowerCase()
    
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
            filters: options.filters || {}
          },
          snapshot_after: {
            exportId,
            format: normalizedFormat,
            entityType,
            rowCount: data.length,
            timestamp: new Date().toISOString(),
            userAgent: options.userAgent,
            ipAddress: options.ipAddress
          },
          ip_address: options.ipAddress
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
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
          // Add BOM for Excel UTF-8 compatibility
          res.send('\ufeff' + this.toCSV(data, entityType, options))
          break
          
        case ExportFormat.JSON:
          res.setHeader('Content-Type', MimeTypes[ExportFormat.JSON])
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)
          res.send(this.toJSON(data, entityType, options))
          break
          
        case ExportFormat.XLSX:
          const buffer = await this.toXLSX(data, entityType, options)
          res.setHeader('Content-Type', MimeTypes[ExportFormat.XLSX])
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
          res.send(buffer)
          break
          
        default:
          res.status(400).json({ 
            success: false, 
            error: 'UNSUPPORTED_FORMAT',
            message: `Unsupported export format: ${format}. Use: csv, xlsx, json`
          })
      }
    } catch (error) {
      logError('ExportService', error)
      res.status(500).json({
        success: false,
        error: 'EXPORT_FAILED',
        message: 'Failed to generate export file'
      })
    }
  }
  
  /**
   * Get MIME type for format
   * @param {string} format - Export format
   * @returns {string} - MIME type
   */
  static getMimeType(format) {
    const normalizedFormat = format?.toLowerCase() === 'excel' ? ExportFormat.XLSX : format?.toLowerCase()
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
      columns: this.getColumnsForEntity(entityType).map(c => c.key)
    }
  }
}

export default ExportService


