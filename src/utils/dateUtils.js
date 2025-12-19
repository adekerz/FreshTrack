import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns'

/**
 * Calculate days until expiry
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
 * Пороговые значения синхронизированы с сервером:
 * - expired: < 0 дней (просрочено)
 * - today: 0 дней (сегодня)
 * - critical: 1-3 дня (критично)
 * - warning: 4-7 дней (внимание)
 * - good: > 7 дней (в норме)
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
