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
    return { status: 'today', label: 'Expires Today', color: 'critical' }
  }
  if (days <= 3) {
    return { status: 'critical', label: 'Critical', color: 'critical' }
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
 * Нормализует строку даты к UTC: если нет Z/offset — считаем UTC (как из БД).
 * Строки с Z или +00:00 не трогаем — иначе браузер парсит "2026-01-30T17:54:00" как локальное время и время отображается как UTC.
 */
function normalizeToUTC(date) {
  if (date instanceof Date) return date
  if (typeof date !== 'string') return date
  const s = date.trim()
  if (!s) return date
  // Уже UTC (Z или смещение) — возвращаем как есть, чтобы new Date() распарсил как UTC
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s
  // ISO без смещения (например из PostgreSQL) — дописываем Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.replace(/\.\d{3}$/, '') + 'Z'
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T') + 'Z'
  return date
}

/**
 * Валидная IANA timezone для отображения (не пустая строка).
 * @param {string|null|undefined} tz
 * @returns {string|null}
 */
function validTimezone(tz) {
  if (tz == null) return null
  const s = String(tz).trim()
  return s.length > 0 ? s : null
}

/**
 * Нормализует timezone отеля для отображения времени.
 * Asia/Almaty с 2024 года UTC+5; для Казахстана используем Asia/Qostanay (UTC+6).
 * @param {string|null|undefined} tz - Значение из API (м.б. подпись или другая IANA)
 * @returns {string|null} IANA timezone или null
 */
export function normalizeHotelTimezone(tz) {
  if (tz == null) return null
  const s = String(tz).trim()
  if (!s) return null

  // Астана/Алматы с 2024 года UTC+5 в IANA; для отображения используем Asia/Qostanay (UTC+6)
  if (s === 'Asia/Almaty' || s === 'Asia/Aqtobe') return 'Asia/Qostanay'
  if (/almat|алмат|астан|astana/i.test(s)) return 'Asia/Qostanay'
  if (s === 'Asia/Qostanay') return s

  return s
}

/**
 * Форматирование даты с учётом timezone отеля.
 * API отдаёт даты в UTC (Z); здесь явно конвертируем в целевую зону.
 * @param {string|Date} date - Дата (UTC из БД, напр. "2026-01-30T08:01:33.386Z")
 * @param {boolean} includeTime - Показывать время
 * @param {string} timezone - IANA timezone (например, 'Asia/Almaty')
 * @returns {string} Отформатированная дата
 */
export function formatDate(date, includeTime = false, timezone = null) {
  if (!date) return '—'
  const normalized = normalizeToUTC(date)
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return '—'

  const tz = timezone != null ? validTimezone(normalizeHotelTimezone(timezone) ?? timezone) : null
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Без timezone — время по устройству (toLocaleString гарантированно использует локаль)
  if (!tz) {
    return d.toLocaleString('ru-RU', options)
  }
  options.timeZone = tz
  return new Intl.DateTimeFormat('ru-RU', options).format(d)
}

/**
 * Форматирование относительного времени («5 минут назад»)
 * @param {string|Date} date - Дата
 * @param {string} timezone - IANA timezone (для fallback formatDate)
 * @returns {string}
 */
export function formatRelativeTime(date, timezone = null) {
  if (!date) return '—'
  const now = new Date()
  const then = new Date(date)
  if (Number.isNaN(then.getTime())) return '—'

  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMs < 0) return formatDate(date, true, timezone)
  if (diffMins < 1) return 'Только что'
  if (diffMins < 60) return `${diffMins} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`

  return formatDate(date, true, timezone)
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
