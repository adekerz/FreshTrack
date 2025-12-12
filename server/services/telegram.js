/**
 * FreshTrack Telegram Service
 * Интеграция с Telegram Bot API для отправки уведомлений и команд
 */

import TelegramBot from 'node-telegram-bot-api'
import { logNotification, getActiveProducts, getAllProducts, getNotificationLogs, getStats, getSetting } from '../db/database.js'

// Функции для получения настроек (сначала БД, потом .env)
function getBotToken() {
  const dbToken = getSetting('TELEGRAM_BOT_TOKEN')
  return dbToken || process.env.TELEGRAM_BOT_TOKEN || '7792952266:AAHWSDqKWBkFOtvmmjOlre_pR84bBnV9I4Y'
}

function getChatId() {
  const dbChatId = getSetting('TELEGRAM_CHAT_ID')
  return dbChatId || process.env.TELEGRAM_CHAT_ID || '-1003390509067'
}

// Создаём экземпляр бота
let bot = null
let pollingEnabled = false

/**
 * Инициализация Telegram бота
 * @param {boolean} enablePolling - Включить polling для получения команд
 */
export function initTelegramBot(enablePolling = false) {
  const BOT_TOKEN = getBotToken()
  
  if (!BOT_TOKEN) {
    console.warn('⚠️ Telegram bot token not configured')
    return null
  }

  try {
    // Если бот уже создан, останавливаем его
    if (bot) {
      if (pollingEnabled) {
        bot.stopPolling()
      }
    }

    bot = new TelegramBot(BOT_TOKEN, { polling: enablePolling })
    pollingEnabled = enablePolling
    
    if (enablePolling) {
      setupCommandHandlers()
      console.log('✅ Telegram bot initialized with polling (commands enabled)')
    } else {
      console.log('✅ Telegram bot initialized (notifications only)')
    }
    
    return bot
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error)
    return null
  }
}

/**
 * Настройка обработчиков команд
 */
function setupCommandHandlers() {
  if (!bot) return

  // /start - Приветственное сообщение
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    const welcomeMessage = `👋 *Добро пожаловать в FreshTrack Bot!*

🏨 Система управления сроками годности
The Ritz-Carlton

*Доступные команды:*

/status - Текущий статус системы
/report - Краткий отчёт по товарам
/alerts - Список требующих внимания товаров
/departments - Информация по отделам
/help - Справка по командам

📱 Вы будете получать уведомления о товарах с истекающим сроком годности.`

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' })
  })

  // /help - Справка по командам
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id
    const helpMessage = `📚 *Справка по командам FreshTrack*

*Основные команды:*
/status - Общая статистика системы
/report - Сводный отчёт по всем товарам
/alerts - Товары требующие внимания
/departments - Статистика по отделам

*Дополнительные команды:*
/today - Товары истекающие сегодня
/week - Товары истекающие на этой неделе
/expired - Просроченные товары

*Информация:*
/info - О системе FreshTrack
/feedback - Отправить отзыв

💡 _Уведомления отправляются автоматически каждый день в установленное время._`

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' })
  })

  // /status - Статус системы
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const stats = calculateStats(products)
      
      const statusMessage = `📊 *Статус системы FreshTrack*

🏨 The Ritz-Carlton
📅 ${formatDate()}

*Общая статистика:*
📦 Всего партий: ${stats.total}
✅ В норме: ${stats.good}
⚠️ Внимание: ${stats.warning}
❗ Критично: ${stats.critical}
❌ Просрочено: ${stats.expired}

*Индекс здоровья:* ${stats.healthScore}%

${stats.healthScore >= 80 ? '🟢' : stats.healthScore >= 50 ? '🟡' : '🔴'} Состояние: ${
  stats.healthScore >= 80 ? 'Отлично' : 
  stats.healthScore >= 50 ? 'Требует внимания' : 
  'Критическое'
}`

      bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при получении статуса')
      console.error('Status command error:', error)
    }
  })

  // /report - Сводный отчёт
  bot.onText(/\/report/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const stats = calculateStats(products)
      const departments = calculateDepartmentStats(products)
      
      let reportMessage = `📋 *Сводный отчёт FreshTrack*

📅 ${formatDate()} | ${formatTime()}

*═══ Общая статистика ═══*
📦 Всего партий: ${stats.total}
✅ Хорошо: ${stats.good} (${Math.round(stats.good/stats.total*100) || 0}%)
⚠️ Внимание: ${stats.warning} (${Math.round(stats.warning/stats.total*100) || 0}%)
❗ Критично: ${stats.critical} (${Math.round(stats.critical/stats.total*100) || 0}%)
❌ Просрочено: ${stats.expired} (${Math.round(stats.expired/stats.total*100) || 0}%)

*═══ По отделам ═══*`

      for (const [deptId, deptStats] of Object.entries(departments)) {
        const deptName = departmentNames[deptId] || deptId
        const healthEmoji = deptStats.healthScore >= 80 ? '🟢' : deptStats.healthScore >= 50 ? '🟡' : '🔴'
        
        reportMessage += `

${healthEmoji} *${deptName}*
   Партий: ${deptStats.total} | Проблемных: ${deptStats.critical + deptStats.expired}`
      }

      reportMessage += `

_Отчёт сформирован автоматически_`

      bot.sendMessage(chatId, reportMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при формировании отчёта')
      console.error('Report command error:', error)
    }
  })

  // /alerts - Товары требующие внимания
  bot.onText(/\/alerts/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const alertProducts = products.filter(p => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft <= 7
      }).slice(0, 15) // Лимит 15 товаров
      
      if (alertProducts.length === 0) {
        bot.sendMessage(chatId, `✅ *Отличные новости!*

Нет товаров требующих немедленного внимания.
Все сроки годности в норме.

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let alertMessage = `🚨 *Товары требующие внимания*

📅 ${formatDate()}

`
      
      alertProducts.forEach((p, i) => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        const emoji = daysLeft < 0 ? '❌' : daysLeft === 0 ? '⚠️' : '⏰'
        const deptName = departmentNames[p.department] || p.department
        
        alertMessage += `${emoji} *${p.name}*
   📍 ${deptName} | ${daysLeft < 0 ? 'Просрочен' : daysLeft === 0 ? 'Сегодня!' : `${daysLeft} дн.`}

`
      })

      if (products.filter(p => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft <= 7
      }).length > 15) {
        alertMessage += `_...и ещё ${products.filter(p => {
          const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
          return daysLeft <= 7
        }).length - 15} товаров_`
      }

      bot.sendMessage(chatId, alertMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при получении списка')
      console.error('Alerts command error:', error)
    }
  })

  // /departments - Статистика по отделам
  bot.onText(/\/departments/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const departments = calculateDepartmentStats(products)
      
      let deptMessage = `🏢 *Статистика по отделам*

📅 ${formatDate()}

`

      for (const [deptId, stats] of Object.entries(departments)) {
        const deptName = departmentNames[deptId] || deptId
        const healthEmoji = stats.healthScore >= 80 ? '🟢' : stats.healthScore >= 50 ? '🟡' : '🔴'
        const progressBar = generateProgressBar(stats.healthScore)
        
        deptMessage += `*${deptName}*
${healthEmoji} ${progressBar} ${stats.healthScore}%
📦 Партий: ${stats.total}
✅ Норма: ${stats.good} | ⚠️ Внимание: ${stats.warning}
❗ Критично: ${stats.critical} | ❌ Просрочено: ${stats.expired}

`
      }

      bot.sendMessage(chatId, deptMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при получении данных')
      console.error('Departments command error:', error)
    }
  })

  // /today - Товары истекающие сегодня
  bot.onText(/\/today/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const todayProducts = products.filter(p => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft === 0
      })
      
      if (todayProducts.length === 0) {
        bot.sendMessage(chatId, `✅ *Сегодня нет товаров с истекающим сроком*

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let message = `⚠️ *Истекает СЕГОДНЯ*

📅 ${formatDate()}

`
      
      todayProducts.forEach(p => {
        const deptName = departmentNames[p.department] || p.department
        message += `• *${p.name}*
   📍 ${deptName} | 📦 ${p.quantity} шт.

`
      })

      message += `_Всего: ${todayProducts.length} товаров_`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка')
      console.error('Today command error:', error)
    }
  })

  // /expired - Просроченные товары
  bot.onText(/\/expired/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const expiredProducts = products.filter(p => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft < 0
      })
      
      if (expiredProducts.length === 0) {
        bot.sendMessage(chatId, `✅ *Просроченных товаров нет!*

Отличная работа команды! 🎉

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let message = `❌ *Просроченные товары*

📅 ${formatDate()}

`
      
      expiredProducts.slice(0, 10).forEach(p => {
        const deptName = departmentNames[p.department] || p.department
        const daysExpired = Math.abs(Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)))
        
        message += `• *${p.name}*
   📍 ${deptName} | ⏰ ${daysExpired} дн. назад

`
      })

      if (expiredProducts.length > 10) {
        message += `_...и ещё ${expiredProducts.length - 10} товаров_

`
      }

      message += `⚠️ _Требуется немедленное изъятие!_`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка')
      console.error('Expired command error:', error)
    }
  })

  // /info - О системе
  bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id
    const infoMessage = `ℹ️ *О системе FreshTrack*

*FreshTrack* — система управления сроками годности продуктов для отелей премиум-класса.

🏨 *Клиент:* The Ritz-Carlton
📦 *Версия:* 2.0.0
🛠 *Разработчик:* Adilet Y.

*Возможности:*
• Отслеживание сроков годности
• Автоматические уведомления
• Статистика по отделам
• Экспорт отчётов

💬 Telegram: @aadeke
📧 Поддержка: esimadilet@gmail.com`

    bot.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' })
  })

  console.log('✅ Command handlers registered')
}

/**
 * Вычисление статистики по товарам
 */
function calculateStats(products) {
  const stats = { total: 0, good: 0, warning: 0, critical: 0, expired: 0 }
  
  products.forEach(p => {
    stats.total++
    const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    
    if (daysLeft < 0) stats.expired++
    else if (daysLeft <= 3) stats.critical++
    else if (daysLeft <= 7) stats.warning++
    else stats.good++
  })
  
  stats.healthScore = stats.total > 0 
    ? Math.round((stats.good / stats.total) * 100) 
    : 100
    
  return stats
}

/**
 * Вычисление статистики по отделам
 */
function calculateDepartmentStats(products) {
  const departments = {}
  
  products.forEach(p => {
    const deptId = p.department || 'unknown'
    if (!departments[deptId]) {
      departments[deptId] = { total: 0, good: 0, warning: 0, critical: 0, expired: 0 }
    }
    
    departments[deptId].total++
    const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    
    if (daysLeft < 0) departments[deptId].expired++
    else if (daysLeft <= 3) departments[deptId].critical++
    else if (daysLeft <= 7) departments[deptId].warning++
    else departments[deptId].good++
  })
  
  // Добавляем healthScore для каждого отдела
  for (const deptId of Object.keys(departments)) {
    const dept = departments[deptId]
    dept.healthScore = dept.total > 0 
      ? Math.round((dept.good / dept.total) * 100) 
      : 100
  }
  
  return departments
}

/**
 * Генерация прогресс-бара
 */
function generateProgressBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length)
  const empty = length - filled
  return '▓'.repeat(filled) + '░'.repeat(empty)
}

/**
 * Маппинг отделов на русские названия
 */
const departmentNames = {
  'honor-bar': 'Honor Bar',
  'mokki-bar': 'Mokki Bar',
  'ozen-bar': 'Ozen Bar'
}

/**
 * Форматирование списка продуктов для сообщения
 */
function formatProductList(products) {
  if (!products || products.length === 0) return ''
  
  return products.map(p => {
    const deptName = departmentNames[p.department] || p.department
    return `• ${p.name} (${deptName}) - ${p.quantity} шт.`
  }).join('\n')
}

/**
 * Форматирование даты
 */
function formatDate(date = new Date()) {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Форматирование времени
 */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Отправка уведомления о продуктах
 * @param {Object} params - Параметры уведомления
 * @param {Array} params.expiredProducts - Просроченные продукты
 * @param {Array} params.expiringToday - Истекающие сегодня
 * @param {Array} params.expiringSoon - Истекающие в течение 3 дней
 */
export async function sendDailyAlert({ expiredProducts = [], expiringToday = [], expiringSoon = [] }) {
  if (!bot) {
    initTelegramBot()
  }

  if (!bot) {
    console.error('Telegram bot not available')
    return { success: false, error: 'Bot not initialized' }
  }

  const totalProducts = expiredProducts.length + expiringToday.length + expiringSoon.length

  // Если нет продуктов для уведомления
  if (totalProducts === 0) {
    console.log('📭 No products to notify about')
    return { success: true, message: 'No products need attention' }
  }

  // Формируем сообщение
  let message = `🚨 *FreshTrack Alert | Ritz-Carlton*\n\n`

  // Истекает сегодня
  if (expiringToday.length > 0) {
    message += `⚠️ *СРОЧНО - Истекает сегодня:*\n\n`
    message += formatProductList(expiringToday)
    message += '\n\n'
  }

  // Истекает в течение 3 дней
  if (expiringSoon.length > 0) {
    message += `⏰ *Внимание - Истекает в течение 3 дней:*\n\n`
    message += formatProductList(expiringSoon)
    message += '\n\n'
  }

  // Просрочено
  if (expiredProducts.length > 0) {
    message += `❌ *Просрочено:*\n\n`
    message += formatProductList(expiredProducts)
    message += '\n\n'
  }

  message += `📅 *Дата:* ${formatDate()}`

  try {
    const chatId = getChatId()
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    
    // Логируем успешную отправку
    logNotification('daily_alert', message, totalProducts, 'sent')
    
    console.log(`✅ Telegram notification sent: ${totalProducts} products`)
    return { success: true, productsNotified: totalProducts }
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error)
    logNotification('daily_alert', message, totalProducts, 'failed')
    return { success: false, error: error.message }
  }
}

/**
 * Отправка тестового уведомления
 */
export async function sendTestNotification() {
  if (!bot) {
    initTelegramBot()
  }

  if (!bot) {
    console.error('Telegram bot not available')
    return { success: false, error: 'Bot not initialized' }
  }

  const message = `🔔 *FreshTrack Test Notification*

✅ Telegram интеграция работает корректно!

🏨 *Ritz-Carlton Inventory Management*
📅 ${formatDate()}

_Это тестовое сообщение от системы FreshTrack._`

  try {
    const chatId = getChatId()
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    logNotification('test', 'Test notification', 0, 'sent')
    console.log('✅ Test notification sent')
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to send test notification:', error)
    logNotification('test', 'Test notification failed', 0, 'failed')
    return { success: false, error: error.message }
  }
}

/**
 * Отправка кастомного сообщения
 */
export async function sendCustomMessage(text, parseMode = 'Markdown') {
  if (!bot) {
    initTelegramBot()
  }

  if (!bot) {
    return { success: false, error: 'Bot not initialized' }
  }

  try {
    const chatId = getChatId()
    await bot.sendMessage(chatId, text, { parse_mode: parseMode })
    return { success: true }
  } catch (error) {
    console.error('Failed to send custom message:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Отправка уведомления о конкретном продукте
 */
export async function sendProductAlert(product, alertType = 'expiring') {
  if (!bot) {
    initTelegramBot()
  }

  if (!bot) {
    return { success: false, error: 'Bot not initialized' }
  }

  const deptName = departmentNames[product.department] || product.department
  const emoji = alertType === 'expired' ? '❌' : '⚠️'
  const status = alertType === 'expired' ? 'Просрочен' : 'Истекает скоро'

  const message = `${emoji} *FreshTrack Alert*

*${product.name}*
📍 ${deptName}
📦 Количество: ${product.quantity} шт.
📅 Срок годности: ${formatDate(new Date(product.expiry_date))}
⚡ Статус: *${status}*`

  try {
    const chatId = getChatId()
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    return { success: true }
  } catch (error) {
    console.error('Failed to send product alert:', error)
    return { success: false, error: error.message }
  }
}

export default {
  initTelegramBot,
  sendDailyAlert,
  sendTestNotification,
  sendCustomMessage,
  sendProductAlert
}
