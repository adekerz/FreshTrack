/**
 * Push Notification Service
 * Сервис для работы с Web Push уведомлениями в браузере
 */

// Проверка поддержки уведомлений
export function isNotificationSupported() {
  return 'Notification' in window
}

// Проверка разрешения на уведомления
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission // 'granted', 'denied', 'default'
}

// Запрос разрешения на уведомления
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return { success: false, error: 'Notifications not supported' }
  }

  try {
    const permission = await Notification.requestPermission()
    return {
      success: permission === 'granted',
      permission
    }
  } catch (error) {
    console.error('Failed to request notification permission:', error)
    return { success: false, error: error.message }
  }
}

// Показать уведомление
export function showNotification(title, options = {}) {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return null
  }

  const defaultOptions = {
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: 'freshtrack-notification',
    renotify: true,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    ...options
  }

  try {
    const notification = new Notification(title, defaultOptions)

    // Обработчик клика по уведомлению
    notification.onclick = () => {
      window.focus()
      if (options.url) {
        window.location.href = options.url
      }
      notification.close()
    }

    // Автоматическое закрытие через указанное время
    if (options.autoClose !== false) {
      setTimeout(() => notification.close(), options.autoCloseDelay || 5000)
    }

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

// Уведомление о просроченных товарах
export function notifyExpiredProducts(products) {
  if (!products || products.length === 0) return

  const count = products.length
  const title = `❌ Просрочено: ${count} ${getProductWord(count)}`
  const body =
    products
      .slice(0, 3)
      .map((p) => `• ${p.name}`)
      .join('\n') + (count > 3 ? `\n...и ещё ${count - 3}` : '')

  return showNotification(title, {
    body,
    tag: 'expired-products',
    icon: '/icons/expired.png',
    url: '/inventory',
    requireInteraction: true
  })
}

// Уведомление о товарах с истекающим сроком
export function notifyExpiringProducts(products, daysLeft) {
  if (!products || products.length === 0) return

  const count = products.length
  const emoji = daysLeft === 0 ? '⚠️' : '⏰'
  const timeText =
    daysLeft === 0 ? 'истекает сегодня' : `истекает через ${daysLeft} ${getDaysWord(daysLeft)}`

  const title = `${emoji} ${count} ${getProductWord(count)} ${timeText}`
  const body =
    products
      .slice(0, 3)
      .map((p) => `• ${p.name}`)
      .join('\n') + (count > 3 ? `\n...и ещё ${count - 3}` : '')

  return showNotification(title, {
    body,
    tag: `expiring-${daysLeft}-days`,
    icon: daysLeft === 0 ? '/icons/warning.png' : '/icons/clock.png',
    url: '/inventory'
  })
}

// Уведомление о сборе товара
export function notifyProductCollected(product, collector) {
  const title = '✅ Товар собран'
  const body = `${product.name} собран пользователем ${collector}`

  return showNotification(title, {
    body,
    tag: 'product-collected',
    autoCloseDelay: 3000
  })
}

// Уведомление о добавлении товара
export function notifyProductAdded(product) {
  const title = '📦 Товар добавлен'
  const body = `${product.name} - ${product.quantity} шт.`

  return showNotification(title, {
    body,
    tag: 'product-added',
    autoCloseDelay: 3000
  })
}

// Утренний отчёт
export function notifyMorningReport(stats) {
  const title = `🌅 Утренний отчёт FreshTrack`
  const body = `📦 Всего: ${stats.total}
⚠️ Требуют внимания: ${stats.warning + stats.critical}
❌ Просрочено: ${stats.expired}`

  return showNotification(title, {
    body,
    tag: 'morning-report',
    icon: '/icons/report.png',
    url: '/dashboard',
    requireInteraction: true
  })
}

// Склонение слова "товар"
function getProductWord(count) {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'товаров'
  if (lastDigit === 1) return 'товар'
  if (lastDigit >= 2 && lastDigit <= 4) return 'товара'
  return 'товаров'
}

// Склонение слова "день"
function getDaysWord(count) {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'дней'
  if (lastDigit === 1) return 'день'
  if (lastDigit >= 2 && lastDigit <= 4) return 'дня'
  return 'дней'
}

// Хук для работы с уведомлениями в React
export function useNotifications() {
  const supported = isNotificationSupported()
  const permission = getNotificationPermission()

  return {
    supported,
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isDefault: permission === 'default',
    requestPermission: requestNotificationPermission,
    show: showNotification,
    notifyExpired: notifyExpiredProducts,
    notifyExpiring: notifyExpiringProducts,
    notifyCollected: notifyProductCollected,
    notifyAdded: notifyProductAdded,
    notifyMorning: notifyMorningReport
  }
}

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
  notifyExpiredProducts,
  notifyExpiringProducts,
  notifyProductCollected,
  notifyProductAdded,
  notifyMorningReport,
  useNotifications
}
