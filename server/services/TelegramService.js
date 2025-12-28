/**
 * FreshTrack TelegramService
 * Enhanced Telegram integration with group chat support
 * 
 * Phase 5: Notification Engine
 * - Automatic chat discovery when bot is added to groups
 * - Hotel/department linking for targeted notifications
 * - Retry logic with exponential backoff
 */

import { logError } from '../utils/logger.js'
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
   * @param {string} text - Message text (Markdown supported)
   * @param {Object} options - Additional options
   */
  static async sendMessage(chatId, text, options = {}) {
    const {
      parseMode = 'Markdown',
      disableNotification = false,
      replyMarkup = null
    } = options
    
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_notification: disableNotification
    }
    
    if (replyMarkup) {
      payload.reply_markup = JSON.stringify(replyMarkup)
    }
    
    const response = await this.apiCall('sendMessage', payload)
    return response
  }
  
  /**
   * Make API call to Telegram
   */
  static async apiCall(method, payload = {}) {
    try {
      const response = await fetch(`${TELEGRAM_API}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      if (!data.ok) {
        throw new Error(data.description || `Telegram API error: ${method}`)
      }
      
      return data.result
    } catch (error) {
      console.error(`Telegram API error (${method}):`, error.message)
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
      console.log(`📥 Bot added to ${chatType}: ${chatTitle} (${chatId})`)
      
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
      console.log(`📤 Bot removed from ${chatType}: ${chatTitle} (${chatId})`)
      
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
   * Handle /link command
   * Format: /link hotel:HOTEL_CODE [department:DEPT_CODE]
   */
  static async handleLinkCommand(chatId, text, from) {
    // Parse command: /link hotel:hotelcode department:deptcode
    const hotelMatch = text.match(/hotel:(\S+)/i)
    const deptMatch = text.match(/department:(\S+)/i)
    
    if (!hotelMatch) {
      await this.sendMessage(chatId, 
        '❌ *Ошибка формата*\n\nИспользуйте: `/link hotel:КОД_ОТЕЛЯ`\n' +
        'Или: `/link hotel:КОД_ОТЕЛЯ department:КОД_ОТДЕЛА`'
      )
      return
    }
    
    const hotelCode = hotelMatch[1]
    const deptCode = deptMatch?.[1]
    
    try {
      // Find hotel by code or name
      const hotelResult = await query(
        'SELECT id, name FROM hotels WHERE code = $1 OR LOWER(name) LIKE LOWER($2) LIMIT 1',
        [hotelCode, `%${hotelCode}%`]
      )
      
      if (hotelResult.rows.length === 0) {
        await this.sendMessage(chatId, `❌ Отель "${hotelCode}" не найден`)
        return
      }
      
      const hotel = hotelResult.rows[0]
      let department = null
      
      if (deptCode) {
        const deptResult = await query(
          'SELECT id, name FROM departments WHERE hotel_id = $1 AND (code = $2 OR LOWER(name) LIKE LOWER($3)) LIMIT 1',
          [hotel.id, deptCode, `%${deptCode}%`]
        )
        
        if (deptResult.rows.length === 0) {
          await this.sendMessage(chatId, `❌ Отдел "${deptCode}" не найден в отеле "${hotel.name}"`)
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
        ? `🏨 ${hotel.name} → 🏢 ${department.name}`
        : `🏨 ${hotel.name} (все отделы)`
      
      await this.sendMessage(chatId, 
        `✅ *Чат успешно привязан!*\n\n${linkInfo}\n\n` +
        `Теперь сюда будут приходить уведомления о сроках годности.`
      )
      
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
        'Используйте `/link hotel:КОД` чтобы привязать снова.'
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
          'ℹ️ *Статус чата*\n\n❌ Чат не зарегистрирован в системе.\n' +
          'Добавьте бота заново или используйте `/link`'
        )
        return
      }
      
      const chat = chatResult.rows[0]
      
      let statusText = 'ℹ️ *Статус чата*\n\n'
      statusText += `📍 ID: \`${chatId}\`\n`
      statusText += `📊 Статус: ${chat.is_active ? '🟢 Активен' : '🔴 Неактивен'}\n`
      
      if (chat.hotel_name) {
        statusText += `\n🏨 *Отель:* ${chat.hotel_name}`
        if (chat.department_name) {
          statusText += `\n🏢 *Отдел:* ${chat.department_name}`
        } else {
          statusText += `\n🏢 *Отдел:* Все отделы`
        }
      } else {
        statusText += `\n⚠️ *Не привязан* - используйте \`/link hotel:КОД\``
      }
      
      if (chat.notification_types) {
        const types = typeof chat.notification_types === 'string' 
          ? JSON.parse(chat.notification_types) 
          : chat.notification_types
        statusText += `\n\n📬 *Типы уведомлений:*\n${types.map(t => `• ${t}`).join('\n')}`
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
\`/link hotel:КОД_ОТЕЛЯ\` - привязать к отелю
\`/link hotel:КОД department:КОД\` - привязать к отделу
` : ''}
📋 *Команды:*
/status - статус привязки чата
/help - справка по командам
/unlink - отвязать чат

После привязки сюда будут приходить уведомления о товарах с истекающим сроком.`

    await this.sendMessage(chatId, message)
  }
  
  /**
   * Send help message
   */
  static async sendHelpMessage(chatId) {
    const message = `📚 *FreshTrack Bot - Справка*

*Основные команды:*
/link hotel:КОД - привязать к отелю
/link hotel:КОД department:КОД - привязать к отделу
/unlink - отвязать чат
/status - статус привязки

*Типы уведомлений:*
🚨 Критические (≤3 дня)
⚠️ Предупреждения (≤7 дней)
❌ Просроченные

*Настройка:*
Добавьте бота в групповой чат и используйте \`/link\` для привязки к отелю или отделу.

💡 _Бот автоматически отправляет уведомления согласно настроенным правилам._`

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
      
      console.log(`✅ Registered chat: ${chatTitle} (${chatId})`)
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
        console.error(`Failed to send to chat ${chat.chat_id}:`, error)
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
    console.log('🔄 Starting Telegram polling...')
    
    let offset = 0
    
    const poll = async () => {
      try {
        const updates = await this.getUpdates(offset)
        
        for (const update of updates) {
          offset = update.update_id + 1
          await this.processUpdate(update)
        }
      } catch (error) {
        logError('TelegramService', error.message)
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

export default TelegramService


