/**
 * FreshTrack TelegramService
 * Enhanced Telegram integration with group chat support
 * 
 * Phase 5: Notification Engine
 * - Automatic chat discovery when bot is added to groups
 * - Hotel/department linking for targeted notifications
 * - Retry logic with exponential backoff
 */

import { logError, logInfo, logDebug } from '../utils/logger.js'
import { query } from '../db/database.js'

const BOT_TOKEN = '7792952266:AAHWSDqKWBkFOtvmmjOlre_pR84bBnV9I4Y'
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

/**
 * Telegram message priority icons
 */
export const PriorityIcons = {
  URGENT: '🚨',
  CRITICAL: '🔴',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  SUCCESS: '✅'
}

/**
 * TelegramService - Enhanced Telegram Bot integration
 */
export class TelegramService {

  /**
   * Send message to a specific chat
   * @param {number|string} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {Object} options - Additional options
   */
  static async sendMessage(chatId, text, options = {}) {
    const {
      disableNotification = false,
      replyMarkup = null
    } = options

    const payload = {
      chat_id: chatId,
      text,
      disable_notification: disableNotification
    }

    if (replyMarkup) {
      payload.reply_markup = JSON.stringify(replyMarkup)
    }

    const response = await this.apiCall('sendMessage', payload)
    return response
  }

  /**
   * Make API call to Telegram with timeout and retry
   */
  static async apiCall(method, payload = {}, retries = 2) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15 sec timeout

    try {
      const response = await fetch(`${TELEGRAM_API}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeout)
      const data = await response.json()

      if (!data.ok) {
        throw new Error(data.description || `Telegram API error: ${method}`)
      }

      return data.result
    } catch (error) {
      clearTimeout(timeout)

      // Не логируем каждую ошибку polling - слишком много спама
      if (method !== 'getUpdates') {
        logError('TelegramService', error.message || error)
      }

      // Retry on network errors (not on Telegram API errors)
      if (retries > 0 && (error.name === 'AbortError' || error.cause?.code === 'ECONNRESET' || error.message === 'fetch failed')) {
        await new Promise(r => setTimeout(r, 2000)) // Wait 2 sec before retry
        return this.apiCall(method, payload, retries - 1)
      }

      throw error
    }
  }

  /**
   * Get bot info
   */
  static async getMe() {
    return this.apiCall('getMe')
  }

  /**
   * Get updates (for polling mode)
   */
  static async getUpdates(offset = 0, timeout = 30) {
    return this.apiCall('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message', 'my_chat_member', 'callback_query']
    })
  }

  /**
   * Process incoming update
   * Handles: new chat member (bot added), chat member left (bot removed), messages
   */
  static async processUpdate(update) {
    // Bot added/removed from chat
    if (update.my_chat_member) {
      return this.handleChatMemberUpdate(update.my_chat_member)
    }

    // Regular message with /link command
    if (update.message) {
      return this.handleMessage(update.message)
    }

    // Callback query (inline button pressed)
    if (update.callback_query) {
      return this.handleCallback(update.callback_query)
    }
  }

  /**
   * Handle bot being added/removed from chat
   */
  static async handleChatMemberUpdate(memberUpdate) {
    const { chat, new_chat_member, from } = memberUpdate

    // Check if it's about the bot itself
    const botInfo = await this.getMe()
    if (new_chat_member.user.id !== botInfo.id) return

    const chatId = chat.id
    const chatType = chat.type // 'private', 'group', 'supergroup', 'channel'
    const chatTitle = chat.title || chat.first_name || 'Private Chat'

    if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
      // Bot was added to chat
      logInfo('TelegramService', `📥 Bot added to ${chatType}: ${chatTitle} (${chatId})`)

      await this.registerChat({
        chatId,
        chatType,
        chatTitle,
        addedBy: from.id
      })

      // Send welcome message with setup instructions
      await this.sendWelcomeMessage(chatId, chatType)

    } else if (new_chat_member.status === 'left' || new_chat_member.status === 'kicked') {
      // Bot was removed from chat
      logInfo('TelegramService', `📤 Bot removed from ${chatType}: ${chatTitle} (${chatId})`)

      await this.markChatInactive(chatId)
    }
  }

  /**
   * Handle regular messages (commands)
   */
  static async handleMessage(message) {
    const { chat, text, from } = message
    if (!text) return

    const chatId = chat.id

    // /link command - link chat to hotel/department
    if (text.startsWith('/link ')) {
      return this.handleLinkCommand(chatId, text, from)
    }

    // /unlink command - remove chat linking
    if (text === '/unlink') {
      return this.handleUnlinkCommand(chatId, from)
    }

    // /status command - show chat status
    if (text === '/status') {
      return this.handleStatusCommand(chatId)
    }

    // /help command
    if (text === '/help' || text === '/start') {
      return this.sendHelpMessage(chatId)
    }
  }

  /**
   * Handle /notify command
   * Format: /notify on|off
   */
  static async handleNotifyCommand(chatId, text) {
    const match = text.match(/\/notify\s+(on|off)/i)

    if (!match) {
      await this.sendMessage(chatId,
        '❓ *Использование:*\n`/notify on` - включить уведомления\n`/notify off` - выключить уведомления'
      )
      return
    }

    const enabled = match[1].toLowerCase() === 'on'

    try {
      await query(
        'UPDATE telegram_chats SET is_active = $1 WHERE chat_id = $2',
        [enabled, chatId]
      )

      await this.sendMessage(chatId,
        enabled
          ? '✅ *Уведомления включены*\n\nВы будете получать уведомления о сроках годности.'
          : '🔇 *Уведомления отключены*\n\nИспользуйте `/notify on` чтобы включить снова.'
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Handle /filter command
   * Format: /filter critical|warning|expired|all
   */
  static async handleFilterCommand(chatId, text) {
    const validTypes = ['critical', 'warning', 'expired', 'all']
    const match = text.match(/\/filter\s+(\S+)/i)

    if (!match) {
      await this.sendMessage(chatId,
        '❓ *Использование:*\n' +
        '`/filter critical` - только критичные (≤3 дня)\n' +
        '`/filter warning` - предупреждения (≤7 дней)\n' +
        '`/filter expired` - только просроченные\n' +
        '`/filter all` - все уведомления'
      )
      return
    }

    const filterType = match[1].toLowerCase()

    if (!validTypes.includes(filterType)) {
      await this.sendMessage(chatId, `❌ Неизвестный тип: ${filterType}\n\nДопустимые: ${validTypes.join(', ')}`)
      return
    }

    try {
      const notificationTypes = filterType === 'all'
        ? ['critical', 'warning', 'expired']
        : [filterType]

      await query(
        'UPDATE telegram_chats SET notification_types = $1 WHERE chat_id = $2',
        [JSON.stringify(notificationTypes), chatId]
      )

      const typeLabels = {
        critical: '🚨 Критичные',
        warning: '⚠️ Предупреждения',
        expired: '❌ Просроченные',
        all: '📋 Все типы'
      }

      await this.sendMessage(chatId,
        `✅ *Фильтр обновлён*\n\nТеперь вы получаете: ${typeLabels[filterType]}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Handle /silent command
   * Format: /silent on|off
   */
  static async handleSilentCommand(chatId, text) {
    const match = text.match(/\/silent\s+(on|off)/i)

    if (!match) {
      await this.sendMessage(chatId,
        '❓ *Использование:*\n`/silent on` - беззвучные уведомления\n`/silent off` - со звуком'
      )
      return
    }

    const silent = match[1].toLowerCase() === 'on'

    try {
      await query(
        'UPDATE telegram_chats SET silent_mode = $1 WHERE chat_id = $2',
        [silent, chatId]
      )

      await this.sendMessage(chatId,
        silent
          ? '🔕 *Беззвучный режим включён*\n\nУведомления будут приходить без звука.'
          : '🔔 *Беззвучный режим выключен*\n\nУведомления будут со звуком.'
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Handle /link command
   * Format: /link MARSHA_CODE:DEPARTMENT_NAME or /link MARSHA_CODE (all departments)
   * Examples: /link TSEXR:Бар or /link TSEXR
   */
  static async handleLinkCommand(chatId, text, from) {
    // Parse command: /link MARSHA:Департамент or /link MARSHA
    // Формат: КОД_ОТЕЛЯ:Название_департамента
    const linkMatch = text.match(/\/link\s+([A-Za-z0-9_-]+)(?::(.+))?$/i)

    if (!linkMatch) {
      await this.sendMessage(chatId,
        '❌ *Ошибка формата*\n\n' +
        '*Использование:*\n' +
        '`/link КОД_ОТЕЛЯ` — все уведомления отеля\n' +
        '`/link КОД_ОТЕЛЯ:Департамент` — только один отдел\n\n' +
        '_Примеры:_\n' +
        '`/link TSEXR` — весь отель\n' +
        '`/link TSEXR:Bar` — только Bar\n' +
        '`/link RITZ:Honor Bar`\n\n' +
        '💡 MARSHA код — в настройках FreshTrack'
      )
      return
    }

    const marshaCode = linkMatch[1].trim().toUpperCase()
    const deptName = linkMatch[2]?.trim()

    try {
      // Find hotel by MARSHA code (exact match, case-insensitive)
      const hotelResult = await query(
        `SELECT id, name, marsha_code FROM hotels 
         WHERE UPPER(marsha_code) = $1
         LIMIT 1`,
        [marshaCode]
      )

      if (hotelResult.rows.length === 0) {
        await this.sendMessage(chatId,
          `❌ *Отель не найден*\n\n` +
          `Код \`${marshaCode}\` не найден.\n\n` +
          `💡 Проверьте MARSHA код в:\n` +
          `Настройки → Организация`
        )
        return
      }

      const hotel = hotelResult.rows[0]
      let department = null

      if (deptName) {
        const deptResult = await query(
          `SELECT id, name FROM departments 
           WHERE hotel_id = $1 
           AND (LOWER(name) LIKE LOWER($2) OR LOWER(name) = LOWER($3))
           LIMIT 1`,
          [hotel.id, `%${deptName}%`, deptName]
        )

        if (deptResult.rows.length === 0) {
          // Show available departments
          const availableDepts = await query(
            'SELECT name FROM departments WHERE hotel_id = $1',
            [hotel.id]
          )
          const deptList = availableDepts.rows.map(d => `• ${d.name}`).join('\n')

          await this.sendMessage(chatId,
            `❌ *Департамент "${deptName}" не найден*\n\n` +
            `*Доступные в ${hotel.name}:*\n${deptList || '_Нет департаментов_'}\n\n` +
            `_Попробуйте:_ \`/link ${marshaCode}:Название\``
          )
          return
        }

        department = deptResult.rows[0]
      }

      // Update or insert chat record
      await query(`
        INSERT INTO telegram_chats (chat_id, chat_type, chat_title, hotel_id, department_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (chat_id) DO UPDATE SET
          hotel_id = EXCLUDED.hotel_id,
          department_id = EXCLUDED.department_id,
          is_active = true,
          bot_removed = false
      `, [
        chatId,
        'group',
        'Linked Chat',
        hotel.id,
        department?.id || null
      ])

      const linkInfo = department
        ? `🏨 *${hotel.name}*\n🏢 *${department.name}*`
        : `🏨 *${hotel.name}* (все департаменты)`

      await this.sendMessage(chatId,
        `✅ *Чат успешно привязан!*\n\n${linkInfo}\n\n` +
        `Теперь сюда будут приходить уведомления о сроках годности.\n\n` +
        `Используйте \`/status\` для проверки настроек.`
      )

      logInfo('TelegramService', `✅ Chat ${chatId} linked to hotel ${hotel.name}${department ? ` / ${department.name}` : ''}`)

    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Handle /unlink command
   */
  static async handleUnlinkCommand(chatId, from) {
    try {
      await query(
        'UPDATE telegram_chats SET hotel_id = NULL, department_id = NULL WHERE chat_id = $1',
        [chatId]
      )

      await this.sendMessage(chatId,
        '✅ *Чат отвязан*\n\nУведомления больше не будут приходить в этот чат.\n' +
        'Используйте `/link MARSHA:КОД` чтобы привязать снова.'
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Handle /status command
   */
  static async handleStatusCommand(chatId) {
    try {
      const chatResult = await query(
        `SELECT tc.*, h.name as hotel_name, d.name as department_name
         FROM telegram_chats tc
         LEFT JOIN hotels h ON tc.hotel_id = h.id
         LEFT JOIN departments d ON tc.department_id = d.id
         WHERE tc.chat_id = $1`,
        [chatId]
      )

      if (chatResult.rows.length === 0) {
        await this.sendMessage(chatId,
          'ℹ️ Статус чата\n\n❌ Чат не зарегистрирован в системе.\n' +
          'Добавьте бота заново или используйте /link'
        )
        return
      }

      const chat = chatResult.rows[0]

      let statusText = 'ℹ️ Статус чата\n\n'
      statusText += `📍 ID: ${chatId}\n`
      statusText += `📊 Статус: ${chat.is_active ? '🟢 Активен' : '🔴 Неактивен'}\n`

      if (chat.hotel_name) {
        statusText += `\n🏨 Отель: ${chat.hotel_name}`
        if (chat.department_name) {
          statusText += `\n🏢 Отдел: ${chat.department_name}`
        } else {
          statusText += `\n🏢 Отдел: Все отделы`
        }
      } else {
        statusText += `\n⚠️ Не привязан — используйте /link MARSHA:Отдел`
      }

      if (chat.notification_types) {
        const types = typeof chat.notification_types === 'string'
          ? JSON.parse(chat.notification_types)
          : chat.notification_types
        statusText += `\n\n📬 Типы уведомлений:\n${types.map(t => `• ${t}`).join('\n')}`
      }

      await this.sendMessage(chatId, statusText)

    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(chatId, `❌ Ошибка: ${error.message}`)
    }
  }

  /**
   * Send welcome message when bot is added to chat
   */
  static async sendWelcomeMessage(chatId, chatType) {
    const message = `👋 *Добро пожаловать в FreshTrack Bot!*

Я помогу отслеживать сроки годности продуктов.

${chatType !== 'private' ? `
📌 *Для настройки уведомлений:*
\`/link КОД\` — привязать к отелю
\`/link КОД:Департамент\` — привязать к отделу

_Пример: /link TSEXR:Бар_
` : ''}
📋 *Команды:*
/status — статус привязки чата
/help — справка по командам
/unlink — отвязать чат

После привязки сюда будут приходить уведомления о товарах с истекающим сроком.`

    await this.sendMessage(chatId, message)
  }

  /**
   * Send help message
   */
  static async sendHelpMessage(chatId) {
    const message = `📚 FreshTrack Bot — Справка

Привязка чата:
/link КОД — привязать к отелю
/link КОД:Департамент — привязать к отделу
/unlink — отвязать чат
/status — статус привязки

Примеры:
/link TSEXR — весь отель
/link TSEXR:Бар — только Бар

💡 MARSHA код — в Настройки → Организация
📋 Настройки уведомлений — на сайте FreshTrack`

    await this.sendMessage(chatId, message)
  }

  /**
   * Register new chat in database
   */
  static async registerChat({ chatId, chatType, chatTitle, addedBy }) {
    try {
      await query(`
        INSERT INTO telegram_chats (chat_id, chat_type, chat_title, is_active, added_at)
        VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (chat_id) DO UPDATE SET
          chat_type = EXCLUDED.chat_type,
          chat_title = EXCLUDED.chat_title,
          is_active = true,
          bot_removed = false
      `, [chatId, chatType, chatTitle])

      logInfo('TelegramService', `✅ Registered chat: ${chatTitle} (${chatId})`)
    } catch (error) {
      logError('TelegramService', error)
    }
  }

  /**
   * Mark chat as inactive (bot was removed)
   */
  static async markChatInactive(chatId) {
    try {
      await query(
        'UPDATE telegram_chats SET is_active = false, bot_removed = true WHERE chat_id = $1',
        [chatId]
      )
    } catch (error) {
      logError('TelegramService', error)
    }
  }

  /**
   * Get all active chats for a hotel/department
   */
  static async getChatsForContext(hotelId, departmentId = null) {
    try {
      let queryText = `
        SELECT * FROM telegram_chats 
        WHERE is_active = true 
          AND bot_removed = false
          AND hotel_id = $1
      `
      const params = [hotelId]

      if (departmentId) {
        // Get chats for specific department OR hotel-wide chats
        queryText += ' AND (department_id = $2 OR department_id IS NULL)'
        params.push(departmentId)
      }

      const result = await query(queryText, params)
      return result.rows
    } catch (error) {
      logError('TelegramService', error)
      return []
    }
  }

  /**
   * Send notification to all relevant chats for a batch
   * Used by NotificationService
   */
  static async sendBatchNotification(batch, notificationType, hotelId, departmentId) {
    const chats = await this.getChatsForContext(hotelId, departmentId)

    if (chats.length === 0) {
      return { success: false, error: 'No linked Telegram chats found' }
    }

    const results = []

    for (const chat of chats) {
      try {
        const message = this.formatBatchNotification(batch, notificationType)
        const result = await this.sendMessage(chat.chat_id, message, {
          disableNotification: chat.silent_mode
        })

        results.push({
          chatId: chat.chat_id,
          success: true,
          messageId: result.message_id
        })

        // Update last_message_at
        await query(
          'UPDATE telegram_chats SET last_message_at = NOW() WHERE chat_id = $1',
          [chat.chat_id]
        )

      } catch (error) {
        logError('TelegramService', error)
        results.push({
          chatId: chat.chat_id,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    return {
      success: successCount > 0,
      sentTo: successCount,
      totalChats: chats.length,
      results
    }
  }

  /**
   * Format batch notification message
   */
  static formatBatchNotification(batch, type) {
    const icon = type === 'expired' ? '❌'
      : type === 'critical' ? '🚨'
        : type === 'warning' ? '⚠️'
          : 'ℹ️'

    const statusText = type === 'expired' ? 'ПРОСРОЧЕНО'
      : type === 'critical' ? 'КРИТИЧНО'
        : type === 'warning' ? 'ВНИМАНИЕ'
          : 'Информация'

    const daysText = batch.daysLeft === 0 ? 'сегодня'
      : batch.daysLeft === 1 ? 'завтра'
        : batch.daysLeft < 0 ? `${Math.abs(batch.daysLeft)} дн. назад`
          : `через ${batch.daysLeft} дн.`

    return `${icon} *${statusText}*

📦 *${batch.productName || batch.product_name}*
📊 Количество: ${batch.quantity} ${batch.unit || 'шт'}
📅 Срок: ${batch.expiryDate || batch.expiry_date}
⏰ Истекает: ${daysText}

🏢 ${batch.departmentName || batch.department_name || 'Отдел не указан'}`
  }

  /**
   * Start polling for updates (for development/testing)
   */
  static async startPolling(intervalMs = 1000) {
    logInfo('TelegramService', '🔄 Starting Telegram polling...')

    let offset = 0
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 5

    const poll = async () => {
      try {
        const updates = await this.getUpdates(offset)
        consecutiveErrors = 0 // Reset on success

        for (const update of updates) {
          offset = update.update_id + 1
          await this.processUpdate(update)
        }
      } catch (error) {
        consecutiveErrors++

        // Логируем только если это не просто сетевая ошибка или первая в серии
        if (consecutiveErrors === 1 || consecutiveErrors % 10 === 0) {
          logError('TelegramService', `Polling error (${consecutiveErrors}x): ${error.message}`)
        }

        // Увеличиваем интервал при множественных ошибках
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          const backoffMs = Math.min(30000, intervalMs * consecutiveErrors) // Max 30 sec
          setTimeout(poll, backoffMs)
          return
        }
      }

      setTimeout(poll, intervalMs)
    }

    poll()
  }

  /**
   * Send message to user by their user_id (fallback to user's telegram_chat_id)
   */
  static async sendToUser(userId, message, options = {}) {
    try {
      const userResult = await query(
        'SELECT telegram_chat_id FROM users WHERE id = $1',
        [userId]
      )

      const chatId = userResult.rows[0]?.telegram_chat_id
      if (!chatId) {
        return { success: false, error: 'User has no Telegram chat ID linked' }
      }

      const result = await this.sendMessage(chatId, message, options)
      return { success: true, messageId: result.message_id }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Legacy compatibility functions (for backward compatibility)
// These wrap TelegramService methods for older code
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize Telegram bot (legacy wrapper)
 * @deprecated Use TelegramService.startPolling() instead
 */
export function initTelegramBot(enablePolling = false) {
  if (enablePolling) {
    TelegramService.startPolling(2000)
  }
  logInfo('TelegramService', '✅ Telegram bot initialized (legacy wrapper)')
  return true
}

/**
 * Send custom message to default chat (legacy wrapper)
 * @deprecated Use TelegramService.sendMessage() instead
 */
export async function sendCustomMessage(text, parseMode = 'Markdown') {
  try {
    // Try to get default chat from settings or env
    const defaultChatId = process.env.TELEGRAM_CHAT_ID
    if (!defaultChatId) {
      return { success: false, error: 'No default TELEGRAM_CHAT_ID configured' }
    }

    await TelegramService.sendMessage(defaultChatId, text, { parseMode })
    return { success: true }
  } catch (error) {
    logError('TelegramService', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send daily alert notification (legacy wrapper)
 * @deprecated Use NotificationEngine for multi-hotel notifications
 */
export async function sendDailyAlert({ expiredProducts = [], expiringToday = [], expiringSoon = [] }) {
  const totalProducts = expiredProducts.length + expiringToday.length + expiringSoon.length

  if (totalProducts === 0) {
    return { success: true, message: 'No products need attention' }
  }

  let message = `🚨 *FreshTrack Daily Alert*\n\n`

  if (expiringToday.length > 0) {
    message += `⚠️ *URGENT - Expiring today:*\n`
    expiringToday.slice(0, 10).forEach(p => {
      message += `• ${p.name} - ${p.quantity} шт\n`
    })
    message += '\n'
  }

  if (expiringSoon.length > 0) {
    message += `⏰ *Expiring within 3 days:*\n`
    expiringSoon.slice(0, 10).forEach(p => {
      message += `• ${p.name} - ${p.quantity} шт\n`
    })
    message += '\n'
  }

  if (expiredProducts.length > 0) {
    message += `❌ *Expired:*\n`
    expiredProducts.slice(0, 10).forEach(p => {
      message += `• ${p.name} - ${p.quantity} шт\n`
    })
    message += '\n'
  }

  message += `📅 ${new Date().toLocaleDateString('ru-RU')}`

  return sendCustomMessage(message)
}

/**
 * Send test notification (legacy wrapper)
 */
export async function sendTestNotification() {
  const message = `🔔 *FreshTrack Test Notification*

✅ Telegram integration is working correctly!

📦 *Enterprise Inventory Management*
📅 ${new Date().toLocaleDateString('ru-RU')}

_This is a test message from FreshTrack system._`

  return sendCustomMessage(message)
}

export default TelegramService


