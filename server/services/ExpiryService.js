/**
 * FreshTrack Expiry Service
 * ═══════════════════════════════════════════════════════════════
 * Centralized service for expiry status calculations
 * Single Source of Truth for all expiry-related business logic
 * 
 * Replaces duplicated logic from:
 * - src/utils/dateUtils.js (frontend)
 * - server/services/TelegramService.js
 * - server/routes/backup/batches.js
 */

import { getSettings } from './SettingsService.js'
import { query } from '../db/database.js'

/**
 * Expiry Status Enum
 */
export const ExpiryStatus = {
  EXPIRED: 'expired',
  TODAY: 'today',
  CRITICAL: 'critical',
  WARNING: 'warning',
  GOOD: 'good'
}

/**
 * Status Colors for UI
 */
export const StatusColor = {
  [ExpiryStatus.EXPIRED]: 'danger',
  [ExpiryStatus.TODAY]: 'danger',
  [ExpiryStatus.CRITICAL]: 'danger',
  [ExpiryStatus.WARNING]: 'warning',
  [ExpiryStatus.GOOD]: 'success'
}

/**
 * Status CSS Classes
 */
export const StatusCssClass = {
  [ExpiryStatus.EXPIRED]: 'bg-danger text-white',
  [ExpiryStatus.TODAY]: 'bg-orange-600 text-white',
  [ExpiryStatus.CRITICAL]: 'bg-orange-600 text-white',
  [ExpiryStatus.WARNING]: 'bg-yellow-400 text-charcoal',
  [ExpiryStatus.GOOD]: 'bg-success text-white'
}

/**
 * Default thresholds (days until expiry)
 */
const DEFAULT_THRESHOLDS = {
  critical: 3,   // <= 3 days = critical
  warning: 7     // <= 7 days = warning
}

// Cache for notification rules thresholds
const thresholdsCache = new Map()
const THRESHOLDS_CACHE_TTL = 60000 // 1 minute

/**
 * Get expiry thresholds from notification_rules for a hotel
 * @param {string} hotelId - Hotel ID
 * @returns {Object|null} - { critical, warning } or null if no rules
 */
async function getThresholdsFromRules(hotelId) {
  if (!hotelId) return null

  const cacheKey = `thresholds:${hotelId}`
  const cached = thresholdsCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < THRESHOLDS_CACHE_TTL) {
    return cached.thresholds
  }

  try {
    // Get the first enabled expiry rule for this hotel
    const result = await query(`
      SELECT warning_days, critical_days 
      FROM notification_rules 
      WHERE (hotel_id = $1 OR hotel_id IS NULL)
        AND type = 'expiry'
        AND enabled = true
      ORDER BY hotel_id NULLS LAST
      LIMIT 1
    `, [hotelId])

    if (result.rows.length > 0) {
      const thresholds = {
        warning: result.rows[0].warning_days,
        critical: result.rows[0].critical_days
      }
      thresholdsCache.set(cacheKey, { thresholds, timestamp: Date.now() })
      return thresholds
    }

    thresholdsCache.set(cacheKey, { thresholds: null, timestamp: Date.now() })
    return null
  } catch {
    return null
  }
}

/**
 * Calculate days until expiry
 * @param {string|Date} expiryDate - Expiry date
 * @returns {number} - Days until expiry (negative if expired)
 */
export function calculateDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return -999

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const expiry = new Date(expiryDate)
    if (isNaN(expiry.getTime())) return -999

    expiry.setHours(0, 0, 0, 0)

    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  } catch {
    return -999
  }
}

/**
 * Get expiry status based on days remaining
 * @param {number} daysLeft - Days until expiry
 * @param {Object} thresholds - Custom thresholds { critical, warning }
 * @returns {string} - Status string
 */
export function getExpiryStatus(daysLeft, thresholds = DEFAULT_THRESHOLDS) {
  if (daysLeft < 0) return ExpiryStatus.EXPIRED
  if (daysLeft === 0) return ExpiryStatus.TODAY
  if (daysLeft <= thresholds.critical) return ExpiryStatus.CRITICAL
  if (daysLeft <= thresholds.warning) return ExpiryStatus.WARNING
  return ExpiryStatus.GOOD
}

/**
 * Get enriched expiry data for a batch/product
 * This is the main method that should be used by routes
 * 
 * @param {string|Date} expiryDate - Expiry date
 * @param {Object} options - { hotelId, departmentId, locale }
 * @returns {Object} - Enriched expiry data
 */
export async function getEnrichedExpiryData(expiryDate, options = {}) {
  const { hotelId, departmentId, locale = 'ru' } = options

  // Priority: notification_rules > settings > defaults
  let thresholds = DEFAULT_THRESHOLDS

  try {
    // First try to get thresholds from notification_rules
    const rulesThresholds = await getThresholdsFromRules(hotelId)

    if (rulesThresholds) {
      thresholds = {
        critical: rulesThresholds.critical ?? DEFAULT_THRESHOLDS.critical,
        warning: rulesThresholds.warning ?? DEFAULT_THRESHOLDS.warning
      }
    } else {
      // Fallback to settings
      const settings = await getSettings({ hotelId, departmentId })
      if (settings.expiryThresholds) {
        thresholds = {
          critical: settings.expiryThresholds.critical ?? DEFAULT_THRESHOLDS.critical,
          warning: settings.expiryThresholds.warning ?? DEFAULT_THRESHOLDS.warning
        }
      }
    }
  } catch {
    // Use defaults if unavailable
  }

  const daysLeft = calculateDaysUntilExpiry(expiryDate)
  const status = getExpiryStatus(daysLeft, thresholds)
  const color = StatusColor[status]
  const cssClass = StatusCssClass[status]

  // Generate status text based on locale
  const statusText = getStatusText(status, daysLeft, locale)

  return {
    daysLeft,
    status,
    color,
    cssClass,
    statusText,
    isExpired: status === ExpiryStatus.EXPIRED,
    isUrgent: [ExpiryStatus.EXPIRED, ExpiryStatus.TODAY, ExpiryStatus.CRITICAL].includes(status),
    expiryDate: expiryDate instanceof Date ? expiryDate.toISOString() : expiryDate
  }
}

/**
 * Get localized status text
 * @param {string} status - Status enum value
 * @param {number} daysLeft - Days until expiry
 * @param {string} locale - Locale code (ru, en, kk)
 * @returns {string} - Localized status text
 */
function getStatusText(status, daysLeft, locale = 'ru') {
  const texts = {
    ru: {
      [ExpiryStatus.EXPIRED]: daysLeft === -1
        ? 'Просрочено вчера'
        : `Просрочено ${Math.abs(daysLeft)} дн. назад`,
      [ExpiryStatus.TODAY]: 'Истекает сегодня!',
      [ExpiryStatus.CRITICAL]: `Критично: ${daysLeft} дн.`,
      [ExpiryStatus.WARNING]: `Внимание: ${daysLeft} дн.`,
      [ExpiryStatus.GOOD]: `В норме: ${daysLeft} дн.`
    },
    en: {
      [ExpiryStatus.EXPIRED]: daysLeft === -1
        ? 'Expired yesterday'
        : `Expired ${Math.abs(daysLeft)} days ago`,
      [ExpiryStatus.TODAY]: 'Expires today!',
      [ExpiryStatus.CRITICAL]: `Critical: ${daysLeft} days`,
      [ExpiryStatus.WARNING]: `Warning: ${daysLeft} days`,
      [ExpiryStatus.GOOD]: `Good: ${daysLeft} days`
    },
    kk: {
      [ExpiryStatus.EXPIRED]: daysLeft === -1
        ? 'Кеше мерзімі өтті'
        : `${Math.abs(daysLeft)} күн бұрын мерзімі өтті`,
      [ExpiryStatus.TODAY]: 'Бүгін мерзімі аяқталады!',
      [ExpiryStatus.CRITICAL]: `Критикалық: ${daysLeft} күн`,
      [ExpiryStatus.WARNING]: `Назар аударыңыз: ${daysLeft} күн`,
      [ExpiryStatus.GOOD]: `Қалыпты: ${daysLeft} күн`
    }
  }

  return texts[locale]?.[status] || texts.en[status]
}

/**
 * Enrich a batch object with expiry data
 * @param {Object} batch - Batch object with expiry_date
 * @param {Object} options - { hotelId, departmentId, locale }
 * @returns {Object} - Batch with enriched expiry data
 */
export async function enrichBatchWithExpiryData(batch, options = {}) {
  if (!batch) return null

  const expiryData = await getEnrichedExpiryData(
    batch.expiry_date || batch.expiryDate,
    {
      hotelId: options.hotelId || batch.hotel_id,
      departmentId: options.departmentId || batch.department_id,
      locale: options.locale
    }
  )

  return {
    ...batch,
    // Enriched fields from backend (Single Source of Truth)
    daysLeft: expiryData.daysLeft,
    expiryStatus: expiryData.status,
    statusColor: expiryData.color,
    statusCssClass: expiryData.cssClass,
    statusText: expiryData.statusText,
    isExpired: expiryData.isExpired,
    isUrgent: expiryData.isUrgent
  }
}

/**
 * Enrich multiple batches with expiry data
 * @param {Array} batches - Array of batch objects
 * @param {Object} options - { hotelId, departmentId, locale }
 * @returns {Array} - Batches with enriched expiry data
 */
export async function enrichBatchesWithExpiryData(batches, options = {}) {
  if (!batches || !Array.isArray(batches)) return []

  return Promise.all(
    batches.map(batch => enrichBatchWithExpiryData(batch, options))
  )
}

/**
 * Calculate batch statistics with expiry breakdown
 * @param {Array} batches - Array of batch objects (already enriched or raw)
 * @param {Object} options - { hotelId, departmentId }
 * @returns {Object} - Statistics object
 */
export async function calculateBatchStats(batches, options = {}) {
  if (!batches || !Array.isArray(batches)) {
    return { total: 0, good: 0, warning: 0, critical: 0, expired: 0, healthScore: 100 }
  }

  // Get thresholds
  let thresholds = DEFAULT_THRESHOLDS
  try {
    const settings = await getSettings(options)
    if (settings.expiryThresholds) {
      thresholds = settings.expiryThresholds
    }
  } catch {
    // Use defaults
  }

  const stats = {
    total: batches.length,
    good: 0,
    warning: 0,
    critical: 0,
    expired: 0
  }

  for (const batch of batches) {
    const daysLeft = batch.daysLeft ?? calculateDaysUntilExpiry(batch.expiry_date || batch.expiryDate)
    const status = getExpiryStatus(daysLeft, thresholds)

    switch (status) {
      case ExpiryStatus.EXPIRED:
      case ExpiryStatus.TODAY:
        stats.expired++
        break
      case ExpiryStatus.CRITICAL:
        stats.critical++
        break
      case ExpiryStatus.WARNING:
        stats.warning++
        break
      case ExpiryStatus.GOOD:
        stats.good++
        break
    }
  }

  // Health score: percentage of good items
  stats.healthScore = stats.total > 0
    ? Math.round((stats.good / stats.total) * 100)
    : 100

  return stats
}

/**
 * Get default thresholds
 * @returns {Object} - Default threshold values
 */
export function getDefaultThresholds() {
  return { ...DEFAULT_THRESHOLDS }
}

/**
 * Get thresholds for a hotel (from notification_rules or defaults)
 * Exported for API use
 * @param {string} hotelId - Hotel ID
 * @returns {Object} - { warning, critical }
 */
export async function getHotelThresholds(hotelId) {
  const rulesThresholds = await getThresholdsFromRules(hotelId)
  return rulesThresholds || DEFAULT_THRESHOLDS
}

/**
 * Clear thresholds cache (when rules are updated)
 * @param {string} hotelId - Hotel ID or null for all
 */
export function clearThresholdsCache(hotelId = null) {
  if (hotelId) {
    thresholdsCache.delete(`thresholds:${hotelId}`)
  } else {
    thresholdsCache.clear()
  }
}

export default {
  ExpiryStatus,
  StatusColor,
  StatusCssClass,
  calculateDaysUntilExpiry,
  getExpiryStatus,
  getEnrichedExpiryData,
  enrichBatchWithExpiryData,
  enrichBatchesWithExpiryData,
  calculateBatchStats,
  getDefaultThresholds,
  getHotelThresholds,
  clearThresholdsCache
}
