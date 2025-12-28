/**
 * OfflineIndicator Component
 * Показывает статус подключения к сети
 * Критично для PWA - пользователь должен знать о работе в offline
 */

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { cn } from '../../utils/classNames'
import { useTranslation } from '../../context/LanguageContext'

export default function OfflineIndicator({ className = '' }) {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [showReconnected, setShowReconnected] = useState(false)
  const [pendingChanges, setPendingChanges] = useState(0)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      // Скрываем через 3 секунды
      setTimeout(() => setShowReconnected(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Проверяем наличие несинхронизированных изменений в localStorage/IndexedDB
  useEffect(() => {
    const checkPendingChanges = () => {
      try {
        const pending = localStorage.getItem('freshtrack_pending_sync')
        if (pending) {
          const data = JSON.parse(pending)
          setPendingChanges(Array.isArray(data) ? data.length : 0)
        }
      } catch {
        setPendingChanges(0)
      }
    }

    checkPendingChanges()
    window.addEventListener('storage', checkPendingChanges)
    
    return () => window.removeEventListener('storage', checkPendingChanges)
  }, [])

  // Не показываем если online и нет сообщения о переподключении
  if (isOnline && !showReconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 inset-x-0 z-50',
        'safe-top',
        'transition-all duration-300 ease-out',
        className
      )}
    >
      {!isOnline ? (
        // Offline режим
        <div className="bg-amber-500 text-white">
          <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>
              {t('offline.message') || 'Нет подключения — изменения сохранятся при восстановлении связи'}
            </span>
            {pendingChanges > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {pendingChanges} {t('offline.pending') || 'ожидает'}
              </span>
            )}
          </div>
        </div>
      ) : showReconnected ? (
        // Подключение восстановлено
        <div className="bg-green-500 text-white animate-fade-in">
          <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
            <Wifi className="w-4 h-4" />
            <span>{t('offline.reconnected') || 'Подключение восстановлено'}</span>
            {pendingChanges > 0 && (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('offline.syncing') || 'Синхронизация...'}</span>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Hook для работы с offline состоянием
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Hook для сохранения данных offline
 */
export function usePendingSync() {
  const addPendingChange = (change) => {
    try {
      const existing = localStorage.getItem('freshtrack_pending_sync')
      const pending = existing ? JSON.parse(existing) : []
      pending.push({
        ...change,
        id: Date.now(),
        timestamp: new Date().toISOString(),
      })
      localStorage.setItem('freshtrack_pending_sync', JSON.stringify(pending))
      window.dispatchEvent(new Event('storage'))
    } catch (error) {
      console.error('Failed to save pending change:', error)
    }
  }

  const getPendingChanges = () => {
    try {
      const pending = localStorage.getItem('freshtrack_pending_sync')
      return pending ? JSON.parse(pending) : []
    } catch {
      return []
    }
  }

  const clearPendingChanges = () => {
    localStorage.removeItem('freshtrack_pending_sync')
    window.dispatchEvent(new Event('storage'))
  }

  return { addPendingChange, getPendingChanges, clearPendingChanges }
}
