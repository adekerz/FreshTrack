/**
 * Centralized Export Types Configuration
 * Defines all available export types and their column structures
 */

const EXPORT_TYPES = {
  products: {
    id: 'products',
    labelKey: 'export.products',
    endpoint: '/products',
    columns: [
      { key: 'product_name', labelKey: 'product.name', width: 200 },
      { key: 'category_name', labelKey: 'category.name', width: 150 },
      { key: 'unit', labelKey: 'product.unit', width: 100 },
      { key: 'reorder_level', labelKey: 'product.reorderLevel', width: 120, format: 'number' },
      { key: 'created_at', labelKey: 'common.createdAt', width: 150, format: 'date' }
    ]
  },

  batches: {
    id: 'batches',
    labelKey: 'export.batches',
    endpoint: '/batches',
    columns: [
      { key: 'batch_number', labelKey: 'batch.batchNumber', width: 150 },
      { key: 'product_name', labelKey: 'product.name', width: 200 },
      { key: 'department_name', labelKey: 'department.name', width: 150 },
      { key: 'quantity', labelKey: 'batch.quantity', width: 100, format: 'number' },
      { key: 'expiry_date', labelKey: 'batch.expiryDate', width: 120, format: 'date' },
      { key: 'status', labelKey: 'batch.status', width: 100 },
      { key: 'created_at', labelKey: 'common.createdAt', width: 150, format: 'date' }
    ]
  },

  inventory: {
    id: 'inventory',
    labelKey: 'export.inventory',
    endpoint: '/inventory',
    columns: [
      { key: 'batch_number', labelKey: 'batch.batchNumber', width: 150 },
      { key: 'product_name', labelKey: 'product.name', width: 200 },
      { key: 'department_name', labelKey: 'department.name', width: 150 },
      { key: 'category_name', labelKey: 'category.name', width: 150 },
      { key: 'quantity', labelKey: 'batch.quantity', width: 100, format: 'number' },
      { key: 'unit', labelKey: 'product.unit', width: 100 },
      { key: 'expiry_date', labelKey: 'batch.expiryDate', width: 120, format: 'date' },
      { key: 'days_until_expiry', labelKey: 'batch.daysUntilExpiry', width: 120, format: 'number' }
    ]
  },

  collections: {
    id: 'collections',
    labelKey: 'export.collections',
    endpoint: '/collections',
    columns: [
      { key: 'collected_at', labelKey: 'collection.collectedAt', width: 150, format: 'date' },
      { key: 'product_name', labelKey: 'product.name', width: 200 },
      { key: 'department_name', labelKey: 'department.name', width: 150 },
      { key: 'quantity', labelKey: 'collection.quantity', width: 100, format: 'number' },
      { key: 'reason', labelKey: 'collection.reason', width: 200 },
      { key: 'collected_by_name', labelKey: 'collection.collectedBy', width: 150 },
      { key: 'batch_number', labelKey: 'batch.batchNumber', width: 150 },
      { key: 'expiry_date', labelKey: 'batch.expiryDate', width: 120, format: 'date' }
    ]
  },

  categories: {
    id: 'categories',
    labelKey: 'export.categories',
    endpoint: '/categories',
    columns: [
      { key: 'name', labelKey: 'category.name', width: 200 },
      { key: 'description', labelKey: 'category.description', width: 300 },
      { key: 'created_at', labelKey: 'common.createdAt', width: 150, format: 'date' }
    ]
  },

  departments: {
    id: 'departments',
    labelKey: 'export.departments',
    endpoint: '/departments',
    columns: [
      { key: 'name', labelKey: 'department.name', width: 200 },
      { key: 'description', labelKey: 'department.description', width: 300 },
      { key: 'email', labelKey: 'department.email', width: 200 },
      { key: 'telegram_chat_id', labelKey: 'department.telegramChatId', width: 150 },
      { key: 'created_at', labelKey: 'common.createdAt', width: 150, format: 'date' }
    ]
  },

  audit: {
    id: 'audit',
    labelKey: 'export.audit',
    endpoint: '/audit-logs',
    columns: [
      { key: 'timestamp', labelKey: 'audit.timestamp', width: 150, format: 'date' },
      { key: 'user_name', labelKey: 'audit.user', width: 150 },
      { key: 'action', labelKey: 'audit.action', width: 150 },
      { key: 'resource_type', labelKey: 'audit.resourceType', width: 150 },
      { key: 'resource_id', labelKey: 'audit.resourceId', width: 100 },
      { key: 'ip_address', labelKey: 'audit.ipAddress', width: 130 },
      { key: 'status', labelKey: 'audit.status', width: 100 }
    ]
  }
}

/**
 * Get export type configuration by ID
 * @param {string} typeId - Export type identifier
 * @returns {Object|null} Export type configuration or null if not found
 */
function getExportType(typeId) {
  return EXPORT_TYPES[typeId] || null
}

/**
 * Get all available export types
 * @returns {Object} All export type configurations
 */
function getAllExportTypes() {
  return EXPORT_TYPES
}

/**
 * Get columns for a specific export type
 * @param {string} typeId - Export type identifier
 * @returns {Array} Column definitions or empty array if type not found
 */
function getExportColumns(typeId) {
  const exportType = getExportType(typeId)
  return exportType ? exportType.columns : []
}

/**
 * Check if export type exists
 * @param {string} typeId - Export type identifier
 * @returns {boolean} True if export type exists
 */
function isValidExportType(typeId) {
  return typeId in EXPORT_TYPES
}

module.exports = {
  EXPORT_TYPES,
  getExportType,
  getAllExportTypes,
  getExportColumns,
  isValidExportType
}
