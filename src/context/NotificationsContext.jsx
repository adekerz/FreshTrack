/**
 * FreshTrack Real-time Notifications Context
 * Live notifications via SSE
 * 
 * Features:
 * - Real-time notifications from backend
 * - Expiring alerts, write-offs, inventory updates
 * - Unread count badge
 * - Notification history (max 50)
 * - Mark as read functionality
 * 
 * Backend = Single Source of Truth
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useSSE, SSE_EVENTS } from '../hooks/useSSE'
import { useAuth } from './AuthContext'

// Notification severity levels
export const NOTIFICATION_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
  SUCCESS: 'success'
}

// Notification types
export const NOTIFICATION_TYPE = {
  EXPIRING_ALERT: 'expiring-alert',
  WRITE_OFF: 'write-off',
  INVENTORY_UPDATE: 'inventory-update',
  BATCH_UPDATE: 'batch-update',
  SYSTEM: 'system',
  BRANDING: 'branding',
  SETTINGS: 'settings'
}

// Max notifications to keep in state
const MAX_NOTIFICATIONS = 50

const NotificationsContext = createContext(null)

/**
 * Create notification object from SSE data
 */
function createNotification(type, data, severity = NOTIFICATION_SEVERITY.INFO) {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    title: data.title || getDefaultTitle(type),
    message: data.message || formatMessage(type, data),
    data,
    read: false,
    createdAt: data.timestamp || new Date().toISOString()
  }
}

/**
 * Get default title based on notification type
 */
function getDefaultTitle(type) {
  const titles = {
    [NOTIFICATION_TYPE.EXPIRING_ALERT]: 'Истекает срок годности',
    [NOTIFICATION_TYPE.WRITE_OFF]: 'Списание',
    [NOTIFICATION_TYPE.INVENTORY_UPDATE]: 'Обновление склада',
    [NOTIFICATION_TYPE.BATCH_UPDATE]: 'Обновление партии',
    [NOTIFICATION_TYPE.SYSTEM]: 'Системное уведомление',
    [NOTIFICATION_TYPE.BRANDING]: 'Брендинг обновлен',
    [NOTIFICATION_TYPE.SETTINGS]: 'Настройки изменены'
  }
  return titles[type] || 'Уведомление'
}

/**
 * Format message from notification data
 */
function formatMessage(type, data) {
  switch (type) {
    case NOTIFICATION_TYPE.EXPIRING_ALERT:
      return `${data.productName}: осталось ${data.daysLeft} дн.`
    case NOTIFICATION_TYPE.WRITE_OFF:
      return `${data.productName}: списано ${data.quantity} шт. (${data.reason || 'без причины'})`
    case NOTIFICATION_TYPE.INVENTORY_UPDATE:
      return `${data.action}: ${data.item?.name || 'товар'}`
    case NOTIFICATION_TYPE.BATCH_UPDATE:
      return `Партия ${data.productName || 'товара'} обновлена`
    case NOTIFICATION_TYPE.BRANDING:
      return `Обновлено пользователем ${data.updatedBy || 'система'}`
    case NOTIFICATION_TYPE.SETTINGS:
      return `Настройка ${data.key} изменена`
    default:
      return data.message || 'Новое уведомление'
  }
}

/**
 * Get severity for notification type
 */
function getSeverity(type, data) {
  switch (type) {
    case NOTIFICATION_TYPE.EXPIRING_ALERT:
      if (data.daysLeft <= 1) return NOTIFICATION_SEVERITY.CRITICAL
      if (data.daysLeft <= 3) return NOTIFICATION_SEVERITY.WARNING
      return NOTIFICATION_SEVERITY.INFO
    case NOTIFICATION_TYPE.WRITE_OFF:
      return NOTIFICATION_SEVERITY.WARNING
    case NOTIFICATION_TYPE.INVENTORY_UPDATE:
    case NOTIFICATION_TYPE.BATCH_UPDATE:
      return NOTIFICATION_SEVERITY.INFO
    case NOTIFICATION_TYPE.BRANDING:
    case NOTIFICATION_TYPE.SETTINGS:
      return NOTIFICATION_SEVERITY.SUCCESS
    default:
      return data.severity || NOTIFICATION_SEVERITY.INFO
  }
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length

  // Add notification
  const addNotification = useCallback((type, data) => {
    const severity = getSeverity(type, data)
    const notification = createNotification(type, data, severity)
    
    setNotifications(prev => {
      const updated = [notification, ...prev]
      // Keep only last MAX_NOTIFICATIONS
      return updated.slice(0, MAX_NOTIFICATIONS)
    })

    // Play sound for critical notifications
    if (soundEnabled && severity === NOTIFICATION_SEVERITY.CRITICAL) {
      playNotificationSound()
    }

    return notification
  }, [soundEnabled])

  // SSE event handlers
  const handleExpiringAlert = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.EXPIRING_ALERT, data)
  }, [addNotification])

  const handleWriteOff = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.WRITE_OFF, data)
  }, [addNotification])

  const handleInventoryUpdate = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.INVENTORY_UPDATE, data)
  }, [addNotification])

  const handleBatchUpdate = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.BATCH_UPDATE, data)
  }, [addNotification])

  const handleBrandingUpdate = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.BRANDING, data)
  }, [addNotification])

  const handleSettingsUpdate = useCallback((data) => {
    addNotification(NOTIFICATION_TYPE.SETTINGS, data)
  }, [addNotification])

  const handleNotification = useCallback((data) => {
    // Generic notification from backend
    const type = data.type || NOTIFICATION_TYPE.SYSTEM
    addNotification(type, data)
  }, [addNotification])

  // SSE connection
  const { isConnected, state: sseState, reconnect } = useSSE({
    enabled: !!user,
    handlers: {
      onExpiringAlert: handleExpiringAlert,
      onWriteOff: handleWriteOff,
      onInventoryUpdate: handleInventoryUpdate,
      onBatchUpdate: handleBatchUpdate,
      onBrandingUpdate: handleBrandingUpdate,
      onSettingsUpdate: handleSettingsUpdate,
      onNotification: handleNotification
    },
    onConnect: () => {
      console.log('[Notifications] SSE connected')
    },
    onDisconnect: () => {
      console.log('[Notifications] SSE disconnected')
    }
  })

  // Mark single notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
  }, [])

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Remove single notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  // Get notifications by type
  const getByType = useCallback((type) => {
    return notifications.filter(n => n.type === type)
  }, [notifications])

  // Get critical notifications
  const criticalNotifications = notifications.filter(
    n => n.severity === NOTIFICATION_SEVERITY.CRITICAL && !n.read
  )

  // Clear old notifications (older than 24h)
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      setNotifications(prev => 
        prev.filter(n => n.createdAt > cutoff || !n.read)
      )
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  const value = {
    // State
    notifications,
    unreadCount,
    criticalNotifications,
    hasCritical: criticalNotifications.length > 0,
    
    // SSE status
    isConnected,
    sseState,
    reconnect,
    
    // Settings
    soundEnabled,
    setSoundEnabled,
    
    // Actions
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    getByType
  }

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  try {
    // Use Web Audio API for notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 880 // A5 note
    oscillator.type = 'sine'
    gainNode.gain.value = 0.1
    
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.15)
    
    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator()
      osc2.connect(gainNode)
      osc2.frequency.value = 1100
      osc2.type = 'sine'
      osc2.start()
      osc2.stop(audioContext.currentTime + 0.15)
    }, 200)
  } catch (e) {
    // Audio not supported or blocked
    console.warn('[Notifications] Sound playback failed:', e)
  }
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}

export default NotificationsContext
