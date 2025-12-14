/**
 * FreshTrack Telegram Service
 * Enterprise Telegram Bot API Integration for notifications and commands
 */

import TelegramBot from 'node-telegram-bot-api'
import { logNotification, getActiveProducts, getAllProducts, getNotificationLogs, getStats, getSetting, getAllDepartments } from '../db/database.js'

// Функции для получения настроек (сначала БД, потом .env)
function getBotToken() {
  const dbToken = getSetting('TELEGRAM_BOT_TOKEN')
  return dbToken || process.env.TELEGRAM_BOT_TOKEN
}

function getChatId() {
  const dbChatId = getSetting('TELEGRAM_CHAT_ID')
  return dbChatId || process.env.TELEGRAM_CHAT_ID
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
 * Получение названия отдела по ID
 */
function getDepartmentName(departmentId) {
  try {
    const departments = getAllDepartments ? getAllDepartments() : []
    const dept = departments.find(d => d.id === departmentId || d.code === departmentId)
    return dept?.name || departmentId
  } catch {
    return departmentId
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
    const welcomeMessage = `👋 *Welcome to FreshTrack Bot!*

📦 Enterprise Inventory Management System

*Available commands:*

/status - Current system status
/report - Quick inventory report
/alerts - Items requiring attention
/departments - Department statistics
/help - Help with commands

📱 You will receive notifications about products with expiring dates.`

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' })
  })

  // /help - Справка по командам
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id
    const helpMessage = `📚 *FreshTrack Commands Help*

*Main commands:*
/status - Overall system statistics
/report - Summary report for all products
/alerts - Products requiring attention
/departments - Department statistics

*Additional commands:*
/today - Products expiring today
/week - Products expiring this week
/expired - Expired products

*Information:*
/info - About FreshTrack system
/feedback - Send feedback

💡 _Notifications are sent automatically at the scheduled time._`

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' })
  })

  // /status - Статус системы
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const stats = calculateStats(products)
      
      const statusMessage = `📊 *FreshTrack System Status*

📅 ${formatDate()}

*Statistics:*
📦 Total batches: ${stats.total}
✅ Good: ${stats.good}
⚠️ Warning: ${stats.warning}
❗ Critical: ${stats.critical}
❌ Expired: ${stats.expired}

*Health Score:* ${stats.healthScore}%

${stats.healthScore >= 80 ? '🟢' : stats.healthScore >= 50 ? '🟡' : '🔴'} Status: ${
  stats.healthScore >= 80 ? 'Excellent' : 
  stats.healthScore >= 50 ? 'Needs attention' : 
  'Critical'
}`

      bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error retrieving status')
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
      
      let reportMessage = `📋 *FreshTrack Summary Report*

📅 ${formatDate()} | ${formatTime()}

*═══ Overall Statistics ═══*
📦 Total batches: ${stats.total}
✅ Good: ${stats.good} (${Math.round(stats.good/stats.total*100) || 0}%)
⚠️ Warning: ${stats.warning} (${Math.round(stats.warning/stats.total*100) || 0}%)
❗ Critical: ${stats.critical} (${Math.round(stats.critical/stats.total*100) || 0}%)
❌ Expired: ${stats.expired} (${Math.round(stats.expired/stats.total*100) || 0}%)

*═══ By Department ═══*`

      for (const [deptId, deptStats] of Object.entries(departments)) {
        const deptName = getDepartmentName(deptId)
        const healthEmoji = deptStats.healthScore >= 80 ? '🟢' : deptStats.healthScore >= 50 ? '🟡' : '🔴'
        
        reportMessage += `

${healthEmoji} *${deptName}*
   Batches: ${deptStats.total} | Issues: ${deptStats.critical + deptStats.expired}`
      }

      reportMessage += `

_Report generated automatically_`

      bot.sendMessage(chatId, reportMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error generating report')
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
        bot.sendMessage(chatId, `✅ *Great news!*

No products require immediate attention.
All expiration dates are within normal range.

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let alertMessage = `🚨 *Products Requiring Attention*

📅 ${formatDate()}

`
      
      alertProducts.forEach((p, i) => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        const emoji = daysLeft < 0 ? '❌' : daysLeft === 0 ? '⚠️' : '⏰'
        const deptName = getDepartmentName(p.department)
        
        alertMessage += `${emoji} *${p.name}*
   📍 ${deptName} | ${daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Today!' : `${daysLeft} days`}

`
      })

      const totalAlerts = products.filter(p => {
        const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysLeft <= 7
      }).length

      if (totalAlerts > 15) {
        alertMessage += `_...and ${totalAlerts - 15} more products_`
      }

      bot.sendMessage(chatId, alertMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error retrieving list')
      console.error('Alerts command error:', error)
    }
  })

  // /departments - Статистика по отделам
  bot.onText(/\/departments/, async (msg) => {
    const chatId = msg.chat.id
    
    try {
      const products = getActiveProducts()
      const departments = calculateDepartmentStats(products)
      
      let deptMessage = `🏢 *Department Statistics*

📅 ${formatDate()}

`

      for (const [deptId, stats] of Object.entries(departments)) {
        const deptName = getDepartmentName(deptId)
        const healthEmoji = stats.healthScore >= 80 ? '🟢' : stats.healthScore >= 50 ? '🟡' : '🔴'
        const progressBar = generateProgressBar(stats.healthScore)
        
        deptMessage += `*${deptName}*
${healthEmoji} ${progressBar} ${stats.healthScore}%
📦 Batches: ${stats.total}
✅ Good: ${stats.good} | ⚠️ Warning: ${stats.warning}
❗ Critical: ${stats.critical} | ❌ Expired: ${stats.expired}

`
      }

      bot.sendMessage(chatId, deptMessage, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error retrieving data')
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
        bot.sendMessage(chatId, `✅ *No products expiring today*

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let message = `⚠️ *Expiring TODAY*

📅 ${formatDate()}

`
      
      todayProducts.forEach(p => {
        const deptName = getDepartmentName(p.department)
        message += `• *${p.name}*
   📍 ${deptName} | 📦 ${p.quantity} pcs.

`
      })

      message += `_Total: ${todayProducts.length} products_`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error')
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
        bot.sendMessage(chatId, `✅ *No expired products!*

Great work team! 🎉

📅 ${formatDate()}`, { parse_mode: 'Markdown' })
        return
      }

      let message = `❌ *Expired Products*

📅 ${formatDate()}

`
      
      expiredProducts.slice(0, 10).forEach(p => {
        const deptName = getDepartmentName(p.department)
        const daysExpired = Math.abs(Math.ceil((new Date(p.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)))
        
        message += `• *${p.name}*
   📍 ${deptName} | ⏰ ${daysExpired} days ago

`
      })

      if (expiredProducts.length > 10) {
        message += `_...and ${expiredProducts.length - 10} more products_

`
      }

      message += `⚠️ _Immediate removal required!_`

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      bot.sendMessage(chatId, '❌ Error')
      console.error('Expired command error:', error)
    }
  })

  // /info - О системе
  bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id
    const infoMessage = `ℹ️ *About FreshTrack*

*FreshTrack* — Enterprise inventory and expiration date management system for hospitality and food service industries.

📦 *Version:* 2.0.0 Enterprise
🌍 *Type:* Multi-property SaaS

*Features:*
• Expiration date tracking
• Automatic notifications
• Department analytics
• Report export
• Multi-property support
• Role-based access control

📧 Support: support@freshtrack.io`

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
 * Форматирование списка продуктов для сообщения
 */
function formatProductList(products) {
  if (!products || products.length === 0) return ''
  
  return products.map(p => {
    const deptName = getDepartmentName(p.department)
    return `• ${p.name} (${deptName}) - ${p.quantity} pcs.`
  }).join('\n')
}

/**
 * Форматирование даты
 */
function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Форматирование времени
 */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
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
  let message = `🚨 *FreshTrack Daily Alert*\n\n`

  // Истекает сегодня
  if (expiringToday.length > 0) {
    message += `⚠️ *URGENT - Expiring today:*\n\n`
    message += formatProductList(expiringToday)
    message += '\n\n'
  }

  // Истекает в течение 3 дней
  if (expiringSoon.length > 0) {
    message += `⏰ *Attention - Expiring within 3 days:*\n\n`
    message += formatProductList(expiringSoon)
    message += '\n\n'
  }

  // Просрочено
  if (expiredProducts.length > 0) {
    message += `❌ *Expired:*\n\n`
    message += formatProductList(expiredProducts)
    message += '\n\n'
  }

  message += `📅 *Date:* ${formatDate()}`

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

✅ Telegram integration is working correctly!

📦 *Enterprise Inventory Management*
📅 ${formatDate()}

_This is a test message from FreshTrack system._`

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

  const deptName = getDepartmentName(product.department)
  const emoji = alertType === 'expired' ? '❌' : '⚠️'
  const status = alertType === 'expired' ? 'Expired' : 'Expiring soon'

  const message = `${emoji} *FreshTrack Alert*

*${product.name}*
📍 ${deptName}
📦 Quantity: ${product.quantity} pcs.
📅 Expiry date: ${formatDate(new Date(product.expiry_date))}
⚡ Status: *${status}*`

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
