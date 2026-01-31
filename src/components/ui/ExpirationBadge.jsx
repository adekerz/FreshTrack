/**
 * ExpirationBadge Component
 * Цветовая индикация срока годности
 * Порог дней передаётся с бэкенда через настройки
 */

import { cn } from '../../utils/classNames'
import { useTranslation } from '../../context/LanguageContext'

// Дефолтные пороги (должны приходить с бэкенда в реальном приложении)
const DEFAULT_THRESHOLDS = {
  expired: 0,    // <= 0 дней
  critical: 3,   // <= 3 дней
  warning: 7,    // <= 7 дней
}

export default function ExpirationBadge({
  date,
  thresholds = DEFAULT_THRESHOLDS,
  showDays = true,
  size = 'md',
  className = '',
}) {
  const { t } = useTranslation()
  
  if (!date) return null

  const expirationDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expirationDate.setHours(0, 0, 0, 0)
  
  const diffTime = expirationDate.getTime() - today.getTime()
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Определяем конфиг на основе дней до истечения
  const getConfig = () => {
    if (daysUntil <= thresholds.expired) {
      return {
        bg: 'bg-danger/10',
        text: 'text-danger',
        border: 'border-danger/20',
        label: t('status.expired') || 'Истёк',
        icon: '⚠️',
      }
    }
    if (daysUntil <= thresholds.critical) {
      return {
        bg: 'bg-critical/10',
        text: 'text-critical',
        border: 'border-critical/20',
        label: showDays ? `${daysUntil}д` : t('status.critical') || 'Критично',
        icon: '🔥',
      }
    }
    if (daysUntil <= thresholds.warning) {
      return {
        bg: 'bg-warning/10',
        text: 'text-warning',
        border: 'border-warning/20',
        label: showDays ? `${daysUntil}д` : t('status.warning') || 'Скоро',
        icon: '⏰',
      }
    }
    return {
      bg: 'bg-success/10',
      text: 'text-success',
      border: 'border-success/20',
      label: showDays ? `${daysUntil}д` : t('status.fresh') || 'Свежий',
      icon: '✓',
    }
  }

  const config = getConfig()

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium border',
        'transition-colors duration-200',
        config.bg,
        config.text,
        config.border,
        sizes[size],
        className
      )}
      aria-label={`${t('product.expiresIn') || 'Истекает через'} ${daysUntil} ${t('common.days') || 'дней'}`}
    >
      {config.label}
    </span>
  )
}

/**
 * Хук для получения цветовой конфигурации по дням до истечения
 * Полезен для стилизации других элементов
 */
export function useExpirationColor(daysUntil, thresholds = DEFAULT_THRESHOLDS) {
  if (daysUntil <= thresholds.expired) {
    return {
      status: 'expired',
      bgClass: 'bg-danger/10',
      textClass: 'text-danger',
      borderClass: 'border-danger',
      color: '#ef4444',
    }
  }
  if (daysUntil <= thresholds.critical) {
    return {
      status: 'critical',
      bgClass: 'bg-critical/10',
      textClass: 'text-critical',
      borderClass: 'border-critical',
      color: '#f97316',
    }
  }
  if (daysUntil <= thresholds.warning) {
    return {
      status: 'warning',
      bgClass: 'bg-warning/10',
      textClass: 'text-warning',
      borderClass: 'border-warning',
      color: '#eab308',
    }
  }
  return {
    status: 'fresh',
    bgClass: 'bg-success/10',
    textClass: 'text-success',
    borderClass: 'border-success',
    color: '#22c55e',
  }
}
