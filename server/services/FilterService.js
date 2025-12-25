/**
 * FreshTrack Filter Service - Phase 6: Unified Data Filtering
 * 
 * Центральный сервис для парсинга и построения унифицированных фильтров.
 * Обеспечивает консистентную работу пагинации, фильтрации и экспорта
 * во всех разделах системы (Инвентарь, Статистика, Календарь, Журнал действий).
 * 
 * Provides consistent filter parsing, validation, and SQL generation
 * for products, batches, write-offs, audit logs, etc.
 * 
 * @module FilterService
 */

import { buildContextWhere } from '../db/database.js'

/**
 * Expiry status values for programmatic filtering (virtual fields not stored in DB)
 */
export const ExpiryStatusFilter = {
  EXPIRED: 'expired',
  CRITICAL: 'critical',    // <= 3 days
  WARNING: 'warning',      // 4-7 days
  GOOD: 'good',           // > 7 days
  FRESH: 'fresh'          // > 14 days
}

/**
 * Default pagination limits
 */
export const PaginationDefaults = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  EXPORT_LIMIT: 10000
}

/**
 * Filter operators for advanced queries
 */
export const FilterOperator = {
  EQ: 'eq',           // equals
  NE: 'ne',           // not equals
  GT: 'gt',           // greater than
  GTE: 'gte',         // greater than or equal
  LT: 'lt',           // less than
  LTE: 'lte',         // less than or equal
  LIKE: 'like',       // contains (case-insensitive)
  IN: 'in',           // in array
  NOT_IN: 'not_in',   // not in array
  BETWEEN: 'between', // between two values
  IS_NULL: 'is_null', // is null
  IS_NOT_NULL: 'is_not_null' // is not null
}

/**
 * Standard filter fields for each entity type
 */
export const FilterableFields = {
  products: ['id', 'name', 'barcode', 'category_id', 'department_id', 'is_active', 'created_at'],
  batches: ['id', 'product_id', 'department_id', 'status', 'expiry_date', 'quantity', 'created_at'],
  writeOffs: ['id', 'product_id', 'department_id', 'reason', 'expiry_status', 'created_at'],
  auditLogs: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'created_at'],
  users: ['id', 'name', 'email', 'role', 'department_id', 'is_active', 'created_at']
}

/**
 * Parse filter value based on operator
 */
function parseFilterValue(value, operator) {
  if (operator === FilterOperator.IN || operator === FilterOperator.NOT_IN) {
    return Array.isArray(value) ? value : value.split(',').map(v => v.trim())
  }
  if (operator === FilterOperator.BETWEEN) {
    return Array.isArray(value) ? value : value.split(',').map(v => v.trim())
  }
  return value
}

/**
 * Filter Service class
 */
export class FilterService {
  
  /**
   * Parse query string filters into structured format
   * @param {Object} query - Express req.query object
   * @param {string} entityType - Type of entity (products, batches, etc.)
   * @returns {Array} - Array of filter objects
   */
  static parseFilters(query, entityType) {
    const allowedFields = FilterableFields[entityType] || []
    const filters = []
    
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue
      
      // Skip pagination and sorting params
      if (['page', 'limit', 'sort_by', 'sort_order', 'offset'].includes(key)) continue
      
      // Parse field:operator format (e.g., created_at:gte)
      const [field, operator = FilterOperator.EQ] = key.split(':')
      
      // Validate field is allowed
      if (!allowedFields.includes(field) && !['search', 'status', 'date_from', 'date_to'].includes(field)) {
        continue
      }
      
      filters.push({
        field,
        operator,
        value: parseFilterValue(value, operator)
      })
    }
    
    return filters
  }
  
  /**
   * Build SQL WHERE conditions from filters
   * @param {Array} filters - Array of filter objects
   * @param {Object} options - { tableAlias, startParamIndex }
   * @returns {Object} - { conditions: string[], params: any[], nextParamIndex: number }
   */
  static buildWhereConditions(filters, options = {}) {
    const { tableAlias = '', startParamIndex = 1 } = options
    const prefix = tableAlias ? `${tableAlias}.` : ''
    const conditions = []
    const params = []
    let paramIndex = startParamIndex
    
    for (const filter of filters) {
      const { field, operator, value } = filter
      const columnName = `${prefix}${field}`
      
      switch (operator) {
        case FilterOperator.EQ:
          conditions.push(`${columnName} = $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.NE:
          conditions.push(`${columnName} != $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.GT:
          conditions.push(`${columnName} > $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.GTE:
          conditions.push(`${columnName} >= $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.LT:
          conditions.push(`${columnName} < $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.LTE:
          conditions.push(`${columnName} <= $${paramIndex++}`)
          params.push(value)
          break
          
        case FilterOperator.LIKE:
          conditions.push(`LOWER(${columnName}) LIKE LOWER($${paramIndex++})`)
          params.push(`%${value}%`)
          break
          
        case FilterOperator.IN:
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => `$${paramIndex++}`).join(', ')
            conditions.push(`${columnName} IN (${placeholders})`)
            params.push(...value)
          }
          break
          
        case FilterOperator.NOT_IN:
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => `$${paramIndex++}`).join(', ')
            conditions.push(`${columnName} NOT IN (${placeholders})`)
            params.push(...value)
          }
          break
          
        case FilterOperator.BETWEEN:
          if (Array.isArray(value) && value.length === 2) {
            conditions.push(`${columnName} BETWEEN $${paramIndex++} AND $${paramIndex++}`)
            params.push(value[0], value[1])
          }
          break
          
        case FilterOperator.IS_NULL:
          conditions.push(`${columnName} IS NULL`)
          break
          
        case FilterOperator.IS_NOT_NULL:
          conditions.push(`${columnName} IS NOT NULL`)
          break
      }
    }
    
    return {
      conditions,
      params,
      nextParamIndex: paramIndex
    }
  }
  
  /**
   * Build full WHERE clause string
   * @param {Array} filters - Array of filter objects
   * @param {Object} baseConditions - { conditions: string[], params: any[] }
   * @param {Object} options - { tableAlias, startParamIndex }
   * @returns {Object} - { whereClause: string, params: any[] }
   */
  static buildWhereClause(filters, baseConditions = { conditions: [], params: [] }, options = {}) {
    const { startParamIndex = baseConditions.params.length + 1 } = options
    
    const filterResult = this.buildWhereConditions(filters, {
      ...options,
      startParamIndex
    })
    
    const allConditions = [...baseConditions.conditions, ...filterResult.conditions]
    const allParams = [...baseConditions.params, ...filterResult.params]
    
    const whereClause = allConditions.length > 0
      ? `WHERE ${allConditions.join(' AND ')}`
      : ''
    
    return {
      whereClause,
      params: allParams,
      nextParamIndex: filterResult.nextParamIndex
    }
  }
  
  /**
   * Build ORDER BY clause from query params
   * @param {Object} query - { sort_by, sort_order }
   * @param {string} entityType - Type of entity
   * @param {Object} options - { tableAlias, defaultSort }
   * @returns {string} - ORDER BY clause
   */
  static buildOrderBy(query, entityType, options = {}) {
    const { tableAlias = '', defaultSort = { field: 'created_at', order: 'DESC' } } = options
    const prefix = tableAlias ? `${tableAlias}.` : ''
    
    const allowedFields = FilterableFields[entityType] || []
    const sortField = allowedFields.includes(query.sort_by) ? query.sort_by : defaultSort.field
    const sortOrder = ['ASC', 'DESC'].includes(query.sort_order?.toUpperCase()) 
      ? query.sort_order.toUpperCase() 
      : defaultSort.order
    
    return `ORDER BY ${prefix}${sortField} ${sortOrder}`
  }
  
  /**
   * Build LIMIT/OFFSET clause from query params
   * @param {Object} query - { page, limit, offset }
   * @param {Object} options - { maxLimit, defaultLimit }
   * @returns {Object} - { limitClause: string, pagination: { page, limit, offset } }
   */
  static buildPagination(query, options = {}) {
    const { maxLimit = 1000, defaultLimit = 50 } = options
    
    let limit = parseInt(query.limit) || defaultLimit
    limit = Math.min(Math.max(1, limit), maxLimit)
    
    const page = Math.max(1, parseInt(query.page) || 1)
    const offset = query.offset !== undefined 
      ? parseInt(query.offset) 
      : (page - 1) * limit
    
    return {
      limitClause: `LIMIT ${limit} OFFSET ${offset}`,
      pagination: { page, limit, offset }
    }
  }
  
  /**
   * Build complete query components from request
   * @param {Object} query - Express req.query
   * @param {string} entityType - Type of entity
   * @param {Object} baseConditions - Initial conditions (e.g., hotel_id filter)
   * @param {Object} options - Configuration options
   * @returns {Object} - Complete query components
   */
  static buildQueryComponents(query, entityType, baseConditions = { conditions: [], params: [] }, options = {}) {
    const filters = this.parseFilters(query, entityType)
    const { whereClause, params, nextParamIndex } = this.buildWhereClause(filters, baseConditions, options)
    const orderBy = this.buildOrderBy(query, entityType, options)
    const { limitClause, pagination } = this.buildPagination(query, options)
    
    return {
      filters,
      whereClause,
      orderBy,
      limitClause,
      params,
      pagination,
      nextParamIndex
    }
  }
}

export default FilterService

/**
 * ============================================================================
 * PHASE 6: UNIFIED FILTERS EXTENSION
 * Additional methods for unified filtering pattern across all sections
 * ============================================================================
 */

/**
 * Common filter interface parsed from request query (Phase 6 spec)
 * @typedef {Object} CommonFilters
 * @property {string} [hotelId] - Hotel ID for context
 * @property {string[]} [departmentIds] - Array of department IDs
 * @property {string[]} [categoryIds] - Array of category IDs
 * @property {Date} [dateFrom] - Start date for date range
 * @property {Date} [dateTo] - End date for date range
 * @property {string[]} [status] - Status filter (can be DB status or virtual expiry status)
 * @property {string} [search] - Search term for text filtering
 * @property {string} [productId] - Single product ID filter
 * @property {string} [userId] - User ID filter (for audit logs)
 * @property {string} [action] - Action filter (for audit logs)
 * @property {string} [entityType] - Entity type filter (for audit logs)
 * @property {number} limit - Page size
 * @property {number} offset - Offset for pagination
 * @property {string} [sortBy] - Field to sort by
 * @property {string} [sortDir] - Sort direction (ASC/DESC)
 * @property {string} [locale] - User locale for status text
 * @property {boolean} [isExport] - Whether this is an export operation
 */

/**
 * Paginated response structure (Phase 6 spec)
 * @typedef {Object} PaginatedResponse
 * @property {Array} data - Result data array
 * @property {number} total - Total count of records
 * @property {number} limit - Page size used
 * @property {number} offset - Offset used
 * @property {boolean} hasNext - Whether more pages exist
 * @property {boolean} hasPrev - Whether previous pages exist
 * @property {number} page - Current page number (1-indexed)
 * @property {number} totalPages - Total number of pages
 */

/**
 * UnifiedFilterService - Phase 6 extension for unified query filtering
 * Integrates with existing FilterService and buildContextWhere
 */
export class UnifiedFilterService {
  /**
   * Parse request query parameters into typed CommonFilters object
   * Handles array normalization for IDs that may come as string or array
   * 
   * @param {Object} query - req.query object
   * @param {Object} [options] - Parsing options
   * @param {boolean} [options.isExport=false] - Use export limits
   * @returns {CommonFilters} Typed filter object
   */
  static parseCommonFilters(query, options = {}) {
    const { isExport = false } = options
    
    // Determine limit based on context
    let limit = parseInt(query.limit) || PaginationDefaults.DEFAULT_LIMIT
    if (isExport) {
      limit = Math.min(parseInt(query.limit) || PaginationDefaults.EXPORT_LIMIT, PaginationDefaults.EXPORT_LIMIT)
    } else {
      limit = Math.min(limit, PaginationDefaults.MAX_LIMIT)
    }
    
    return {
      // Context filters
      hotelId: query.hotel_id || query.hotelId,
      
      // Multi-value filters (normalize to arrays)
      departmentIds: this.normalizeToArray(query.department_ids || query.departmentIds || query.department_id),
      categoryIds: this.normalizeToArray(query.category_ids || query.categoryIds || query.category_id),
      status: this.normalizeToArray(query.status),
      
      // Date range filters
      dateFrom: this.parseDate(query.date_from || query.dateFrom),
      dateTo: this.parseDate(query.date_to || query.dateTo),
      
      // Single value filters
      productId: query.product_id || query.productId,
      userId: query.user_id || query.userId,
      action: query.action,
      entityType: query.entity_type || query.entityType,
      
      // Text search
      search: query.search?.trim() || query.q?.trim(),
      
      // Pagination
      limit,
      offset: Math.max(0, parseInt(query.offset) || 0),
      
      // Sorting
      sortBy: query.sort_by || query.sortBy || query.sort,
      sortDir: this.normalizeSortDirection(query.sort_dir || query.sortDir || query.order),
      
      // Locale for status text
      locale: query.locale || 'ru',
      
      // Export flag
      isExport
    }
  }

  /**
   * Normalize a value to an array
   * Handles: undefined, string, array of strings
   * 
   * @param {string|string[]|undefined} value - Value to normalize
   * @returns {string[]|undefined} Array or undefined
   */
  static normalizeToArray(value) {
    if (!value) return undefined
    if (Array.isArray(value)) return value.filter(Boolean)
    return [value].filter(Boolean)
  }

  /**
   * Parse date string to Date object
   * 
   * @param {string|undefined} dateStr - Date string
   * @returns {Date|undefined} Parsed date or undefined
   */
  static parseDate(dateStr) {
    if (!dateStr) return undefined
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? undefined : date
  }

  /**
   * Normalize sort direction to ASC/DESC
   * 
   * @param {string|undefined} dir - Sort direction input
   * @returns {string} Normalized direction (ASC or DESC)
   */
  static normalizeSortDirection(dir) {
    if (!dir) return 'DESC'
    const upper = String(dir).toUpperCase()
    return upper === 'ASC' ? 'ASC' : 'DESC'
  }

  /**
   * Build SQL WHERE clause with context integration
   * Combines access control (buildContextWhere) with filter conditions
   * 
   * @param {CommonFilters} filters - Parsed filters
   * @param {Object} context - User context { hotelId, departmentId, role, canAccessAllDepartments }
   * @param {Object} [options] - Build options
   * @param {string} [options.tableAlias=''] - Table alias for SQL
   * @param {string} [options.dateField='expiry_date'] - Field for date filtering
   * @param {number} [options.startParamIndex=1] - Starting parameter index
   * @returns {{ where: string, params: any[], nextParamIndex: number }}
   */
  static buildContextualWhere(filters, context, options = {}) {
    const {
      tableAlias = '',
      dateField = 'expiry_date',
      startParamIndex = 1
    } = options
    
    const prefix = tableAlias ? `${tableAlias}.` : ''
    
    // Start with context-based access control
    const contextWhere = buildContextWhere(context, tableAlias, startParamIndex)
    const conditions = contextWhere.where !== '1=1' ? [contextWhere.where] : []
    const params = [...contextWhere.params]
    let paramIndex = contextWhere.nextParamIndex

    // Department IDs filter (if user can access all departments)
    if (filters.departmentIds?.length && context.canAccessAllDepartments !== false) {
      const placeholders = filters.departmentIds.map(() => `$${paramIndex++}`)
      conditions.push(`${prefix}department_id IN (${placeholders.join(', ')})`)
      params.push(...filters.departmentIds)
    }

    // Category IDs filter
    if (filters.categoryIds?.length) {
      const placeholders = filters.categoryIds.map(() => `$${paramIndex++}`)
      conditions.push(`${prefix}category_id IN (${placeholders.join(', ')})`)
      params.push(...filters.categoryIds)
    }

    // Date range filter
    if (filters.dateFrom) {
      conditions.push(`${prefix}${dateField} >= $${paramIndex++}`)
      params.push(filters.dateFrom.toISOString())
    }
    if (filters.dateTo) {
      conditions.push(`${prefix}${dateField} <= $${paramIndex++}`)
      params.push(filters.dateTo.toISOString())
    }

    // Product ID filter
    if (filters.productId) {
      conditions.push(`${prefix}product_id = $${paramIndex++}`)
      params.push(filters.productId)
    }

    // User ID filter (for audit logs)
    if (filters.userId) {
      conditions.push(`${prefix}user_id = $${paramIndex++}`)
      params.push(filters.userId)
    }

    // Action filter (for audit logs)
    if (filters.action) {
      conditions.push(`${prefix}action = $${paramIndex++}`)
      params.push(filters.action)
    }

    // Entity type filter (for audit logs)
    if (filters.entityType) {
      conditions.push(`${prefix}entity_type = $${paramIndex++}`)
      params.push(filters.entityType)
    }

    // DB-level status filter (not virtual expiry status)
    if (filters.status?.length) {
      const dbStatuses = filters.status.filter(s => !this.isVirtualStatus(s))
      if (dbStatuses.length) {
        const placeholders = dbStatuses.map(() => `$${paramIndex++}`)
        conditions.push(`${prefix}status IN (${placeholders.join(', ')})`)
        params.push(...dbStatuses)
      }
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1'
    
    return { where, params, nextParamIndex: paramIndex }
  }

  /**
   * Check if status is a virtual expiry status (computed, not in DB)
   * 
   * @param {string} status - Status to check
   * @returns {boolean} True if virtual status
   */
  static isVirtualStatus(status) {
    const virtualStatuses = Object.values(ExpiryStatusFilter)
    return virtualStatuses.includes(status?.toLowerCase())
  }

  /**
   * Filter results by virtual expiry status (post-query filtering)
   * 
   * @param {Array} results - Results with enriched expiry data
   * @param {string[]} [statusFilter] - Status values to filter by
   * @returns {Array} Filtered results
   */
  static filterByVirtualStatus(results, statusFilter) {
    if (!statusFilter?.length) return results
    
    const virtualStatuses = statusFilter.filter(s => this.isVirtualStatus(s))
    if (!virtualStatuses.length) return results
    
    return results.filter(item => {
      const itemStatus = (item.expiryStatus || item.expiry_status || '').toLowerCase()
      return virtualStatuses.some(s => s.toLowerCase() === itemStatus)
    })
  }

  /**
   * Filter results by search term (post-query text filtering)
   * 
   * @param {Array} results - Results array
   * @param {string} [search] - Search term
   * @param {string[]} [searchFields] - Fields to search
   * @returns {Array} Filtered results
   */
  static filterBySearch(results, search, searchFields = ['name', 'product_name', 'batch_code', 'supplier']) {
    if (!search) return results
    
    const searchLower = search.toLowerCase()
    
    return results.filter(item => {
      return searchFields.some(field => {
        const value = item[field]
        return value && String(value).toLowerCase().includes(searchLower)
      })
    })
  }

  /**
   * Create paginated response structure
   * 
   * @param {Array} data - Result data
   * @param {number} total - Total count
   * @param {CommonFilters} filters - Filters used
   * @returns {PaginatedResponse} Paginated response object
   */
  static createPaginatedResponse(data, total, filters) {
    const { limit, offset } = filters
    const page = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total / limit)
    
    return {
      data,
      total,
      limit,
      offset,
      hasNext: offset + data.length < total,
      hasPrev: offset > 0,
      page,
      totalPages
    }
  }

  /**
   * Apply post-query filters (virtual status, search)
   * Used after fetching from DB to filter by computed fields
   * 
   * @param {Array} results - DB results
   * @param {CommonFilters} filters - Filters to apply
   * @param {Object} [options] - Filter options
   * @param {string[]} [options.searchFields] - Fields to search in
   * @returns {Array} Filtered results
   */
  static applyPostQueryFilters(results, filters, options = {}) {
    let filtered = results
    
    // Filter by virtual expiry status
    if (filters.status?.length) {
      const virtualStatuses = filters.status.filter(s => this.isVirtualStatus(s))
      if (virtualStatuses.length) {
        filtered = this.filterByVirtualStatus(filtered, virtualStatuses)
      }
    }
    
    // Filter by search term
    if (filters.search) {
      filtered = this.filterBySearch(filtered, filters.search, options.searchFields)
    }
    
    return filtered
  }

  /**
   * Separate status filters into DB and virtual
   * 
   * @param {string[]} [statusFilter] - Status filter array
   * @returns {{ dbStatuses: string[], virtualStatuses: string[] }}
   */
  static separateStatusFilters(statusFilter) {
    if (!statusFilter?.length) {
      return { dbStatuses: [], virtualStatuses: [] }
    }
    
    const dbStatuses = []
    const virtualStatuses = []
    
    for (const status of statusFilter) {
      if (this.isVirtualStatus(status)) {
        virtualStatuses.push(status.toLowerCase())
      } else {
        dbStatuses.push(status)
      }
    }
    
    return { dbStatuses, virtualStatuses }
  }
}
