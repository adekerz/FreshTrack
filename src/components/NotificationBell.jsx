/**
 * FreshTrack Notification Bell
 * Real-time notification indicator with dropdown
 *
 * Features:
 * - Unread count badge
 * - SSE connection indicator
 * - Dropdown with notifications list
 * - Severity-based icons and colors
 * - Mark as read functionality
 */

import { useState, useRef, useEffect } from 'react'
import { useNotifications, NOTIFICATION_SEVERITY } from '../context/NotificationsContext'
import { useLanguage } from '../context/LanguageContext'

// Icons as SVG components for better performance
const BellIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
)

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const XIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const WifiIcon = ({ className, connected }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {connected ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-7.072m0 0L4.929 5.636M3 3l18 18"
      />
    )}
  </svg>
)

// Severity icons
const SeverityIcon = ({ severity, className }) => {
  switch (severity) {
    case NOTIFICATION_SEVERITY.CRITICAL:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      )
    case NOTIFICATION_SEVERITY.WARNING:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      )
    case NOTIFICATION_SEVERITY.SUCCESS:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      )
  }
}

// Get severity color classes
function getSeverityClasses(severity) {
  switch (severity) {
    case NOTIFICATION_SEVERITY.CRITICAL:
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-600 dark:text-red-400',
        icon: 'text-red-500'
      }
    case NOTIFICATION_SEVERITY.WARNING:
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-600 dark:text-amber-400',
        icon: 'text-amber-500'
      }
    case NOTIFICATION_SEVERITY.SUCCESS:
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-600 dark:text-green-400',
        icon: 'text-green-500'
      }
    default:
      return {
        bg: 'bg-accent/10 dark:bg-accent/20',
        text: 'text-accent dark:text-accent-light',
        icon: 'text-accent'
      }
  }
}

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const { t } = useLanguage()
  const {
    notifications,
    unreadCount,
    hasCritical,
    isConnected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  } = useNotifications()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    // TODO: Navigate to relevant page based on notification type
  }

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors touch-manipulation
          hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/50
          ${hasCritical ? 'animate-pulse' : ''}
        `}
        aria-label={t('notifications.title') || 'Уведомления'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <BellIcon className="w-6 h-6 text-muted-foreground" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className={`
            absolute -top-1 -right-1 flex items-center justify-center
            min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full
            ${hasCritical ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}
          `}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* SSE Connection Indicator */}
        <span
          className={`
          absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background
          ${isConnected ? 'bg-green-500' : 'bg-red-500'}
        `}
          title={isConnected ? 'Подключено' : 'Отключено'}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`
            absolute right-0 mt-2 w-80 max-h-[70vh] overflow-hidden
            bg-card rounded-xl shadow-xl border border-border
            z-50 animate-in fade-in slide-in-from-top-2 duration-200
          `}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {t('notifications.title') || 'Уведомления'}
              </h3>
              <WifiIcon
                className={`w-4 h-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`}
                connected={isConnected}
              />
            </div>

            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-primary hover:underline">
                {t('notifications.markAllRead') || 'Прочитать все'}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[50vh] divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BellIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>{t('notifications.empty') || 'Нет уведомлений'}</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const colors = getSeverityClasses(notification.severity)

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      flex gap-3 p-3 cursor-pointer transition-colors
                      hover:bg-muted/50
                      ${!notification.read ? colors.bg : ''}
                    `}
                    role="menuitem"
                  >
                    {/* Severity Icon */}
                    <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
                      <SeverityIcon severity={notification.severity} className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${colors.text}`}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeNotification(notification.id)
                          }}
                          className="flex-shrink-0 p-0.5 rounded hover:bg-muted"
                          aria-label="Удалить"
                        >
                          <XIcon className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('notifications.clearAll') || 'Очистить все'}
              </button>

              <span className="text-xs text-muted-foreground">
                {notifications.length} {t('notifications.items') || 'уведомлений'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
