/**
 * Centralized Frontend Export Configuration
 * Defines export types, their endpoints, and UI properties
 */

/**
 * Export type configurations
 * Each export type includes endpoint, filename, title, subtitle, and column key
 */
export const EXPORT_TYPES = {
  products: {
    id: 'products',
    endpoint: '/export/products',
    filename: 'products',
    title: 'Продукты',
    subtitle: 'Справочник продуктов',
    columnsKey: 'products',
    labelKey: 'export.products'
  },

  batches: {
    id: 'batches',
    endpoint: '/export/batches',
    filename: 'batches',
    title: 'Все партии',
    subtitle: 'Полная история партий',
    columnsKey: 'batches',
    labelKey: 'export.batches'
  },

  inventory: {
    id: 'inventory',
    endpoint: '/export/inventory',
    filename: 'inventory',
    title: 'Инвентарь',
    subtitle: 'Текущие товары и статусы',
    columnsKey: 'inventory',
    labelKey: 'export.inventory'
  },

  collections: {
    id: 'collections',
    endpoint: '/export/collections',
    filename: 'collections',
    title: 'История сборов',
    subtitle: 'Журнал сборов товаров',
    columnsKey: 'collections',
    labelKey: 'export.collections'
  },

  categories: {
    id: 'categories',
    endpoint: '/export/categories',
    filename: 'categories',
    title: 'Категории',
    subtitle: 'Справочник категорий',
    columnsKey: 'categories',
    labelKey: 'export.categories'
  },

  departments: {
    id: 'departments',
    endpoint: '/export/departments',
    filename: 'departments',
    title: 'Отделы',
    subtitle: 'Справочник отделов',
    columnsKey: 'departments',
    labelKey: 'export.departments'
  },

  audit: {
    id: 'audit',
    endpoint: '/export/audit-logs',
    filename: 'audit_logs',
    title: 'Журнал действий',
    subtitle: 'Лог всех действий в системе',
    columnsKey: 'auditLogs',
    labelKey: 'export.audit'
  }
}

/**
 * Available export formats
 */
export const EXPORT_FORMATS = {
  excel: {
    id: 'excel',
    label: 'Excel',
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  csv: {
    id: 'csv',
    label: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv'
  },
  pdf: {
    id: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf'
  }
}

/**
 * Get export type configuration by ID
 * @param {string} typeId - Export type identifier
 * @returns {Object|null} Export type configuration or null if not found
 */
export function getExportType(typeId) {
  return EXPORT_TYPES[typeId] || null
}

/**
 * Get all available export types
 * @returns {Object} All export type configurations
 */
export function getAllExportTypes() {
  return EXPORT_TYPES
}

/**
 * Get all available export types as an array
 * @returns {Array} Array of export type configurations
 */
export function getExportTypesArray() {
  return Object.values(EXPORT_TYPES)
}

/**
 * Check if export type exists
 * @param {string} typeId - Export type identifier
 * @returns {boolean} True if export type exists
 */
export function isValidExportType(typeId) {
  return typeId in EXPORT_TYPES
}

/**
 * Get export format configuration by ID
 * @param {string} formatId - Export format identifier
 * @returns {Object|null} Export format configuration or null if not found
 */
export function getExportFormat(formatId) {
  return EXPORT_FORMATS[formatId] || null
}

/**
 * Get all available export formats
 * @returns {Object} All export format configurations
 */
export function getAllExportFormats() {
  return EXPORT_FORMATS
}

/**
 * Get all available export formats as an array
 * @returns {Array} Array of export format configurations
 */
export function getExportFormatsArray() {
  return Object.values(EXPORT_FORMATS)
}

/**
 * Generate filename with timestamp
 * @param {string} typeId - Export type identifier
 * @param {string} formatId - Export format identifier
 * @returns {string} Filename with timestamp and extension
 */
export function generateFilename(typeId, formatId = 'excel') {
  const exportType = getExportType(typeId)
  const exportFormat = getExportFormat(formatId)

  if (!exportType || !exportFormat) {
    return `export_${new Date().toISOString().split('T')[0]}.${formatId}`
  }

  const timestamp = new Date().toISOString().split('T')[0]
  return `${exportType.filename}_${timestamp}.${exportFormat.extension}`
}
