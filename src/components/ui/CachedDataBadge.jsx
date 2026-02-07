/**
 * CachedDataBadge — бейдж «Данные из кеша» на карточках при offline.
 * React Query networkMode: 'offlineFirst' + SW кеш API — пользователь видит кешированные данные.
 */

import { Database } from 'lucide-react'
import { useTranslation } from '../../context/LanguageContext'
import { useOnlineStatus } from './OfflineIndicator'
import { cn } from '../../utils/classNames'

export default function CachedDataBadge({ className = '', compact = false }) {
  const isOnline = useOnlineStatus()
  const { t } = useTranslation()

  if (isOnline) return null

  const label = t('offline.dataCached') || 'Данные из кэша'

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium',
        'bg-amber-500/15 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20',
        'border border-amber-500/30',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        className
      )}
    >
      <Database className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden />
      {!compact && <span>{label}</span>}
    </span>
  )
}
