/**
 * FreshTrack Reports API - PostgreSQL Async Version
 * Phase 6: Uses UnifiedFilterService for consistent filtering
 * Uses ExpiryService as Single Source of Truth for expiry calculations
 * Phase 3: StatisticsService for centralized statistics aggregation
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllProducts,
  getAllBatches,
  getAllWriteOffs,
  getAuditLogs,
  logAudit
} from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'
import {
  enrichBatchesWithExpiryData,
  calculateDaysUntilExpiry,
  ExpiryStatus
} from '../services/ExpiryService.js'
import { UnifiedFilterService } from '../services/FilterService.js'
import { StatisticsService } from '../services/StatisticsService.js'

const router = express.Router()

/**
 * GET /api/reports/statistics - Centralized statistics (Phase 3)
 * Returns: { byStatus, byCategory, trends, total, filters }
 * No frontend calculations - backend is Single Source of Truth
 */
router.get('/statistics', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const { from, to, locale = 'ru', trend_days } = req.query
    
    // Build context from middleware
    const context = {
      hotelId: req.hotelId,
      departmentId: req.departmentId,
      canAccessAllDepartments: req.canAccessAllDepartments
    }
    
    // Build options
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
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_statistics', entity_type: 'statistics', entity_id: null,
      details: { filters: statistics.filters }, ip_address: req.ip
    })
    
    res.json({ success: true, ...statistics })
  } catch (error) {
    logError('Get statistics error', error)
    res.status(500).json({ success: false, error: 'Failed to get statistics' })
  }
})

/**
 * GET /api/reports/statistics/quick - Quick summary for dashboard widgets
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

// GET /api/reports/inventory - Phase 6: Unified filtering
router.get('/inventory', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    // Phase 6: Parse filters using UnifiedFilterService
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    
    // Use department from isolation middleware unless user can access all departments
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
    
    // Enrich batches with expiry data using ExpiryService (Single Source of Truth)
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId,
      locale: filters.locale
    })
    
    // Phase 6: Apply post-query filters (virtual status, search)
    batches = UnifiedFilterService.applyPostQueryFilters(batches, filters, {
      searchFields: ['product_name', 'batch_code', 'supplier']
    })
    
    // Calculate totals using enriched data
    const summary = {
      total_products: products.length,
      total_batches: batches.length,
      total_quantity: batches.reduce((sum, b) => sum + (b.quantity || 0), 0),
      expiring_soon: batches.filter(b => 
        b.expiryStatus === ExpiryStatus.WARNING || b.expiryStatus === ExpiryStatus.CRITICAL
      ).length,
      expired: batches.filter(b => b.expiryStatus === ExpiryStatus.EXPIRED).length,
      low_stock: products.filter(p => p.current_quantity !== undefined && 
        p.min_quantity !== undefined && p.current_quantity < p.min_quantity).length
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'inventory', filters: dbFilters }, ip_address: req.ip
    })
    
    // Phase 6: Create paginated response
    const total = batches.length
    const paginatedBatches = batches.slice(filters.offset, filters.offset + filters.limit)
    
    res.json({ 
      success: true, 
      summary, 
      products,
      ...UnifiedFilterService.createPaginatedResponse(paginatedBatches, total, filters),
      batches: paginatedBatches // Backward compatibility
    })
  } catch (error) {
    logError('Get inventory report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate inventory report' })
  }
})

// GET /api/reports/expiry - Phase 6: Unified filtering
router.get('/expiry', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    // Phase 6: Parse filters
    const filters = UnifiedFilterService.parseCommonFilters(req.query)
    const { days = 30 } = req.query
    
    // Use department from isolation middleware unless user can access all departments
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
    
    // Enrich batches with expiry data using ExpiryService (Single Source of Truth)
    const batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId
    })
    
    // Use enriched daysLeft instead of manual calculation
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

// GET /api/reports/write-offs
router.get('/write-offs', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.WRITE_OFFS, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id, start_date, end_date, reason } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = {
      department_id: deptId,
      start_date, end_date, reason
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
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'view_report', entity_type: 'report', entity_id: null,
      details: { report_type: 'write_offs', filters }, ip_address: req.ip
    })
    
    res.json({ success: true, summary, write_offs: writeOffs })
  } catch (error) {
    logError('Get write-offs report error', error)
    res.status(500).json({ success: false, error: 'Failed to generate write-offs report' })
  }
})

// GET /api/reports/activity
router.get('/activity', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.AUDIT, PermissionAction.READ), async (req, res) => {
  try {
    const { start_date, end_date, user_id, action, entity_type, limit = 100 } = req.query
    const filters = { start_date, end_date, user_id, action, entity_type, limit: parseInt(limit) }
    
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

/**
 * GET /api/reports/calendar - Calendar view data (Phase 3)
 * Single Source of Truth: ExpiryService provides colors/statuses
 * Optimized for calendar rendering with date-grouped batches
 */
router.get('/calendar', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.REPORTS, PermissionAction.READ), async (req, res) => {
  try {
    const { start_date, end_date, department_id, category_id } = req.query
    
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { 
      department_id: deptId,
      category_id: category_id || null
    }
    
    const rawBatches = await getAllBatches(req.hotelId, filters)
    
    // Enrich batches with expiry data using ExpiryService (Single Source of Truth)
    let batches = await enrichBatchesWithExpiryData(rawBatches, {
      hotelId: req.hotelId,
      departmentId: deptId,
      locale: req.query.locale || 'ru'
    })
    
    // Filter by date range if provided
    if (start_date || end_date) {
      const startMs = start_date ? new Date(start_date).getTime() : 0
      const endMs = end_date ? new Date(end_date).getTime() : Infinity
      
      batches = batches.filter(batch => {
        const expiryMs = new Date(batch.expiry_date).getTime()
        return expiryMs >= startMs && expiryMs <= endMs
      })
    }
    
    // Group batches by expiry date for calendar rendering
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
      
      // Add batch with calendar-ready metadata
      calendarData[dateKey].batches.push({
        id: batch.id,
        productName: batch.product_name,
        productId: batch.product_id,
        batchCode: batch.batch_code,
        quantity: batch.quantity,
        unit: batch.unit,
        expiryDate: batch.expiry_date,
        // Calendar metadata from ExpiryService (Single Source of Truth)
        calendarMeta: {
          color: batch.statusColor,
          status: batch.expiryStatus,
          cssClass: batch.statusCssClass,
          statusText: batch.statusText,
          daysRemaining: batch.daysLeft,
          isUrgent: batch.isUrgent
        }
      })
      
      // Update summary counts
      calendarData[dateKey].summary.total++
      if (batch.expiryStatus === ExpiryStatus.EXPIRED) calendarData[dateKey].summary.expired++
      else if (batch.expiryStatus === ExpiryStatus.CRITICAL || batch.expiryStatus === 'today') calendarData[dateKey].summary.critical++
      else if (batch.expiryStatus === ExpiryStatus.WARNING) calendarData[dateKey].summary.warning++
      else calendarData[dateKey].summary.good++
    }
    
    // Convert to sorted array
    const calendarEntries = Object.values(calendarData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Calculate overall summary
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

// GET /api/reports/dashboard
router.get('/dashboard', authMiddleware, hotelIsolation, departmentIsolation, async (req, res) => {
  try {
    const { department_id } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const filters = { department_id: deptId }
    
    const products = await getAllProducts(req.hotelId, filters)
    const rawBatches = await getAllBatches(req.hotelId, filters)
    
    // Enrich batches with expiry data using ExpiryService (Single Source of Truth)
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
        p.current_quantity !== undefined && p.min_quantity !== undefined && 
        p.current_quantity < p.min_quantity
      ).length
    }
    
    res.json({ success: true, dashboard })
  } catch (error) {
    logError('Get dashboard error', error)
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' })
  }
})

export default router



