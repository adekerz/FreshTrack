/**
 * Notification Permission Banner
 * Баннер для запроса разрешения на Push-уведомления
 */

import { useState, useEffect } from 'react'
import { Bell, BellOff, X } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission
} from '../utils/browserAlerts'

export default function NotificationPermissionBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [permission, setPermission] = useState('default')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    // Проверяем поддержку и текущее разрешение
    if (!isNotificationSupported()) return

    const currentPermission = getNotificationPermission()
    setPermission(currentPermission)

    // Показываем баннер только если разрешение не запрашивалось
    // и не было отклонено, и пользователь его не скрывал
    const dismissed = localStorage.getItem('notification-banner-dismissed')
    if (currentPermission === 'default' && !dismissed) {
      // Показываем с небольшой задержкой
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleRequestPermission = async () => {
    setRequesting(true)
    const result = await requestNotificationPermission()
    setRequesting(false)
    setPermission(result.permission)

    if (result.success || result.permission === 'denied') {
      setVisible(false)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem('notification-banner-dismissed', 'true')
  }

  if (!visible || permission !== 'default') return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-foreground to-foreground/90 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bell className="w-5 h-5" />
              <span className="font-medium">
                {t('notifications.pushBanner.title') || 'Уведомления'}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t('notifications.pushBanner.description') ||
              'Включите уведомления, чтобы получать оповещения о товарах с истекающим сроком годности прямо в браузере.'}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestPermission}
              disabled={requesting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {requesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('common.loading') || 'Загрузка...'}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>{t('notifications.pushBanner.enable') || 'Включить'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {t('notifications.pushBanner.later') || 'Позже'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Компонент статуса уведомлений для настроек
 */
export function NotificationStatus() {
  const { t } = useTranslation()
  const [permission, setPermission] = useState('checking')

  useEffect(() => {
    if (!isNotificationSupported()) {
      setPermission('unsupported')
      return
    }
    setPermission(getNotificationPermission())
  }, [])

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission()
    setPermission(result.permission)
  }

  const getStatusInfo = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: Bell,
          text: t('notifications.status.enabled') || 'Уведомления включены',
          color: 'text-success',
          bgColor: 'bg-success/10'
        }
      case 'denied':
        return {
          icon: BellOff,
          text: t('notifications.status.disabled') || 'Уведомления заблокированы',
          color: 'text-danger',
          bgColor: 'bg-danger/10'
        }
      case 'unsupported':
        return {
          icon: BellOff,
          text: t('notifications.status.unsupported') || 'Не поддерживается',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted'
        }
      case 'checking':
        return {
          icon: Bell,
          text: t('common.loading') || 'Загрузка...',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted'
        }
      default:
        return {
          icon: Bell,
          text: t('notifications.status.notRequested') || 'Не запрошены',
          color: 'text-warning',
          bgColor: 'bg-warning/10'
        }
    }
  }

  const status = getStatusInfo()
  const Icon = status.icon

  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${status.bgColor}`}>
          <Icon className={`w-5 h-5 ${status.color}`} />
        </div>
        <div>
          <p className="font-medium text-foreground">
            {t('notifications.browserNotifications') || 'Браузерные уведомления'}
          </p>
          <p className={`text-sm ${status.color}`}>{status.text}</p>
        </div>
      </div>

      {permission === 'default' && (
        <button
          onClick={handleRequestPermission}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm hover:bg-foreground/90 transition-colors"
        >
          {t('notifications.enable') || 'Включить'}
        </button>
      )}

      {permission === 'denied' && (
        <p className="text-xs text-muted-foreground max-w-[150px] text-right">
          {t('notifications.deniedHint') || 'Измените в настройках браузера'}
        </p>
      )}
    </div>
  )
}
