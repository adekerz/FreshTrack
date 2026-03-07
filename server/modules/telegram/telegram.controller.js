/**
 * Telegram Controller
 * Multi-hotel Telegram chat management
 *
 * @module modules/telegram
 */

import express from 'express'
import {
  authMiddleware,
  hotelIsolation,
  requirePermission,
} from '../../middleware/auth.js'
import { TelegramService } from '../../services/TelegramService.js'
import { query } from '../../db/postgres.js'
import { logAudit } from '../../db/database.js'
import { logInfo, logError } from '../../utils/logger.js'
import {
  validate,
  RegisterTelegramChatSchema,
  TestTelegramMessageSchema,
} from './telegram.schemas.js'

const router = express.Router()

// ═══════════════════════════════════════════════════════════════
// GET /api/telegram/status - Get bot status and info
// ═══════════════════════════════════════════════════════════════
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Check if Telegram is configured
    if (!TelegramService.isConfigured()) {
      return res.json({
        success: false,
        configured: false,
        error:
          'Telegram not configured. Set TELEGRAM_BOT_TOKEN environment variable.',
      })
    }

    const botInfo = await TelegramService.getMe()

    res.json({
      success: true,
      configured: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        name: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups,
      },
      botLink: `https://t.me/${botInfo.username}`,
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to connect to Telegram bot',
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/telegram/chats - Get all registered chats for user's context
// ═══════════════════════════════════════════════════════════════
router.get('/chats', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id } = req.user

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

    // SECURITY: Use req.hotelId from hotelIsolation middleware
    if (req.hotelId) {
      params.push(req.hotelId)
      queryText += ` AND tc.hotel_id = $${params.length}`
    }
    if (
      department_id &&
      req.user.role !== 'SUPER_ADMIN' &&
      req.user.role !== 'HOTEL_ADMIN'
    ) {
      params.push(department_id)
      queryText += ` AND (tc.department_id = $${params.length} OR tc.department_id IS NULL)`
    }

    queryText += ' ORDER BY tc.added_at DESC'

    const result = await query(queryText, params)

    res.json({
      success: true,
      chats: result.rows,
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/telegram/chats - Manually register a chat
// ═══════════════════════════════════════════════════════════════
router.post(
  '/chats',
  authMiddleware,
  hotelIsolation,
  requirePermission('settings', 'write'),
  async (req, res) => {
    try {
      const validation = validate(RegisterTelegramChatSchema, req.body)
      if (!validation.isValid) {
        return res
          .status(400)
          .json({ error: 'Ошибка валидации', details: validation.errors })
      }

      const { chatId, chatTitle, departmentId } = validation.data
      const { id: userId } = req.user

      // SECURITY: Use req.hotelId from hotelIsolation middleware instead of user-supplied hotelId
      const hotelId = req.hotelId
      if (!hotelId) {
        return res
          .status(400)
          .json({ success: false, error: 'Hotel context required' })
      }

      // Verify the chat exists and bot has access
      try {
        await TelegramService.sendMessage(
          chatId,
          '✅ Чат успешно привязан к FreshTrack!'
        )
      } catch (telegramError) {
        return res.status(400).json({
          success: false,
          error: `Cannot send message to chat. Make sure bot @freshtracksystemsbot is added to the chat. Error: ${telegramError.message}`,
        })
      }

      // Insert or update chat
      await query(
        `
      INSERT INTO telegram_chats (chat_id, chat_type, chat_title, hotel_id, department_id, is_active, added_by)
      VALUES ($1, 'group', $2, $3, $4, true, $5)
      ON CONFLICT (chat_id) DO UPDATE SET
        chat_title = COALESCE(EXCLUDED.chat_title, telegram_chats.chat_title),
        hotel_id = EXCLUDED.hotel_id,
        department_id = EXCLUDED.department_id,
        is_active = true,
        bot_removed = false
    `,
        [
          chatId,
          chatTitle || 'Manual Link',
          hotelId,
          departmentId || null,
          userId,
        ]
      )

      logInfo('TelegramController', `Chat ${chatId} linked to hotel ${hotelId}`)

      // Audit logging
      await logAudit({
        hotel_id: hotelId,
        userId: userId,
        action: 'CREATE',
        resource: 'TelegramChat',
        resourceId: String(chatId),
        details: { chatTitle, hotelId, departmentId },
      })

      res.json({
        success: true,
        message: 'Chat registered successfully',
      })
    } catch (error) {
      logError('TelegramController', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// DELETE /api/telegram/chats/:chatId - Unlink a chat
// ═══════════════════════════════════════════════════════════════
router.delete(
  '/chats/:chatId',
  authMiddleware,
  hotelIsolation,
  requirePermission('settings', 'write'),
  async (req, res) => {
    try {
      const { chatId } = req.params

      // SECURITY: Only unlink chat if it belongs to user's hotel
      const chatResult = await query(
        'SELECT hotel_id FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )
      if (
        chatResult.rows.length > 0 &&
        req.hotelId &&
        chatResult.rows[0].hotel_id !== req.hotelId
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Access denied to this chat' })
      }

      await query(
        'UPDATE telegram_chats SET is_active = false, hotel_id = NULL, department_id = NULL WHERE chat_id = $1',
        [chatId]
      )

      // Audit logging
      await logAudit({
        hotel_id: req.hotelId,
        userId: req.user.id,
        action: 'DELETE',
        resource: 'TelegramChat',
        resourceId: String(chatId),
        details: {},
      })

      res.json({
        success: true,
        message: 'Chat unlinked successfully',
      })
    } catch (error) {
      logError('TelegramController', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// POST /api/telegram/test - Send test notification
// ═══════════════════════════════════════════════════════════════
router.post(
  '/test',
  authMiddleware,
  hotelIsolation,
  requirePermission('settings', 'write'),
  async (req, res) => {
    try {
      const validation = validate(TestTelegramMessageSchema, req.body)
      if (!validation.isValid) {
        return res
          .status(400)
          .json({ error: 'Ошибка валидации', details: validation.errors })
      }

      // Check if Telegram is configured
      if (!TelegramService.isConfigured()) {
        return res.status(400).json({
          success: false,
          configured: false,
          error:
            'Telegram not configured. Set TELEGRAM_BOT_TOKEN environment variable on the server.',
        })
      }

      const { chatId } = validation.data

      let targetChats = []

      if (chatId) {
        // SECURITY: Verify chat belongs to user's hotel before sending
        if (req.hotelId) {
          const chatCheck = await query(
            'SELECT hotel_id FROM telegram_chats WHERE chat_id = $1',
            [chatId]
          )
          if (
            chatCheck.rows.length > 0 &&
            chatCheck.rows[0].hotel_id !== req.hotelId
          ) {
            return res
              .status(403)
              .json({ success: false, error: 'Access denied to this chat' })
          }
        }
        targetChats = [{ chat_id: chatId }]
      } else if (req.hotelId) {
        // SECURITY: Use req.hotelId from hotelIsolation
        targetChats = await TelegramService.getChatsForContext(req.hotelId)
      }

      if (targetChats.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No linked Telegram chats found',
        })
      }

      const testMessage = `✅ <b>Test notification</b>

This is a test message from FreshTrack. If you can see this, notifications are working correctly.

Sent at: ${new Date().toLocaleString('en-GB')}`

      const results = []
      for (const chat of targetChats) {
        try {
          await TelegramService.sendMessage(chat.chat_id, testMessage)
          results.push({ chatId: chat.chat_id, success: true })
        } catch (error) {
          results.push({
            chatId: chat.chat_id,
            success: false,
            error: error.message,
          })
        }
      }

      res.json({
        success: true,
        sentTo: results.filter((r) => r.success).length,
        total: targetChats.length,
        results,
      })
    } catch (error) {
      logError('TelegramController', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

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
          '5. Проверьте статус: /status',
        ],
        commands: {
          '/link КОД': 'Привязать чат к отелю',
          '/link КОД:Департамент': 'Привязать к отделу',
          '/unlink': 'Отвязать чат',
          '/status': 'Показать текущую привязку',
          '/notify on|off': 'Включить/выключить уведомления',
          '/filter critical|warning|expired': 'Фильтр типов уведомлений',
          '/help': 'Справка по командам',
        },
      },
    })
  } catch (error) {
    logError('TelegramController', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
