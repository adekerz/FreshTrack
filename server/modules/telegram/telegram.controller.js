/**
 * Telegram Controller
 * Multi-hotel Telegram chat management
 * 
 * @module modules/telegram
 */

import express from 'express'
import { authMiddleware, requirePermission } from '../../middleware/auth.js'
import { TelegramService } from '../../services/TelegramService.js'
import { query } from '../../db/postgres.js'
import { logInfo, logError } from '../../utils/logger.js'

const router = express.Router()

// ═══════════════════════════════════════════════════════════════
// GET /api/telegram/status - Get bot status and info
// ═══════════════════════════════════════════════════════════════
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const botInfo = await TelegramService.getMe()
    
    res.json({
      success: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        name: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups
      },
      botLink: `https://t.me/${botInfo.username}`
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to connect to Telegram bot' 
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/telegram/chats - Get all registered chats for user's context
// ═══════════════════════════════════════════════════════════════
router.get('/chats', authMiddleware, async (req, res) => {
  try {
    const { hotel_id, department_id, role } = req.user
    
    let queryText = `
      SELECT 
        tc.*,
        h.name as hotel_name,
        h.marsha_code as hotel_code,
        d.name as department_name
      FROM telegram_chats tc
      LEFT JOIN hotels h ON tc.hotel_id = h.id
      LEFT JOIN departments d ON tc.department_id = d.id
      WHERE 1=1
    `
    const params = []
    
    // Filter by user's context
    if (role !== 'SUPER_ADMIN') {
      if (hotel_id) {
        params.push(hotel_id)
        queryText += ` AND tc.hotel_id = $${params.length}`
      }
      if (department_id) {
        params.push(department_id)
        queryText += ` AND (tc.department_id = $${params.length} OR tc.department_id IS NULL)`
      }
    }
    
    queryText += ' ORDER BY tc.added_at DESC'
    
    const result = await query(queryText, params)
    
    res.json({
      success: true,
      chats: result.rows
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/telegram/chats - Manually register a chat
// ═══════════════════════════════════════════════════════════════
router.post('/chats', authMiddleware, requirePermission('settings', 'write'), async (req, res) => {
  try {
    const { chatId, chatTitle, hotelId, departmentId } = req.body
    const { id: userId } = req.user
    
    if (!chatId) {
      return res.status(400).json({ 
        success: false, 
        error: 'chatId is required' 
      })
    }
    
    // Verify the chat exists and bot has access
    try {
      await TelegramService.sendMessage(chatId, '✅ Чат успешно привязан к FreshTrack!')
    } catch (telegramError) {
      return res.status(400).json({
        success: false,
        error: `Cannot send message to chat. Make sure bot @adekerzbot is added to the chat. Error: ${telegramError.message}`
      })
    }
    
    // Insert or update chat
    await query(`
      INSERT INTO telegram_chats (chat_id, chat_type, chat_title, hotel_id, department_id, is_active, added_by)
      VALUES ($1, 'group', $2, $3, $4, true, $5)
      ON CONFLICT (chat_id) DO UPDATE SET
        chat_title = COALESCE(EXCLUDED.chat_title, telegram_chats.chat_title),
        hotel_id = EXCLUDED.hotel_id,
        department_id = EXCLUDED.department_id,
        is_active = true,
        bot_removed = false
    `, [chatId, chatTitle || 'Manual Link', hotelId, departmentId || null, userId])
    
    logInfo('TelegramController', `Chat ${chatId} linked to hotel ${hotelId}`)
    
    res.json({
      success: true,
      message: 'Chat registered successfully'
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/telegram/chats/:chatId - Unlink a chat
// ═══════════════════════════════════════════════════════════════
router.delete('/chats/:chatId', authMiddleware, requirePermission('settings', 'write'), async (req, res) => {
  try {
    const { chatId } = req.params
    
    await query(
      'UPDATE telegram_chats SET is_active = false, hotel_id = NULL, department_id = NULL WHERE chat_id = $1',
      [chatId]
    )
    
    res.json({
      success: true,
      message: 'Chat unlinked successfully'
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/telegram/test - Send test notification
// ═══════════════════════════════════════════════════════════════
router.post('/test', authMiddleware, requirePermission('settings', 'write'), async (req, res) => {
  try {
    const { chatId } = req.body
    const { hotel_id } = req.user
    
    let targetChats = []
    
    if (chatId) {
      // Send to specific chat
      targetChats = [{ chat_id: chatId }]
    } else if (hotel_id) {
      // Send to all hotel chats
      targetChats = await TelegramService.getChatsForContext(hotel_id)
    }
    
    if (targetChats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No linked Telegram chats found'
      })
    }
    
    const testMessage = `🧪 *Тестовое уведомление*

Это тестовое сообщение от FreshTrack.
Если вы видите это — уведомления настроены правильно!

📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`
    
    const results = []
    for (const chat of targetChats) {
      try {
        await TelegramService.sendMessage(chat.chat_id, testMessage)
        results.push({ chatId: chat.chat_id, success: true })
      } catch (error) {
        results.push({ chatId: chat.chat_id, success: false, error: error.message })
      }
    }
    
    res.json({
      success: true,
      sentTo: results.filter(r => r.success).length,
      total: targetChats.length,
      results
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/telegram/setup-instructions - Get setup guide
// ═══════════════════════════════════════════════════════════════
router.get('/setup-instructions', authMiddleware, async (req, res) => {
  try {
    const botInfo = await TelegramService.getMe()
    
    res.json({
      success: true,
      botUsername: `@${botInfo.username}`,
      botLink: `https://t.me/${botInfo.username}`,
      instructions: {
        ru: [
          `1. Добавьте бота @${botInfo.username} в нужный групповой чат`,
          '2. Дайте боту права администратора (опционально, для чтения всех сообщений)',
          '3. Отправьте в чат команду: /link КОД_ОТЕЛЯ',
          '4. Для привязки к отделу: /link КОД:Название_отдела',
          '5. Проверьте статус: /status'
        ],
        commands: {
          '/link КОД': 'Привязать чат к отелю',
          '/link КОД:Департамент': 'Привязать к отделу',
          '/unlink': 'Отвязать чат',
          '/status': 'Показать текущую привязку',
          '/notify on|off': 'Включить/выключить уведомления',
          '/filter critical|warning|expired': 'Фильтр типов уведомлений',
          '/help': 'Справка по командам'
        }
      }
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
