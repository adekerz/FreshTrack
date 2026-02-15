/**
 * ExportProgress Component
 * Shows export progress notification with status
 * Uses CSS animations instead of framer-motion
 */

import { Download, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * ExportProgress - уведомление о прогрессе экспорта
 * @param {string} status - 'downloading' | 'success' | 'error'
 * @param {string} filename - Имя файла
 * @param {Function} onDismiss - Callback для закрытия
 * @param {number} autoDismissDelay - Автоматическое закрытие (мс)
 */
export default function ExportProgress({
  status,
  filename,
  onDismiss,
  autoDismissDelay = 5000
}) {
  // Auto-dismiss on success/error
  useEffect(() => {
    if (status !== 'downloading' && autoDismissDelay > 0) {
      const timer = setTimeout(onDismiss, autoDismissDelay)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [status, onDismiss, autoDismissDelay])

  const statusConfig = {
    downloading: {
      icon: Download,
      iconClass: 'text-accent animate-bounce',
      bgClass: 'bg-accent/10',
      title: 'Генерация экспорта...',
      showProgress: true
    },
    success: {
      icon: CheckCircle,
      iconClass: 'text-success',
      bgClass: 'bg-success/10',
      title: 'Экспорт завершен',
      showProgress: false
    },
    error: {
      icon: AlertCircle,
      iconClass: 'text-danger',
      bgClass: 'bg-danger/10',
      title: 'Ошибка экспорта',
      showProgress: false
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div
      className="
        fixed bottom-20 sm:bottom-4 right-4
        bg-card rounded-xl shadow-lg border border-border
        p-4 max-w-sm w-[calc(100%-2rem)] sm:w-auto
        z-50
        animate-slide-up
      "
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgClass}`}>
          {status === 'downloading' ? (
            <Loader2 className={`w-5 h-5 ${config.iconClass}`} />
          ) : (
            <Icon className={`w-5 h-5 ${config.iconClass}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{config.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-1">{filename}</p>

          {/* Progress bar */}
          {config.showProgress && (
            <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent h-1.5 rounded-full animate-progress"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>

        {/* Close button */}
        {status !== 'downloading' && (
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
