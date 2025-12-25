import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'

/**
 * ═══════════════════════════════════════════════════════════════
 * BACKEND AS SINGLE SOURCE OF TRUTH
 * ═══════════════════════════════════════════════════════════════
 * 
 * IMPORTANT: These utility functions are kept for backwards compatibility
 * and as fallbacks only. The backend now returns enriched data with:
 * - daysLeft
 * - expiryStatus (status enum)
 * - statusColor
 * - statusText
 * - isExpired
 * - isUrgent
 * 
 * Frontend should prefer using backend-provided fields when available:
 * 
 * ✅ PREFERRED: Use batch.expiryStatus, batch.statusColor, batch.daysLeft
 * ⚠️ FALLBACK: Use getExpiryStatus(getDaysUntilExpiry(batch.expiryDate))
 * 
 * This ensures consistency across all clients and allows configuration
 * of thresholds through SettingsService without frontend changes.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Calculate days until expiry
 * @deprecated Prefer using batch.daysLeft from backend response
 * @param {string} expiryDate - ISO date string
 * @returns {number} - Days until expiry (negative if expired)
 */
export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return -999
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate)
    if (isNaN(expiry.getTime())) return -999
    expiry.setHours(0, 0, 0, 0)
    return differenceInDays(expiry, today)
  } catch {
    return -999
  }
}

/**
 * Get expiry status based on days remaining
 * 
 * @deprecated Prefer using batch.expiryStatus from backend response
 * The backend uses configurable thresholds from SettingsService.
 * These hardcoded values are fallback defaults only.
 * 
 * Пороговые значения (defaults, configurable on backend):
 * - expired: < 0 дней (просрочено)
 * - today: 0 дней (сегодня)
 * - critical: 1-3 дня (критично)
 * - warning: 4-7 дней (внимание)
 * - good: > 7 дней (в норме)
 * 
 * @param {number} days - Days until expiry
 * @returns {object} - Status object with status, label, and color
 */
export function getExpiryStatus(days) {
  if (days < 0) {
    return { status: 'expired', label: 'Expired', color: 'danger' }
  }
  if (days === 0) {
    return { status: 'today', label: 'Expires Today', color: 'danger' }
  }
  if (days <= 3) {
    return { status: 'critical', label: 'Critical', color: 'danger' }
  }
  if (days <= 7) {
    return { status: 'warning', label: 'Expiring Soon', color: 'warning' }
  }
  return { status: 'good', label: 'Good', color: 'success' }
}

/**
 * Get status from batch object, preferring backend data
 * @param {object} batch - Batch object from API
 * @returns {object} - Status object { status, color, daysLeft, statusText }
 */
export function getBatchStatus(batch) {
  // Prefer backend enriched data
  if (batch.expiryStatus) {
    return {
      status: batch.expiryStatus,
      color: batch.statusColor || 'charcoal',
      daysLeft: batch.daysLeft,
      statusText: batch.statusText,
      isExpired: batch.isExpired,
      isUrgent: batch.isUrgent
    }
  }
  
  // Fallback to local calculation
  const daysLeft = batch.daysLeft ?? getDaysUntilExpiry(batch.expiryDate || batch.expiry_date)
  const statusInfo = getExpiryStatus(daysLeft)
  
  return {
    status: statusInfo.status,
    color: statusInfo.color,
    daysLeft,
    statusText: statusInfo.label,
    isExpired: statusInfo.status === 'expired',
    isUrgent: ['expired', 'today', 'critical'].includes(statusInfo.status)
  }
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = parseISO(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return format(date, 'MMM d, yyyy')
  } catch {
    return 'Invalid date'
  }
}

/**
 * Format date relative to now
 * @param {string} dateString - ISO date string
 * @returns {string} - Relative time string
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = parseISO(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'Invalid date'
  }
}

/**
 * Get today's date in ISO format
 * @returns {string} - Today's date as YYYY-MM-DD
 */
export function getTodayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Check if date is in the past
 * @param {string} dateString - ISO date string
 * @returns {boolean}
 */
export function isExpired(dateString) {
  return getDaysUntilExpiry(dateString) < 0
}
