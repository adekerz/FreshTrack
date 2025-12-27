/**
 * StatisticsService - Centralized Statistics Aggregation (Phase 3)
 * Single Source of Truth for all statistics calculations
 * 
 * Replaces frontend calculations with backend-driven aggregation
 * Uses buildContextWhere for hotel/department isolation
 */

import { getAllBatches, getAllProducts, getAllCategories } from '../db/database.js'
import { 
  enrichBatchesWithExpiryData, 
  ExpiryStatus, 
  StatusColor, 
  StatusCssClass 
} from './ExpiryService.js'

/**
 * @typedef {Object} StatisticsByStatus
 * @property {string} status - ExpiryStatus enum value (EXPIRED, CRITICAL, WARNING, GOOD, TODAY)
 * @property {string} label - Human-readable label
 * @property {number} count - Number of batches
 * @property {number} quantity - Total quantity
 * @property {string} color - Hex color from StatusColor
 * @property {string} cssClass - CSS class from StatusCssClass
 * @property {number} percentage - Percentage of total
 */

/**
 * @typedef {Object} StatisticsByCategory
 * @property {string} categoryId - Category ID
 * @property {string} categoryName - Category name
 * @property {string} color - Category color (hex)
 * @property {number} batchCount - Number of batches
 * @property {number} productCount - Number of products
 * @property {number} totalQuantity - Total quantity across batches
 * @property {Object} byStatus - Breakdown by expiry status
 */

/**
 * @typedef {Object} TrendDataPoint
 * @property {string} date - ISO date string
 * @property {number} expired - Count of expired on this date
 * @property {number} critical - Count of critical on this date
 * @property {number} warning - Count of warning on this date
 * @property {number} good - Count of good on this date
 */

/**
 * @typedef {Object} StatisticsResponse
 * @property {StatisticsByStatus[]} byStatus - Breakdown by expiry status
 * @property {StatisticsByCategory[]} byCategory - Breakdown by category
 * @property {TrendDataPoint[]} trends - Time series data for charts
 * @property {Object} total - Total counts
 * @property {Object} filters - Applied filters info
 */

/**
 * Status labels for UI (localized)
 */
const STATUS_LABELS = {
  [ExpiryStatus.EXPIRED]: { ru: 'Просрочено', en: 'Expired', kk: 'Мерзімі өткен' },
  [ExpiryStatus.TODAY]: { ru: 'Сегодня', en: 'Today', kk: 'Бүгін' },
  [ExpiryStatus.CRITICAL]: { ru: 'Критично', en: 'Critical', kk: 'Қауіпті' },
  [ExpiryStatus.WARNING]: { ru: 'Внимание', en: 'Warning', kk: 'Назар аударыңыз' },
  [ExpiryStatus.GOOD]: { ru: 'В норме', en: 'Good', kk: 'Қалыпты' }
}

/**
 * Get localized status label
 */
function getStatusLabel(status, locale = 'ru') {
  const labels = STATUS_LABELS[status]
  if (!labels) return status
  return labels[locale] || labels.ru || status
}

/**
 * StatisticsService - All statistics aggregation in one place
 */
export const StatisticsService = {
  /**
   * Get comprehensive statistics with context filtering
   * @param {Object} context - User context { hotelId, departmentId, canAccessAllDepartments }
   * @param {Object} options - { dateRange?: { from: Date, to: Date }, locale?: string }
   * @returns {Promise<StatisticsResponse>}
   */
  async getStatistics(context, options = {}) {
    const { hotelId, departmentId, canAccessAllDepartments } = context
    const { dateRange, locale = 'ru' } = options
    
    if (!hotelId) {
      throw new Error('hotelId required for statistics')
    }
    
    // Build context-aware filter
    const deptFilter = canAccessAllDepartments ? null : departmentId
    const dbFilters = { department_id: deptFilter }
    
    // Fetch data with context isolation
    const [rawBatches, products, categories] = await Promise.all([
      getAllBatches(hotelId, dbFilters),
      getAllProducts(hotelId, dbFilters),
      getAllCategories(hotelId)
    ])
    
    // Enrich batches with expiry data (Single Source of Truth)
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId,
      departmentId: deptFilter,
      locale
    })
    
    // Apply date range filter if provided
    if (dateRange?.from || dateRange?.to) {
      const fromMs = dateRange.from ? new Date(dateRange.from).getTime() : 0
      const toMs = dateRange.to ? new Date(dateRange.to).getTime() : Infinity
      
      batches = batches.filter(b => {
        if (!b.expiry_date) return false
        const expiryMs = new Date(b.expiry_date).getTime()
        return expiryMs >= fromMs && expiryMs <= toMs
      })
    }
    
    // Build category lookup map (ID → category)
    const categoryMap = new Map()
    for (const cat of categories) {
      categoryMap.set(cat.id, cat)
    }
    
    // Build product → category lookup
    const productCategoryMap = new Map()
    for (const product of products) {
      if (product.category_id) {
        productCategoryMap.set(product.id, product.category_id)
      }
    }
    
    // Calculate byStatus
    const byStatus = this._calculateByStatus(batches, locale)
    
    // Calculate byCategory (no "Other" - direct category_id resolution)
    const byCategory = this._calculateByCategory(batches, products, categoryMap, locale)
    
    // Calculate trends (last 30 days by default)
    const trends = this._calculateTrends(batches, options.trendDays || 30)
    
    // Calculate totals
    const total = {
      batches: batches.length,
      products: products.length,
      categories: categories.length,
      totalQuantity: batches.reduce((sum, b) => sum + (b.quantity || 0), 0),
      healthScore: this._calculateHealthScore(byStatus)
    }
    
    return {
      byStatus,
      byCategory,
      trends,
      total,
      filters: {
        hotelId,
        departmentId: deptFilter,
        dateRange: dateRange || null
      }
    }
  },
  
  /**
   * Calculate statistics grouped by expiry status
   * @private
   */
  _calculateByStatus(batches, locale = 'ru') {
    const statusCounts = {
      [ExpiryStatus.EXPIRED]: { count: 0, quantity: 0 },
      [ExpiryStatus.TODAY]: { count: 0, quantity: 0 },
      [ExpiryStatus.CRITICAL]: { count: 0, quantity: 0 },
      [ExpiryStatus.WARNING]: { count: 0, quantity: 0 },
      [ExpiryStatus.GOOD]: { count: 0, quantity: 0 }
    }
    
    for (const batch of batches) {
      const status = batch.expiryStatus || ExpiryStatus.GOOD
      if (statusCounts[status]) {
        statusCounts[status].count++
        statusCounts[status].quantity += batch.quantity || 0
      }
    }
    
    const total = batches.length || 1 // Avoid division by zero
    
    // Order: EXPIRED → TODAY → CRITICAL → WARNING → GOOD
    const statusOrder = [
      ExpiryStatus.EXPIRED,
      ExpiryStatus.TODAY,
      ExpiryStatus.CRITICAL,
      ExpiryStatus.WARNING,
      ExpiryStatus.GOOD
    ]
    
    return statusOrder.map(status => ({
      status,
      label: getStatusLabel(status, locale),
      count: statusCounts[status].count,
      quantity: statusCounts[status].quantity,
      color: StatusColor[status] || '#6B7280',
      cssClass: StatusCssClass[status] || 'text-gray-500',
      percentage: Math.round((statusCounts[status].count / total) * 100)
    }))
  },
  
  /**
   * Calculate statistics grouped by category
   * No "Other" category - uses direct category_id from batch/product
   * @private
   */
  _calculateByCategory(batches, products, categoryMap, locale = 'ru') {
    // Group products by category
    const productsByCategory = new Map()
    for (const product of products) {
      const catId = product.category_id
      if (!catId) continue
      
      if (!productsByCategory.has(catId)) {
        productsByCategory.set(catId, [])
      }
      productsByCategory.get(catId).push(product)
    }
    
    // Group batches by category (via product's category)
    const batchesByCategory = new Map()
    for (const batch of batches) {
      // category_id is now included directly in batch query
      const catId = batch.category_id || null
      if (!catId) continue
      
      if (!batchesByCategory.has(catId)) {
        batchesByCategory.set(catId, [])
      }
      batchesByCategory.get(catId).push(batch)
    }
    
    // Build result array
    const result = []
    
    for (const [categoryId, category] of categoryMap) {
      const catBatches = batchesByCategory.get(categoryId) || []
      const catProducts = productsByCategory.get(categoryId) || []
      
      // Skip empty categories
      if (catBatches.length === 0 && catProducts.length === 0) continue
      
      // Calculate status breakdown for this category
      const statusBreakdown = {
        expired: 0,
        critical: 0,
        warning: 0,
        good: 0
      }
      
      let totalQuantity = 0
      for (const batch of catBatches) {
        totalQuantity += batch.quantity || 0
        const status = batch.expiryStatus
        
        if (status === ExpiryStatus.EXPIRED || status === ExpiryStatus.TODAY) {
          statusBreakdown.expired++
        } else if (status === ExpiryStatus.CRITICAL) {
          statusBreakdown.critical++
        } else if (status === ExpiryStatus.WARNING) {
          statusBreakdown.warning++
        } else {
          statusBreakdown.good++
        }
      }
      
      // Get localized name
      const nameKey = locale === 'en' ? 'name_en' : (locale === 'kk' ? 'name_kk' : 'name')
      const categoryName = category[nameKey] || category.name || 'Unknown'
      
      result.push({
        categoryId,
        categoryName,
        color: category.color || '#6B6560',
        icon: category.icon || null,
        batchCount: catBatches.length,
        productCount: catProducts.length,
        totalQuantity,
        byStatus: statusBreakdown
      })
    }
    
    // Sort by batch count descending
    result.sort((a, b) => b.batchCount - a.batchCount)
    
    return result
  },
  
  /**
   * Calculate trend data for charts
   * Groups batches by expiry date for the next N days
   * @private
   */
  _calculateTrends(batches, days = 30) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const trends = []
    
    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + i)
      const dateKey = targetDate.toISOString().split('T')[0]
      
      const dayBatches = batches.filter(b => {
        if (!b.expiry_date) return false
        const expiryDate = b.expiry_date.split('T')[0]
        return expiryDate === dateKey
      })
      
      const point = {
        date: dateKey,
        expired: 0,
        critical: 0,
        warning: 0,
        good: 0,
        total: dayBatches.length
      }
      
      for (const batch of dayBatches) {
        const status = batch.expiryStatus
        if (status === ExpiryStatus.EXPIRED || status === ExpiryStatus.TODAY) {
          point.expired++
        } else if (status === ExpiryStatus.CRITICAL) {
          point.critical++
        } else if (status === ExpiryStatus.WARNING) {
          point.warning++
        } else {
          point.good++
        }
      }
      
      trends.push(point)
    }
    
    return trends
  },
  
  /**
   * Calculate health score (0-100)
   * @private
   */
  _calculateHealthScore(byStatus) {
    const goodCount = byStatus.find(s => s.status === ExpiryStatus.GOOD)?.count || 0
    const total = byStatus.reduce((sum, s) => sum + s.count, 0)
    
    if (total === 0) return 100
    return Math.round((goodCount / total) * 100)
  },
  
  /**
   * Get quick summary stats (for dashboard widgets)
   */
  async getQuickStats(context) {
    const stats = await this.getStatistics(context, { trendDays: 7 })
    
    const expiredCount = stats.byStatus.find(s => s.status === ExpiryStatus.EXPIRED)?.count || 0
    const todayCount = stats.byStatus.find(s => s.status === ExpiryStatus.TODAY)?.count || 0
    const criticalCount = stats.byStatus.find(s => s.status === ExpiryStatus.CRITICAL)?.count || 0
    const warningCount = stats.byStatus.find(s => s.status === ExpiryStatus.WARNING)?.count || 0
    
    return {
      totalBatches: stats.total.batches,
      totalProducts: stats.total.products,
      healthScore: stats.total.healthScore,
      urgentItems: expiredCount + todayCount + criticalCount,
      expiringThisWeek: warningCount + criticalCount,
      expired: expiredCount
    }
  }
}

export default StatisticsService
