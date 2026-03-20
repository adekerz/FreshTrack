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
  },

  // ── Analytics Reports ──────────────────────────────────────────────
  'health-summary': {
    id: 'health-summary',
    endpoint: '/reports/health-summary',
    filename: 'health_summary',
    title: 'Здоровье инвентаря',
    subtitle: 'Сводка по статусам партий по отделам',
    columnsKey: 'healthSummary',
    labelKey: 'export.healthSummary',
    isReport: true
  },

  'expiry-forecast': {
    id: 'expiry-forecast',
    endpoint: '/reports/expiry-forecast',
    filename: 'expiry_forecast',
    title: 'Прогноз истечения',
    subtitle: 'Товары с истекающим сроком годности',
    columnsKey: 'expiryForecast',
    labelKey: 'export.expiryForecast',
    isReport: true
  },

  'collection-activity': {
    id: 'collection-activity',
    endpoint: '/reports/collection-activity',
    filename: 'collection_activity',
    title: 'Активность сборов',
    subtitle: 'Детальный журнал сборов с причинами',
    columnsKey: 'collectionActivity',
    labelKey: 'export.collectionActivity',
    isReport: true
  },

  'product-turnover': {
    id: 'product-turnover',
    endpoint: '/reports/product-turnover',
    filename: 'product_turnover',
    title: 'Оборот продуктов',
    subtitle: 'Скорость потребления vs. списание',
    columnsKey: 'productTurnover',
    labelKey: 'export.productTurnover',
    isReport: true
  },

  'department-scorecard': {
    id: 'department-scorecard',
    endpoint: '/reports/department-scorecard',
    filename: 'department_scorecard',
    title: 'Рейтинг отделов',
    subtitle: 'Сравнение отделов по качеству управления',
    columnsKey: 'departmentScorecard',
    labelKey: 'export.departmentScorecard',
    isReport: true
  },

  'collection-reasons': {
    id: 'collection-reasons',
    endpoint: '/reports/collection-reasons',
    filename: 'collection_reasons',
    title: 'Причины сборов',
    subtitle: 'Распределение сборов по причинам',
    columnsKey: 'collectionReasons',
    labelKey: 'export.collectionReasons',
    isReport: true
  },

  'batch-age-distribution': {
    id: 'batch-age-distribution',
    endpoint: '/reports/batch-age-distribution',
    filename: 'batch_age_distribution',
    title: 'Распределение по возрасту',
    subtitle: 'Партии сгруппированы по остатку срока',
    columnsKey: 'batchAgeDistribution',
    labelKey: 'export.batchAgeDistribution',
    isReport: true
  },

  'weekly-summary': {
    id: 'weekly-summary',
    endpoint: '/reports/weekly-summary',
    filename: 'weekly_summary',
    title: 'Еженедельный отчёт',
    subtitle: 'KPI за неделю с динамикой',
    columnsKey: 'weeklySummary',
    labelKey: 'export.weeklySummary',
    isReport: true
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
