/**
 * Email Configuration - единый источник правды для email адресов
 * Все email адреса должны импортироваться из этого файла
 */

export const EMAIL_FROM = {
  system: 'FreshTrack System <system@freshtrack.systems>',
  noreply: 'FreshTrack <no-reply@freshtrack.systems>',
} as const

// По умолчанию используем system@ для 99% писем
export const DEFAULT_FROM = EMAIL_FROM.system

// no-reply используется только для auth писем (password reset, verification, etc.)
export const AUTH_FROM = EMAIL_FROM.noreply