/**
 * FreshTrack FilterService Tests - Phase 6
 * Tests for unified filtering, pagination, and query building
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  FilterService,
  UnifiedFilterService,
  FilterOperator,
  FilterableFields,
  ExpiryStatusFilter,
  PaginationDefaults
} from '../services/FilterService.js'

// Mock buildContextWhere from database
vi.mock('../db/database.js', () => ({
  buildContextWhere: vi.fn((context, tableAlias, startIndex) => {
    const prefix = tableAlias ? `${tableAlias}.` : ''
    const conditions = []
    const params = []
    let idx = startIndex
    
    if (context.hotelId) {
      conditions.push(`${prefix}hotel_id = $${idx++}`)
      params.push(context.hotelId)
    }
    if (context.departmentId && context.role === 'STAFF') {
      conditions.push(`${prefix}department_id = $${idx++}`)
      params.push(context.departmentId)
    }
    
    return {
      where: conditions.length ? conditions.join(' AND ') : '1=1',
      params,
      nextParamIndex: idx
    }
  })
}))

describe('FilterService (Legacy)', () => {
  describe('parseFilters', () => {
    it('should parse basic equality filters', () => {
      const query = { status: 'active', department_id: 'dept1' }
      const filters = FilterService.parseFilters(query, 'batches')
      
      expect(filters).toHaveLength(2)
      expect(filters).toContainEqual({ field: 'status', operator: 'eq', value: 'active' })
      expect(filters).toContainEqual({ field: 'department_id', operator: 'eq', value: 'dept1' })
    })
    
    it('should parse operator suffix filters (e.g., created_at:gte)', () => {
      const query = { 'created_at:gte': '2024-01-01' }
      const filters = FilterService.parseFilters(query, 'batches')
      
      expect(filters).toHaveLength(1)
      expect(filters[0]).toEqual({
        field: 'created_at',
        operator: 'gte',
        value: '2024-01-01'
      })
    })
    
    it('should parse IN operator with comma-separated values', () => {
      const query = { 'status:in': 'active,expired,critical' }
      const filters = FilterService.parseFilters(query, 'batches')
      
      expect(filters[0].value).toEqual(['active', 'expired', 'critical'])
    })
    
    it('should skip pagination and sorting params', () => {
      const query = { page: '1', limit: '50', sort_by: 'name', sort_order: 'ASC', status: 'active' }
      const filters = FilterService.parseFilters(query, 'batches')
      
      expect(filters).toHaveLength(1)
      expect(filters[0].field).toBe('status')
    })
    
    it('should skip fields not in allowedFields', () => {
      const query = { invalid_field: 'value', status: 'active' }
      const filters = FilterService.parseFilters(query, 'batches')
      
      expect(filters).toHaveLength(1)
      expect(filters[0].field).toBe('status')
    })
  })
  
  describe('buildWhereConditions', () => {
    it('should build equality condition', () => {
      const filters = [{ field: 'status', operator: FilterOperator.EQ, value: 'active' }]
      const result = FilterService.buildWhereConditions(filters, { startParamIndex: 1 })
      
      expect(result.conditions).toContain('status = $1')
      expect(result.params).toContain('active')
    })
    
    it('should build LIKE condition for text search', () => {
      const filters = [{ field: 'name', operator: FilterOperator.LIKE, value: 'test' }]
      const result = FilterService.buildWhereConditions(filters, { startParamIndex: 1 })
      
      expect(result.conditions).toContain('LOWER(name) LIKE LOWER($1)')
      expect(result.params).toContain('%test%')
    })
    
    it('should build IN condition', () => {
      const filters = [{ field: 'status', operator: FilterOperator.IN, value: ['active', 'expired'] }]
      const result = FilterService.buildWhereConditions(filters, { startParamIndex: 1 })
      
      expect(result.conditions).toContain('status IN ($1, $2)')
      expect(result.params).toEqual(['active', 'expired'])
    })
    
    it('should build BETWEEN condition', () => {
      const filters = [{ field: 'created_at', operator: FilterOperator.BETWEEN, value: ['2024-01-01', '2024-12-31'] }]
      const result = FilterService.buildWhereConditions(filters, { startParamIndex: 1 })
      
      expect(result.conditions).toContain('created_at BETWEEN $1 AND $2')
      expect(result.params).toEqual(['2024-01-01', '2024-12-31'])
    })
    
    it('should handle table alias', () => {
      const filters = [{ field: 'status', operator: FilterOperator.EQ, value: 'active' }]
      const result = FilterService.buildWhereConditions(filters, { tableAlias: 'b', startParamIndex: 1 })
      
      expect(result.conditions).toContain('b.status = $1')
    })
    
    it('should build IS_NULL condition', () => {
      const filters = [{ field: 'deleted_at', operator: FilterOperator.IS_NULL, value: true }]
      const result = FilterService.buildWhereConditions(filters)
      
      expect(result.conditions).toContain('deleted_at IS NULL')
      expect(result.params).toHaveLength(0)
    })
  })
  
  describe('buildPagination', () => {
    it('should use defaults when no params provided', () => {
      const result = FilterService.buildPagination({})
      
      expect(result.pagination.limit).toBe(50)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.offset).toBe(0)
    })
    
    it('should calculate offset from page number', () => {
      const result = FilterService.buildPagination({ page: '3', limit: '20' })
      
      expect(result.pagination.offset).toBe(40)
    })
    
    it('should use explicit offset over page calculation', () => {
      const result = FilterService.buildPagination({ page: '3', limit: '20', offset: '100' })
      
      expect(result.pagination.offset).toBe(100)
    })
    
    it('should enforce maxLimit', () => {
      const result = FilterService.buildPagination({ limit: '5000' }, { maxLimit: 1000 })
      
      expect(result.pagination.limit).toBe(1000)
    })
  })
  
  describe('buildOrderBy', () => {
    it('should use default sort when not specified', () => {
      const result = FilterService.buildOrderBy({}, 'batches')
      
      expect(result).toContain('ORDER BY')
      expect(result).toContain('created_at')
      expect(result).toContain('DESC')
    })
    
    it('should use specified sort field if allowed', () => {
      const result = FilterService.buildOrderBy({ sort_by: 'expiry_date', sort_order: 'ASC' }, 'batches')
      
      expect(result).toContain('expiry_date')
      expect(result).toContain('ASC')
    })
    
    it('should fall back to default for disallowed field', () => {
      const result = FilterService.buildOrderBy({ sort_by: 'DROP TABLE batches;' }, 'batches')
      
      expect(result).not.toContain('DROP')
      expect(result).toContain('created_at')
    })
  })
})

describe('UnifiedFilterService (Phase 6)', () => {
  describe('parseCommonFilters', () => {
    it('should parse basic filters from query', () => {
      const query = {
        hotel_id: 'h1',
        department_id: 'd1',
        status: 'active',
        limit: '25',
        offset: '50'
      }
      
      const filters = UnifiedFilterService.parseCommonFilters(query)
      
      expect(filters.hotelId).toBe('h1')
      expect(filters.departmentIds).toEqual(['d1'])
      expect(filters.status).toEqual(['active'])
      expect(filters.limit).toBe(25)
      expect(filters.offset).toBe(50)
    })
    
    it('should normalize array parameters', () => {
      const query = {
        department_ids: ['d1', 'd2', 'd3'],
        category_ids: 'c1' // single value should become array
      }
      
      const filters = UnifiedFilterService.parseCommonFilters(query)
      
      expect(filters.departmentIds).toEqual(['d1', 'd2', 'd3'])
      expect(filters.categoryIds).toEqual(['c1'])
    })
    
    it('should parse date filters', () => {
      const query = {
        date_from: '2024-01-01',
        date_to: '2024-12-31'
      }
      
      const filters = UnifiedFilterService.parseCommonFilters(query)
      
      expect(filters.dateFrom).toBeInstanceOf(Date)
      expect(filters.dateTo).toBeInstanceOf(Date)
      expect(filters.dateFrom.getFullYear()).toBe(2024)
    })
    
    it('should handle invalid dates gracefully', () => {
      const query = { date_from: 'invalid-date' }
      
      const filters = UnifiedFilterService.parseCommonFilters(query)
      
      expect(filters.dateFrom).toBeUndefined()
    })
    
    it('should use export limits when isExport=true', () => {
      const query = { limit: '100000' }
      
      const normalFilters = UnifiedFilterService.parseCommonFilters(query)
      const exportFilters = UnifiedFilterService.parseCommonFilters(query, { isExport: true })
      
      expect(normalFilters.limit).toBe(PaginationDefaults.MAX_LIMIT) // 500
      expect(exportFilters.limit).toBe(PaginationDefaults.EXPORT_LIMIT) // 10000
    })
    
    it('should parse search term and trim whitespace', () => {
      const query = { search: '  test product  ' }
      
      const filters = UnifiedFilterService.parseCommonFilters(query)
      
      expect(filters.search).toBe('test product')
    })
    
    it('should normalize sort direction', () => {
      expect(UnifiedFilterService.normalizeSortDirection('asc')).toBe('ASC')
      expect(UnifiedFilterService.normalizeSortDirection('ASC')).toBe('ASC')
      expect(UnifiedFilterService.normalizeSortDirection('desc')).toBe('DESC')
      expect(UnifiedFilterService.normalizeSortDirection(undefined)).toBe('DESC')
      expect(UnifiedFilterService.normalizeSortDirection('invalid')).toBe('DESC')
    })
  })
  
  describe('normalizeToArray', () => {
    it('should return undefined for empty values', () => {
      expect(UnifiedFilterService.normalizeToArray(undefined)).toBeUndefined()
      expect(UnifiedFilterService.normalizeToArray(null)).toBeUndefined()
      expect(UnifiedFilterService.normalizeToArray('')).toBeUndefined()
    })
    
    it('should convert string to single-element array', () => {
      expect(UnifiedFilterService.normalizeToArray('value')).toEqual(['value'])
    })
    
    it('should pass through arrays', () => {
      expect(UnifiedFilterService.normalizeToArray(['a', 'b'])).toEqual(['a', 'b'])
    })
    
    it('should filter out empty values from arrays', () => {
      expect(UnifiedFilterService.normalizeToArray(['a', '', null, 'b'])).toEqual(['a', 'b'])
    })
  })
  
  describe('isVirtualStatus', () => {
    it('should identify virtual expiry statuses', () => {
      expect(UnifiedFilterService.isVirtualStatus('expired')).toBe(true)
      expect(UnifiedFilterService.isVirtualStatus('critical')).toBe(true)
      expect(UnifiedFilterService.isVirtualStatus('warning')).toBe(true)
      expect(UnifiedFilterService.isVirtualStatus('good')).toBe(true)
      expect(UnifiedFilterService.isVirtualStatus('fresh')).toBe(true)
    })
    
    it('should not identify DB statuses as virtual', () => {
      expect(UnifiedFilterService.isVirtualStatus('active')).toBe(false)
      expect(UnifiedFilterService.isVirtualStatus('consumed')).toBe(false)
      expect(UnifiedFilterService.isVirtualStatus('written_off')).toBe(false)
    })
    
    it('should be case-insensitive', () => {
      expect(UnifiedFilterService.isVirtualStatus('EXPIRED')).toBe(true)
      expect(UnifiedFilterService.isVirtualStatus('Critical')).toBe(true)
    })
  })
  
  describe('separateStatusFilters', () => {
    it('should separate DB and virtual statuses', () => {
      const result = UnifiedFilterService.separateStatusFilters(['active', 'expired', 'critical', 'consumed'])
      
      expect(result.dbStatuses).toEqual(['active', 'consumed'])
      expect(result.virtualStatuses).toEqual(['expired', 'critical'])
    })
    
    it('should handle empty input', () => {
      const result = UnifiedFilterService.separateStatusFilters([])
      
      expect(result.dbStatuses).toEqual([])
      expect(result.virtualStatuses).toEqual([])
    })
    
    it('should handle undefined input', () => {
      const result = UnifiedFilterService.separateStatusFilters(undefined)
      
      expect(result.dbStatuses).toEqual([])
      expect(result.virtualStatuses).toEqual([])
    })
  })
  
  describe('filterByVirtualStatus', () => {
    const testData = [
      { id: 1, expiryStatus: 'expired' },
      { id: 2, expiryStatus: 'critical' },
      { id: 3, expiryStatus: 'warning' },
      { id: 4, expiryStatus: 'good' },
      { id: 5, expiryStatus: 'fresh' }
    ]
    
    it('should filter by single virtual status', () => {
      const result = UnifiedFilterService.filterByVirtualStatus(testData, ['expired'])
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })
    
    it('should filter by multiple virtual statuses', () => {
      const result = UnifiedFilterService.filterByVirtualStatus(testData, ['expired', 'critical'])
      
      expect(result).toHaveLength(2)
      expect(result.map(r => r.id)).toEqual([1, 2])
    })
    
    it('should return all if no virtual statuses in filter', () => {
      const result = UnifiedFilterService.filterByVirtualStatus(testData, ['active']) // DB status, not virtual
      
      expect(result).toEqual(testData)
    })
    
    it('should return all if filter is empty', () => {
      const result = UnifiedFilterService.filterByVirtualStatus(testData, [])
      
      expect(result).toEqual(testData)
    })
  })
  
  describe('filterBySearch', () => {
    const testData = [
      { id: 1, name: 'Apple Juice', supplier: 'FruitCo' },
      { id: 2, name: 'Orange Juice', supplier: 'CitrusFarm' },
      { id: 3, name: 'Milk', supplier: 'DairyFarm' }
    ]
    
    it('should filter by search term in name', () => {
      const result = UnifiedFilterService.filterBySearch(testData, 'juice')
      
      expect(result).toHaveLength(2)
    })
    
    it('should filter by search term in supplier', () => {
      const result = UnifiedFilterService.filterBySearch(testData, 'farm')
      
      expect(result).toHaveLength(2)
    })
    
    it('should be case-insensitive', () => {
      const result = UnifiedFilterService.filterBySearch(testData, 'APPLE')
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })
    
    it('should return all if search is empty', () => {
      const result = UnifiedFilterService.filterBySearch(testData, '')
      
      expect(result).toEqual(testData)
    })
    
    it('should use custom search fields', () => {
      const result = UnifiedFilterService.filterBySearch(testData, 'FruitCo', ['supplier'])
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })
  })
  
  describe('createPaginatedResponse', () => {
    it('should create correct pagination structure', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const filters = { limit: 10, offset: 0 }
      
      const result = UnifiedFilterService.createPaginatedResponse(data, 50, filters)
      
      expect(result.data).toEqual(data)
      expect(result.total).toBe(50)
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
      expect(result.hasNext).toBe(true)
      expect(result.hasPrev).toBe(false)
      expect(result.page).toBe(1)
      expect(result.totalPages).toBe(5)
    })
    
    it('should calculate page correctly', () => {
      const filters = { limit: 10, offset: 20 }
      
      const result = UnifiedFilterService.createPaginatedResponse([], 50, filters)
      
      expect(result.page).toBe(3)
    })
    
    it('should detect hasNext correctly', () => {
      const data = [{ id: 1 }]
      const filters = { limit: 10, offset: 40 }
      
      const result = UnifiedFilterService.createPaginatedResponse(data, 50, filters)
      
      expect(result.hasNext).toBe(true) // 40 + 1 < 50
    })
    
    it('should detect no hasNext on last page', () => {
      const data = [{ id: 1 }]
      const filters = { limit: 10, offset: 49 }
      
      const result = UnifiedFilterService.createPaginatedResponse(data, 50, filters)
      
      expect(result.hasNext).toBe(false) // 49 + 1 = 50
    })
  })
  
  describe('buildContextualWhere', () => {
    it('should integrate with buildContextWhere for access control', () => {
      const filters = UnifiedFilterService.parseCommonFilters({})
      const context = { hotelId: 'h1', role: 'HOTEL_ADMIN' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context)
      
      expect(result.where).toContain('hotel_id = $1')
      expect(result.params).toContain('h1')
    })
    
    it('should add department filter when departmentIds provided', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        department_ids: ['d1', 'd2']
      })
      const context = { hotelId: 'h1', role: 'HOTEL_ADMIN', canAccessAllDepartments: true }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context)
      
      expect(result.where).toContain('department_id IN')
      expect(result.params).toContain('d1')
      expect(result.params).toContain('d2')
    })
    
    it('should add category filter', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        category_ids: ['c1', 'c2']
      })
      const context = { hotelId: 'h1' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context)
      
      expect(result.where).toContain('category_id IN')
    })
    
    it('should add date range filter', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        date_from: '2024-01-01',
        date_to: '2024-12-31'
      })
      const context = { hotelId: 'h1' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context, {
        dateField: 'expiry_date'
      })
      
      expect(result.where).toContain('expiry_date >=')
      expect(result.where).toContain('expiry_date <=')
    })
    
    it('should filter only DB statuses, not virtual', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        status: ['active', 'expired', 'consumed', 'critical']
      })
      const context = { hotelId: 'h1' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context)
      
      // Should include 'active' and 'consumed', but NOT 'expired' or 'critical'
      expect(result.where).toContain('status IN')
      expect(result.params).toContain('active')
      expect(result.params).toContain('consumed')
      expect(result.params).not.toContain('expired')
      expect(result.params).not.toContain('critical')
    })
    
    it('should handle audit-specific filters', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        user_id: 'u1',
        action: 'create',
        entity_type: 'batch'
      })
      const context = { hotelId: 'h1' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context)
      
      expect(result.where).toContain('user_id = ')
      expect(result.where).toContain('action = ')
      expect(result.where).toContain('entity_type = ')
    })
    
    it('should use table alias correctly', () => {
      const filters = UnifiedFilterService.parseCommonFilters({ product_id: 'p1' })
      const context = { hotelId: 'h1' }
      
      const result = UnifiedFilterService.buildContextualWhere(filters, context, {
        tableAlias: 'b'
      })
      
      expect(result.where).toContain('b.product_id')
    })
  })
  
  describe('applyPostQueryFilters', () => {
    const testData = [
      { id: 1, name: 'Apple', expiryStatus: 'expired' },
      { id: 2, name: 'Orange', expiryStatus: 'critical' },
      { id: 3, name: 'Banana', expiryStatus: 'good' }
    ]
    
    it('should apply both virtual status and search filters', () => {
      const filters = UnifiedFilterService.parseCommonFilters({
        status: ['expired', 'critical'],
        search: 'orange'
      })
      
      const result = UnifiedFilterService.applyPostQueryFilters(testData, filters)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(2)
    })
    
    it('should return all if no post-query filters', () => {
      const filters = UnifiedFilterService.parseCommonFilters({})
      
      const result = UnifiedFilterService.applyPostQueryFilters(testData, filters)
      
      expect(result).toEqual(testData)
    })
  })
})

describe('FilterService Integration', () => {
  it('should handle complete query processing flow', () => {
    const query = {
      hotel_id: 'h1',
      department_ids: ['d1', 'd2'],
      status: ['active', 'expired'], // mixed DB and virtual
      search: 'apple',
      date_from: '2024-01-01',
      limit: '20',
      offset: '40',
      sort_by: 'expiry_date',
      sort_dir: 'asc'
    }
    
    // Step 1: Parse filters
    const filters = UnifiedFilterService.parseCommonFilters(query)
    
    expect(filters.hotelId).toBe('h1')
    expect(filters.departmentIds).toEqual(['d1', 'd2'])
    expect(filters.status).toEqual(['active', 'expired'])
    expect(filters.search).toBe('apple')
    expect(filters.dateFrom).toBeInstanceOf(Date)
    expect(filters.limit).toBe(20)
    expect(filters.offset).toBe(40)
    expect(filters.sortBy).toBe('expiry_date')
    expect(filters.sortDir).toBe('ASC')
    
    // Step 2: Build WHERE clause
    const context = { hotelId: 'h1', role: 'HOTEL_ADMIN', canAccessAllDepartments: true }
    const whereResult = UnifiedFilterService.buildContextualWhere(filters, context)
    
    expect(whereResult.where).toContain('hotel_id')
    expect(whereResult.where).toContain('department_id IN')
    expect(whereResult.where).toContain('status IN') // Only 'active', not 'expired'
    expect(whereResult.params).toContain('active')
    expect(whereResult.params).not.toContain('expired') // virtual, filtered post-query
    
    // Step 3: Separate status filters
    const { dbStatuses, virtualStatuses } = UnifiedFilterService.separateStatusFilters(filters.status)
    
    expect(dbStatuses).toEqual(['active'])
    expect(virtualStatuses).toEqual(['expired'])
  })
})
