/**
 * Reports Controller
 * 
 * HTTP обработчики для reports endpoints.
 * Phase 6: Uses UnifiedFilterService for consistent filtering
 * Phase 3: StatisticsService for centralized statistics
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import {
  getAllProducts,
  getAllBatches,
  getAllWriteOffs,
  getAuditLogs,
  logAudit
} from '../../db/database.js'
import { query } from '../../db/postgres.js'
import {
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../../middleware/auth.js'
import {
  enrichBatchesWithExpiryData,
  ExpiryStatus
} from '../../services/ExpiryService.js'
import { UnifiedFilterService } from '../../services/FilterService.js'
import { StatisticsService } from '../../services/StatisticsService.js'
import {
  HEALTH_SUMMARY_QUERY,
  EXPIRY_FORECAST_QUERY,
  COLLECTION_ACTIVITY_QUERY,
  PRODUCT_TURNOVER_QUERY,
  DAILY_ACTIVE_USERS_QUERY,
  DEPARTMENT_SCORECARD_QUERY,
  COLLECTION_REASONS_QUERY,
  BATCH_AGE_DISTRIBUTION_QUERY,
  WEEKLY_SUMMARY_QUERY
} from './report-queries.js'

const router = Router()

// ========================================
// Statistics Endpoints
// ========================================

/**
 * GET /api/reports/statistics
 * Centralized statistics (Phase 3)
 */
router.get('/statistics', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const { from, to, locale = 'ru', trend_days } = req.query
    
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      canAccessAllDepartments: req.canAccessAllDepartments
    }
    
    const options = { locale }
    if (from || to) {
      options.dateRange = {
        from: from ? new Date(from) : null,
        to: to ? new Date(to) : null
      }
    }
    if (trend_days) {
      options.trendDays = parseInt(trend_days, 10)
    }
    
    const statistics = await StatisticsService.getStatistics(context, options)
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'view_statistics',
      entity_type: 'statistics',
      entity_id: null,
      details: { filters: statistics.filters },
      ip_address: req.ip
    })
    
    res.json({ success: true, ...statistics })
  } catch (error) {
    logError('Get statistics error', error)
    res.status(500).json({ success: false, error: 'Failed to get statistics' })
  }
})

/**
 * GET /api/reports/statistics/quick
 * Quick summary for dashboard widgets
 */
router.get('/statistics/quick', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      canAccessAllDepartments: req.canAccessAllDepartments
    }
    
    const quickStats = await StatisticsService.getQuickStats(context)
    
    res.json({ success: true, ...quickStats })
  } catch (error) {
    logError('Get quick stats error', error)
    res.status(500).json({ success: false, error: 'Failed to get quick stats' })
  }
})

// ========================================
// Inventory Report
// ========================================

/**
 * GET /api/reports/inventory
 * Phase 6: Unified filtering
 */
router.get('/inventory', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    
    const deptId = req.canAccessAllDepartments 
      ? (filters.departmentIds?.[0] || null) 
      : req.departmentId
    const categoryId = filters.categoryIds?.[0] || null
    
    const dbFilters = {
      department_id: deptId,
      category_id: categoryId
    }
    
    const products = await getAllProducts(req.hotelId, dbFilters)
    const rawBatches = await getAllBatches(req.hotelId, dbFilters)
    
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId,
      locale: filters.locale
    })
    
    batches = UnifiedFilterService.applyPostQueryFilters(batches, filters, {
      searchFields: ['product_name', 'batch_code', 'supplier']
    })
    
    const summary = {
      total_products: products.length,
      total_batches: batches.length,
      total_quantity: batches.reduce((sum, b) => sum + (b.quantity || 0), 0),
      expiring_soon: batches.filter(b => 
        b.expiryStatus === ExpiryStatus.WARNING || b.expiryStatus === ExpiryStatus.CRITICAL
      ).length,
      expired: batches.filter(b => b.expiryStatus === ExpiryStatus.EXPIRED).length,
      low_stock: products.filter(p => 
        p.current_quantity !== undefined && 
        p.min_quantity !== undefined && 
        p.current_quantity < p.min_quantity
      ).length
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'view_report',
      entity_type: 'report',
      entity_id: null,
      details: { report_type: 'inventory', filters: dbFilters },
      ip_address: req.ip
    })
    
    const total = batches.length
    const paginatedBatches = batches.slice(filters.offset, filters.offset + filters.limit)
    
    res.json({ 
      success: true, 
      summary, 
      products,
      ...UnifiedFilterService.createPaginatedResponse(paginatedBatches, total, filters),
      batches: paginatedBatches
    })
  } catch (error) {
    logError('Get inventory report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate inventory report' })
  }
})

// ========================================
// Expiry Report
// ========================================

/**
 * GET /api/reports/expiry
 * Phase 6: Unified filtering
 */
router.get('/expiry', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    const { days = 30 } = req.query
    
    const deptId = req.canAccessAllDepartments 
      ? (filters.departmentIds?.[0] || null) 
      : req.departmentId
    const dbFilters = {
      department_id: deptId,
      status: 'active'
    }
    
    const rawBatches = await getAllBatches(req.hotelId, dbFilters)
    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + parseInt(days))
    
    const batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId
    })
    
    const expiringBatches = batches.filter(b => {
      if (!b.expiry_date) return false
      const expDate = new Date(b.expiry_date)
      return expDate >= now && expDate <= targetDate
    }).map(b => ({
      ...b,
      days_until_expiry: b.daysLeft
    })).sort((a, b) => a.days_until_expiry - b.days_until_expiry)
    
    const expiredBatches = batches.filter(b => {
      return b.expiryStatus === ExpiryStatus.EXPIRED
    }).map(b => ({
      ...b,
      days_expired: Math.abs(b.daysLeft)
    }))
    
    res.json({
      success: true,
      expiring: expiringBatches,
      expired: expiredBatches,
      summary: {
        expiring_count: expiringBatches.length,
        expired_count: expiredBatches.length
      }
    })
  } catch (error) {
    logError('Get expiry report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate expiry report' })
  }
})

// ========================================
// Write-offs Report
// ========================================

/**
 * GET /api/reports/write-offs
 */
router.get('/write-offs', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, start_date, end_date, reason } = req.query
    
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = {
      department_id: deptId,
      start_date,
      end_date,
      reason
    }
    
    const writeOffs = await getAllWriteOffs(req.hotelId, filters)
    
    const summary = {
      total_write_offs: writeOffs.length,
      total_quantity: writeOffs.reduce((sum, w) => sum + (w.quantity || 0), 0),
      by_reason: writeOffs.reduce((acc, w) => {
        acc[w.reason || 'unknown'] = (acc[w.reason || 'unknown'] || 0) + 1
        return acc
      }, {})
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'view_report',
      entity_type: 'report',
      entity_id: null,
      details: { report_type: 'write_offs', filters },
      ip_address: req.ip
    })
    
    res.json({ success: true, summary, write_offs: writeOffs })
  } catch (error) {
    logError('Get write-offs report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate write-offs report' })
  }
})

// ========================================
// Activity Report
// ========================================

/**
 * GET /api/reports/activity
 */
router.get('/activity', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.AUDIT, PermissionAction.READ), async (req, res) => {
  try {
    const { start_date, end_date, user_id, action, entity_type, limit = 100 } = req.query
    const filters = {
      start_date,
      end_date,
      user_id,
      action,
      entity_type,
      limit: parseInt(limit)
    }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    
    const summary = {
      total_actions: logs.length,
      by_action: logs.reduce((acc, l) => {
        acc[l.action] = (acc[l.action] || 0) + 1
        return acc
      }, {}),
      by_user: logs.reduce((acc, l) => {
        acc[l.user_name || 'system'] = (acc[l.user_name || 'system'] || 0) + 1
        return acc
      }, {})
    }
    
    res.json({ success: true, summary, logs })
  } catch (error) {
    logError('Get activity report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate activity report' })
  }
})

// ========================================
// Calendar Report
// ========================================

/**
 * GET /api/reports/calendar
 * Calendar view data (Phase 3)
 */
router.get('/calendar', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const { start_date, end_date, department_id, category_id, locale = 'ru' } = req.query
    
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { 
      department_id: deptId,
      category_id: category_id || null
    }
    
    const rawBatches = await getAllBatches(req.hotelId, filters)
    
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId,
      locale
    })
    
    if (start_date || end_date) {
      const startMs = start_date ? new Date(start_date).getTime() : 0
      const endMs = end_date ? new Date(end_date).getTime() : Infinity
      
      batches = batches.filter(batch => {
        const expiryMs = new Date(batch.expiry_date).getTime()
        return expiryMs >= startMs && expiryMs <= endMs
      })
    }
    
    const calendarData = {}
    for (const batch of batches) {
      const dateKey = batch.expiry_date?.split('T')[0] || batch.expiry_date
      if (!dateKey) continue
      
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = {
          date: dateKey,
          batches: [],
          summary: { total: 0, expired: 0, critical: 0, warning: 0, good: 0 }
        }
      }
      
      calendarData[dateKey].batches.push({
        id: batch.id,
        productName: batch.product_name,
        productId: batch.product_id,
        batchCode: batch.batch_code,
        quantity: batch.quantity,
        unit: batch.unit,
        expiryDate: batch.expiry_date,
        calendarMeta: {
          color: batch.statusColor,
          status: batch.expiryStatus,
          cssClass: batch.statusCssClass,
          statusText: batch.statusText,
          daysRemaining: batch.daysLeft,
          isUrgent: batch.isUrgent
        }
      })
      
      calendarData[dateKey].summary.total++
      if (batch.expiryStatus === ExpiryStatus.EXPIRED) calendarData[dateKey].summary.expired++
      else if (batch.expiryStatus === ExpiryStatus.CRITICAL || batch.expiryStatus === 'today') calendarData[dateKey].summary.critical++
      else if (batch.expiryStatus === ExpiryStatus.WARNING) calendarData[dateKey].summary.warning++
      else calendarData[dateKey].summary.good++
    }
    
    const calendarEntries = Object.values(calendarData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    const overallSummary = {
      totalBatches: batches.length,
      expired: batches.filter(b => b.expiryStatus === ExpiryStatus.EXPIRED).length,
      critical: batches.filter(b => b.expiryStatus === ExpiryStatus.CRITICAL || b.expiryStatus === 'today').length,
      warning: batches.filter(b => b.expiryStatus === ExpiryStatus.WARNING).length,
      good: batches.filter(b => b.expiryStatus === ExpiryStatus.GOOD || b.expiryStatus === 'good').length,
      uniqueDates: calendarEntries.length
    }
    
    res.json({
      success: true,
      calendar: calendarEntries,
      summary: overallSummary,
      filters: {
        hotelId: req.hotelId,
        departmentId: deptId,
        startDate: start_date || null,
        endDate: end_date || null
      }
    })
  } catch (error) {
    logError('Get calendar data error', error)
    res.status(500).json({ success: false, error: 'Failed to get calendar data' })
  }
})

// ========================================
// Dashboard
// ========================================

/**
 * GET /api/reports/dashboard
 */
router.get('/dashboard', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
  try {
    const { department_id } = req.query
    
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { department_id: deptId }
    
    const products = await getAllProducts(req.hotelId, filters)
    const rawBatches = await getAllBatches(req.hotelId, filters)
    
    const batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId
    })
    
    const dashboard = {
      total_products: products.length,
      active_products: products.filter(p => p.is_active).length,
      total_batches: batches.length,
      active_batches: batches.filter(b => b.status === 'active').length,
      expiring_this_week: batches.filter(b => 
        b.expiryStatus === ExpiryStatus.WARNING || 
        b.expiryStatus === ExpiryStatus.CRITICAL ||
        b.expiryStatus === ExpiryStatus.TODAY
      ).length,
      expired: batches.filter(b => b.expiryStatus === ExpiryStatus.EXPIRED).length,
      low_stock_products: products.filter(p => 
        p.current_quantity !== undefined && 
        p.min_quantity !== undefined && 
        p.current_quantity < p.min_quantity
      ).length
    }
    
    res.json({ success: true, dashboard })
  } catch (error) {
    logError('Get dashboard error', error)
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' })
  }
})

// ========================================
// Analytics Report Endpoints (Phase 2)
// ========================================

const AUTH_CHAIN = [authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ)]

/**
 * GET /api/reports/health-summary
 * Daily inventory health summary by department
 */
router.get('/health-summary', ...AUTH_CHAIN, async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments
      ? (req.query.department_id || null)
      : req.departmentId

    const result = await query(HEALTH_SUMMARY_QUERY, [req.hotelId, deptId || null])

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'health_summary' }, ip_address: req.ip
    })

    res.json({ success: true, data: result.rows, report_type: 'health-summary' })
  } catch (error) {
    logError('Get health-summary error', error)
    res.status(500).json({ success: false, error: 'Failed to generate health summary' })
  }
})

/**
 * GET /api/reports/expiry-forecast?days=7&department_id=...
 * Products expiring within N days
 */
router.get('/expiry-forecast', ...AUTH_CHAIN, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 365)
    const deptId = req.canAccessAllDepartments
      ? (req.query.department_id || null)
      : req.departmentId

    const result = await query(EXPIRY_FORECAST_QUERY, [req.hotelId, days, deptId || null])

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'expiry_forecast', days }, ip_address: req.ip
    })

    res.json({ success: true, data: result.rows, days, report_type: 'expiry-forecast' })
  } catch (error) {
    logError('Get expiry-forecast error', error)
    res.status(500).json({ success: false, error: 'Failed to generate expiry forecast' })
  }
})

/**
 * GET /api/reports/collection-activity?from=&to=&department_id=
 * Detailed collection activity log
 */
router.get('/collection-activity', ...AUTH_CHAIN, async (req, res) => {
  try {
    const { from, to, department_id } = req.query
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = to ? new Date(to) : new Date()
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId

    const result = await query(COLLECTION_ACTIVITY_QUERY, [req.hotelId, dateFrom, dateTo, deptId || null])

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'collection_activity', from: dateFrom, to: dateTo }, ip_address: req.ip
    })

    res.json({ success: true, data: result.rows, report_type: 'collection-activity' })
  } catch (error) {
    logError('Get collection-activity error', error)
    res.status(500).json({ success: false, error: 'Failed to generate collection activity report' })
  }
})

/**
 * GET /api/reports/product-turnover?from=&to=
 * Product turnover analysis (consumption vs waste)
 */
router.get('/product-turnover', ...AUTH_CHAIN, async (req, res) => {
  try {
    const { from, to } = req.query
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = to ? new Date(to) : new Date()

    const result = await query(PRODUCT_TURNOVER_QUERY, [req.hotelId, dateFrom, dateTo])

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'product_turnover' }, ip_address: req.ip
    })

    res.json({ success: true, data: result.rows, report_type: 'product-turnover' })
  } catch (error) {
    logError('Get product-turnover error', error)
    res.status(500).json({ success: false, error: 'Failed to generate product turnover report' })
  }
})

/**
 * GET /api/reports/daily-active-users?from=
 * Daily active users from audit logs
 */
router.get('/daily-active-users', ...AUTH_CHAIN, async (req, res) => {
  try {
    const { from } = req.query
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = await query(DAILY_ACTIVE_USERS_QUERY, [req.hotelId, dateFrom])

    res.json({ success: true, data: result.rows, report_type: 'daily-active-users' })
  } catch (error) {
    logError('Get daily-active-users error', error)
    res.status(500).json({ success: false, error: 'Failed to generate daily active users report' })
  }
})

/**
 * GET /api/reports/department-scorecard
 * Department performance scorecard
 */
router.get('/department-scorecard', ...AUTH_CHAIN, async (req, res) => {
  try {
    const result = await query(DEPARTMENT_SCORECARD_QUERY, [req.hotelId])

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'department_scorecard' }, ip_address: req.ip
    })

    res.json({ success: true, data: result.rows, report_type: 'department-scorecard' })
  } catch (error) {
    logError('Get department-scorecard error', error)
    res.status(500).json({ success: false, error: 'Failed to generate department scorecard' })
  }
})

/**
 * GET /api/reports/collection-reasons?from=&to=&department_id=
 * Collection reason distribution
 */
router.get('/collection-reasons', ...AUTH_CHAIN, async (req, res) => {
  try {
    const { from, to, department_id } = req.query
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const dateTo = to ? new Date(to) : new Date()
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId

    const result = await query(COLLECTION_REASONS_QUERY, [req.hotelId, dateFrom, dateTo, deptId || null])

    res.json({ success: true, data: result.rows, report_type: 'collection-reasons' })
  } catch (error) {
    logError('Get collection-reasons error', error)
    res.status(500).json({ success: false, error: 'Failed to generate collection reasons report' })
  }
})

/**
 * GET /api/reports/weekly-summary
 * Weekly executive summary with health delta
 */
router.get('/weekly-summary', ...AUTH_CHAIN, async (req, res) => {
  try {
    const result = await query(WEEKLY_SUMMARY_QUERY, [req.hotelId])
    const summary = result.rows[0] || {}

    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'weekly_summary' }, ip_address: req.ip
    })

    res.json({ success: true, data: summary, report_type: 'weekly-summary' })
  } catch (error) {
    logError('Get weekly-summary error', error)
    res.status(500).json({ success: false, error: 'Failed to generate weekly summary' })
  }
})

/**
 * GET /api/reports/batch-age-distribution?department_id=
 * Batch age distribution buckets
 */
router.get('/batch-age-distribution', ...AUTH_CHAIN, async (req, res) => {
  try {
    const deptId = req.canAccessAllDepartments
      ? (req.query.department_id || null)
      : req.departmentId

    const result = await query(BATCH_AGE_DISTRIBUTION_QUERY, [req.hotelId, deptId || null])

    res.json({ success: true, data: result.rows, report_type: 'batch-age-distribution' })
  } catch (error) {
    logError('Get batch-age-distribution error', error)
    res.status(500).json({ success: false, error: 'Failed to generate batch age distribution' })
  }
})

export default router
