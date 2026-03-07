/**
 * FreshTrack TelegramService
 * Enhanced Telegram integration with group chat support
 *
 * Phase 5: Notification Engine
 * - Automatic chat discovery when bot is added to groups
 * - Hotel/department linking for targeted notifications
 * - Retry logic with exponential backoff
 *
 * Commands:
 *   /start       — Welcome message
 *   /help        — Full command reference
 *   /link        — Link chat to hotel/department
 *   /unlink      — Remove hotel/department link
 *   /status      — Show connection details
 *   /departments — List departments for linked hotel
 *   /report      — On-demand inventory report
 *   /summary     — Quick alert count dashboard
 *   /snooze      — Pause notifications temporarily
 *   /lang        — Set chat language (en / ru / kk)
 *   /filter      — Filter notification types
 *   /notify      — Enable or disable notifications
 *   /silent      — Toggle silent mode
 *   /test        — Send a test notification
 */

import { logError, logInfo, logWarn } from '../utils/logger.js'
import { query } from '../db/database.js'
import { t } from './TelegramI18n.js'

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}`
  : null

if (!BOT_TOKEN) {
  logWarn(
    'TelegramService',
    'TELEGRAM_BOT_TOKEN not configured. Telegram features will be disabled.'
  )
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SUPPORTED_LANGUAGES = ['en', 'ru', 'kk']
const DEFAULT_LANGUAGE = 'en'
const MAX_LIST_ITEMS = 7 // Max items shown per severity section
const MAX_MESSAGE_LENGTH = 3500 // Safe buffer below Telegram's 4096 limit
const SNOOZE_OPTIONS_HOURS = [1, 2, 4, 8, 24]

/** Status emojis — functional only, no decorative use */
export const StatusIcon = {
  EXPIRED: '🔴',
  CRITICAL: '🔴',
  WARNING: '🟡',
  OK: '🟢',
  SUCCESS: '✅',
  ERROR: '❌',
  ATTENTION: '⚠️',
}

/** @deprecated Use StatusIcon instead */
export const PriorityIcons = {
  URGENT: '🔴',
  CRITICAL: '🔴',
  WARNING: '🟡',
  INFO: '🟢',
  SUCCESS: '✅',
}

// ─────────────────────────────────────────────
// TelegramService
// ─────────────────────────────────────────────

export class TelegramService {
  // ───────────────────────────────────────────
  // Core API
  // ───────────────────────────────────────────

  static isConfigured() {
    return !!BOT_TOKEN && !!TELEGRAM_API
  }

  static async apiCall(method, payload = {}, retries = 2) {
    if (!this.isConfigured()) {
      throw new Error('Telegram not configured: TELEGRAM_BOT_TOKEN is missing')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(`${TELEGRAM_API}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      const data = await response.json()

      if (!data.ok) {
        throw new Error(data.description || `Telegram API error: ${method}`)
      }

      return data.result
    } catch (error) {
      clearTimeout(timeout)

      if (method !== 'getUpdates') {
        logError('TelegramService', error.message || error)
      }

      if (
        retries > 0 &&
        (error.name === 'AbortError' ||
          error.cause?.code === 'ECONNRESET' ||
          error.message === 'fetch failed')
      ) {
        await new Promise((r) => setTimeout(r, 2000))
        return this.apiCall(method, payload, retries - 1)
      }

      throw error
    }
  }

  static async sendMessage(chatId, text, options = {}) {
    if (!this.isConfigured()) {
      logWarn('TelegramService', 'sendMessage skipped: Telegram not configured')
      return { ok: false, skipped: true, reason: 'not_configured' }
    }

    // Trim to safe length to avoid silent Telegram rejections
    const safeText =
      text.length > MAX_MESSAGE_LENGTH
        ? text.slice(0, MAX_MESSAGE_LENGTH) + '\n\n<i>...message truncated</i>'
        : text

    const payload = {
      chat_id: chatId,
      text: safeText,
      parse_mode: 'HTML',
      disable_notification: options.disableNotification ?? false,
    }

    if (options.replyMarkup) {
      payload.reply_markup = JSON.stringify(options.replyMarkup)
    }

    return this.apiCall('sendMessage', payload)
  }

  /**
   * Get the stored language for a chat. Defaults to 'en'.
   */
  static async getChatLang(chatId) {
    try {
      const r = await query(
        'SELECT language FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )
      const lang = r.rows[0]?.language
      return lang && ['en', 'ru', 'kk'].includes(lang) ? lang : 'en'
    } catch {
      return 'en'
    }
  }

  static async getMe() {
    if (!this.isConfigured()) {
      throw new Error('Telegram not configured: TELEGRAM_BOT_TOKEN is missing')
    }
    return this.apiCall('getMe')
  }

  static async getUpdates(offset = 0, timeout = 30) {
    return this.apiCall('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message', 'my_chat_member', 'callback_query'],
    })
  }

  /**
   * Register bot commands with Telegram so they appear in the UI command menu.
   * Call once at startup.
   */
  static async registerBotCommands() {
    if (!this.isConfigured()) return

    const commands = [
      { command: 'start', description: 'Welcome message' },
      { command: 'help', description: 'Full command reference' },
      { command: 'link', description: 'Link chat to a hotel/department' },
      { command: 'unlink', description: 'Remove hotel/department link' },
      { command: 'status', description: 'Show current connection details' },
      {
        command: 'departments',
        description: 'List departments for your hotel',
      },
      { command: 'report', description: 'On-demand inventory report' },
      { command: 'summary', description: 'Quick alert count dashboard' },
      {
        command: 'snooze',
        description: 'Pause notifications (e.g. /snooze 4)',
      },
      { command: 'lang', description: 'Set language: en, ru, kk' },
      {
        command: 'filter',
        description: 'Filter: critical / warning / expired / all',
      },
      { command: 'notify', description: 'Enable or disable notifications' },
      { command: 'silent', description: 'Toggle silent (no sound) mode' },
      { command: 'test', description: 'Send a test notification' },
    ]

    try {
      await this.apiCall('setMyCommands', { commands })
      logInfo('TelegramService', `Registered ${commands.length} bot commands`)
    } catch (error) {
      logError(
        'TelegramService',
        `Failed to register bot commands: ${error.message}`
      )
    }
  }

  // ───────────────────────────────────────────
  // Update routing
  // ───────────────────────────────────────────

  static async processUpdate(update) {
    if (update.my_chat_member)
      return this.handleChatMemberUpdate(update.my_chat_member)
    if (update.message) return this.handleMessage(update.message)
    if (update.callback_query) return this.handleCallback(update.callback_query)
  }

  static async handleChatMemberUpdate(memberUpdate) {
    const { chat, new_chat_member, from } = memberUpdate

    const botInfo = await this.getMe()
    if (new_chat_member.user.id !== botInfo.id) return

    const chatId = chat.id
    const chatType = chat.type
    const chatTitle = chat.title || chat.first_name || 'Private Chat'

    if (['member', 'administrator'].includes(new_chat_member.status)) {
      logInfo(
        'TelegramService',
        `Bot added to ${chatType}: ${chatTitle} (${chatId})`
      )
      await this.registerChat({ chatId, chatType, chatTitle, addedBy: from.id })
      await this.sendWelcomeMessage(chatId, chatType)
    } else if (['left', 'kicked'].includes(new_chat_member.status)) {
      logInfo(
        'TelegramService',
        `Bot removed from ${chatType}: ${chatTitle} (${chatId})`
      )
      await this.markChatInactive(chatId)
    }
  }

  /**
   * Route incoming commands.
   * BUG FIX: /notify, /filter, /silent, /test were previously unreachable.
   */
  static async handleMessage(message) {
    const { chat, text, from } = message
    if (!text) return

    const chatId = chat.id
    const cmd = text
      .split(' ')[0]
      .toLowerCase()
      .replace('@' + (this._botUsername || ''), '')

    // ── Setup & info ────────────────────────
    if (cmd === '/start' || cmd === '/help') return this.sendHelpMessage(chatId)
    if (cmd === '/link') return this.handleLinkCommand(chatId, text, from)
    if (cmd === '/unlink') return this.handleUnlinkCommand(chatId, from)
    if (cmd === '/status') return this.handleStatusCommand(chatId)
    if (cmd === '/departments') return this.handleDepartmentsCommand(chatId)

    // ── Inventory ───────────────────────────
    if (cmd === '/report') return this.handleReportCommand(chatId)
    if (cmd === '/summary') return this.handleSummaryCommand(chatId)

    // ── Notification controls ───────────────
    if (cmd === '/snooze') return this.handleSnoozeCommand(chatId, text)
    if (cmd === '/lang') return this.handleLangCommand(chatId, text)
    if (cmd === '/filter') return this.handleFilterCommand(chatId, text)
    if (cmd === '/notify') return this.handleNotifyCommand(chatId, text)
    if (cmd === '/silent') return this.handleSilentCommand(chatId, text)
    if (cmd === '/test') return this.handleTestCommand(chatId)
  }

  // ───────────────────────────────────────────
  // Setup commands
  // ───────────────────────────────────────────

  static async sendWelcomeMessage(chatId, chatType) {
    const lang = await this.getChatLang(chatId)
    const isGroup = chatType !== 'private'
    await this.sendMessage(chatId, t(lang).welcome(isGroup))
  }

  static async sendHelpMessage(chatId) {
    const lang = await this.getChatLang(chatId)
    await this.sendMessage(chatId, t(lang).help('TSEXR'))
  }

  /**
   * /link HOTEL_CODE[:Department]
   */
  static async handleLinkCommand(chatId, text, from) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    const match = text.match(/\/link\s+([A-Za-z0-9_-]+)(?::(.+))?$/i)

    if (!match) {
      await this.sendMessage(chatId, tr.linkUsage())
      return
    }

    const marshaCode = match[1].trim().toUpperCase()
    const deptName = match[2]?.trim()

    try {
      const hotelResult = await query(
        'SELECT id, name, marsha_code FROM hotels WHERE UPPER(marsha_code) = $1 LIMIT 1',
        [marshaCode]
      )

      if (hotelResult.rows.length === 0) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.ERROR} ${tr.linkHotelNotFound(marshaCode)}`
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
          const available = await query(
            'SELECT name FROM departments WHERE hotel_id = $1 ORDER BY name',
            [hotel.id]
          )
          const deptList = available.rows.length
            ? available.rows.map((d) => `\u2022 ${d.name}`).join('\n')
            : tr.noDepts

          await this.sendMessage(
            chatId,
            `${StatusIcon.ERROR} ${tr.linkDeptNotFound(deptName, hotel.name, deptList, marshaCode)}`
          )
          return
        }

        department = deptResult.rows[0]
      }

      await query(
        `
        INSERT INTO telegram_chats (chat_id, chat_type, chat_title, hotel_id, department_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (chat_id) DO UPDATE SET
          hotel_id      = EXCLUDED.hotel_id,
          department_id = EXCLUDED.department_id,
          is_active     = true,
          bot_removed   = false,
          snooze_until  = NULL
      `,
        [chatId, 'group', 'Linked Chat', hotel.id, department?.id || null]
      )

      const deptLabel = department ? department.name : tr.allDepts

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${tr.linkSuccess(hotel.name, deptLabel)}`
      )

      logInfo(
        'TelegramService',
        `Chat ${chatId} linked to ${hotel.name}${department ? ` / ${department.name}` : ''}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /unlink
   */
  static async handleUnlinkCommand(chatId, from) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      await query(
        'UPDATE telegram_chats SET hotel_id = NULL, department_id = NULL, snooze_until = NULL WHERE chat_id = $1',
        [chatId]
      )

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${tr.unlinkSuccess()}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /status
   */
  static async handleStatusCommand(chatId) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      const result = await query(
        `
        SELECT tc.*, h.name AS hotel_name, d.name AS department_name
        FROM telegram_chats tc
        LEFT JOIN hotels h ON tc.hotel_id = h.id
        LEFT JOIN departments d ON tc.department_id = d.id
        WHERE tc.chat_id = $1
      `,
        [chatId]
      )

      if (result.rows.length === 0 || !result.rows[0].hotel_id) {
        await this.sendMessage(
          chatId,
          `<b>${tr.statusTitle}</b>\n\n` +
            `<b>Status:</b> ${StatusIcon.ERROR} ${tr.statusNotLinked}`
        )
        return
      }

      const chat = result.rows[0]
      const active = chat.is_active

      // Snooze info
      let snoozeInfo = ''
      if (chat.snooze_until) {
        const snoozeUntil = new Date(chat.snooze_until)
        if (snoozeUntil > new Date()) {
          snoozeInfo = `\n${tr.statusSnoozedUntil(this.formatTime(snoozeUntil))}`
        }
      }

      // Notification type filter
      let filterInfo = ''
      if (chat.notification_types) {
        const types =
          typeof chat.notification_types === 'string'
            ? JSON.parse(chat.notification_types)
            : chat.notification_types
        filterInfo = `\n<b>${tr.statusNotifTypes}:</b> ${types.join(', ')}`
      }

      const lines = [
        `<b>${tr.statusTitle}</b>`,
        '',
        `<b>Status:</b> ${active ? `${StatusIcon.OK} ${tr.statusConnected}` : `${StatusIcon.ERROR} ${tr.statusInactive}`}`,
        `<b>${tr.statusHotel}:</b> ${chat.hotel_name}`,
        `<b>${tr.statusDept}:</b> ${chat.department_name || tr.allDepts}`,
        `<b>${tr.statusLang}:</b> ${chat.language || DEFAULT_LANGUAGE}`,
        `<b>${tr.statusNotifications}:</b> ${active ? tr.statusActive : tr.statusInactive}`,
        `<b>${tr.statusSilent}:</b> ${chat.silent_mode ? tr.statusOn : tr.statusOff}`,
        filterInfo,
        snoozeInfo,
      ].filter(Boolean)

      await this.sendMessage(chatId, lines.join('\n'))
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /departments
   * Lists departments for the linked hotel.
   * Makes /link discovery self-service — no need to check the web app.
   */
  static async handleDepartmentsCommand(chatId) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      const chatResult = await query(
        'SELECT hotel_id FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )

      if (!chatResult.rows[0]?.hotel_id) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.ATTENTION} ${tr.deptsNotLinked}`
        )
        return
      }

      const hotelId = chatResult.rows[0].hotel_id

      const [hotelResult, deptResult] = await Promise.all([
        query('SELECT name, marsha_code FROM hotels WHERE id = $1', [hotelId]),
        query(
          'SELECT name FROM departments WHERE hotel_id = $1 AND is_active = true ORDER BY name',
          [hotelId]
        ),
      ])

      const hotel = hotelResult.rows[0]

      if (deptResult.rows.length === 0) {
        await this.sendMessage(chatId, tr.deptsNone(hotel.name))
        return
      }

      const deptLines = deptResult.rows
        .map((d) => `\u2022 ${d.name}`)
        .join('\n')

      await this.sendMessage(
        chatId,
        tr.deptsList(hotel.name, deptLines, hotel.marsha_code)
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * Fetch notification thresholds for a chat.
   * Priority: telegram_chats own columns → notification_rules → defaults (7/3).
   */
  static async getNotificationThresholds(
    hotel_id,
    department_id,
    chatId = null
  ) {
    // 1. Per-chat overrides (configurable via Settings → Telegram in the web app)
    if (chatId) {
      const chatRow = await query(
        'SELECT warning_days, critical_days FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )
      const row = chatRow.rows[0]
      if (row?.warning_days != null) {
        return {
          warningDays: row.warning_days,
          criticalDays: row.critical_days ?? 3,
        }
      }
    }

    // 2. Hotel notification_rules (same query as ExpiryService, supports monthly mode)
    const rulesResult = await query(
      `
      SELECT warning_days, critical_days, notification_mode, warning_months
      FROM notification_rules
      WHERE (hotel_id = $1 OR hotel_id IS NULL)
        AND type = 'expiry'
        AND enabled = true
      ORDER BY hotel_id NULLS LAST
      LIMIT 1
    `,
      [hotel_id]
    )

    if (rulesResult.rows.length > 0) {
      const row = rulesResult.rows[0]
      const effectiveWarning =
        row.notification_mode === 'monthly'
          ? (row.warning_months || 2) * 30
          : row.warning_days
      return {
        warningDays: effectiveWarning,
        criticalDays: row.critical_days,
      }
    }

    return { warningDays: 7, criticalDays: 3 }
  }

  /**
   * /report
   * On-demand full inventory report using hotel notification thresholds.
   */
  static async handleReportCommand(chatId) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      const chatResult = await query(
        'SELECT hotel_id, department_id FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )

      if (!chatResult.rows[0]?.hotel_id) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.ATTENTION} ${tr.reportNotLinked}`
        )
        return
      }

      const { hotel_id, department_id } = chatResult.rows[0]
      const { warningDays, criticalDays } =
        await this.getNotificationThresholds(hotel_id, department_id, chatId)

      const inventoryResult = await query(
        `
        SELECT
          b.id,
          p.name   AS product_name,
          b.quantity,
          b.expiry_date,
          d.name   AS department_name,
          CASE
            WHEN b.expiry_date < CURRENT_DATE                                         THEN 'expired'
            WHEN b.expiry_date <= CURRENT_DATE + ($3 || ' days')::INTERVAL            THEN 'critical'
            WHEN b.expiry_date <= CURRENT_DATE + ($4 || ' days')::INTERVAL            THEN 'warning'
          END AS severity
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN departments d ON b.department_id = d.id
        WHERE b.hotel_id = $1
          AND ($2::uuid IS NULL OR b.department_id = $2)
          AND b.expiry_date <= CURRENT_DATE + ($4 || ' days')::INTERVAL
          AND b.quantity > 0
        ORDER BY b.expiry_date ASC
      `,
        [hotel_id, department_id || null, criticalDays, warningDays]
      )

      const rows = inventoryResult.rows
      const expired = rows.filter((r) => r.severity === 'expired')
      const critical = rows.filter((r) => r.severity === 'critical')
      const warning = rows.filter((r) => r.severity === 'warning')

      if (rows.length === 0) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.OK} ${tr.reportAllClear(warningDays)}` +
            `<i>${tr.reportGenerated}: ${this.formatDate(new Date())}</i>`
        )
        return
      }

      const sections = []
      if (expired.length > 0)
        sections.push(
          this.formatReportSection(
            StatusIcon.EXPIRED,
            tr.reportExpired,
            expired,
            tr
          )
        )
      if (critical.length > 0)
        sections.push(
          this.formatReportSection(
            StatusIcon.CRITICAL,
            tr.reportCritical(criticalDays),
            critical,
            tr
          )
        )
      if (warning.length > 0)
        sections.push(
          this.formatReportSection(
            StatusIcon.WARNING,
            tr.reportWarning(warningDays),
            warning,
            tr
          )
        )

      const header = [
        tr.reportHeader(expired.length, critical.length, warning.length),
        `<i>${this.formatDate(new Date())}</i>`,
        '',
      ].join('\n')

      await this.sendMessage(chatId, header + sections.join('\n\n'))
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  static formatReportSection(icon, label, items, tr = t('en')) {
    const visible = items.slice(0, MAX_LIST_ITEMS)
    const remaining = items.length - visible.length

    const lines = visible.map(
      (item) =>
        `\u2022 <b>${item.product_name}</b> \u2014 ${tr.reportQty}: ${item.quantity} \u2014 ${tr.reportExp}: ${this.formatDate(item.expiry_date)}` +
        (item.department_name ? ` <i>(${item.department_name})</i>` : '')
    )

    if (remaining > 0) {
      lines.push(`<i>${tr.reportMore(remaining)}</i>`)
    }

    return `${icon} <b>${label}</b>\n${lines.join('\n')}`
  }

  /**
   * /summary
   * Quick alert count dashboard — just totals, no item lists.
   */
  static async handleSummaryCommand(chatId) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      const chatResult = await query(
        'SELECT hotel_id, department_id FROM telegram_chats WHERE chat_id = $1',
        [chatId]
      )

      if (!chatResult.rows[0]?.hotel_id) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.ATTENTION} ${tr.reportNotLinked}`
        )
        return
      }

      const { hotel_id, department_id } = chatResult.rows[0]
      const { warningDays, criticalDays } =
        await this.getNotificationThresholds(hotel_id, department_id, chatId)

      const result = await query(
        `
        SELECT
          COUNT(*) FILTER (WHERE b.expiry_date < CURRENT_DATE)                                                                              AS expired,
          COUNT(*) FILTER (WHERE b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + ($3 || ' days')::INTERVAL)               AS critical,
          COUNT(*) FILTER (WHERE b.expiry_date > CURRENT_DATE + ($3 || ' days')::INTERVAL AND b.expiry_date <= CURRENT_DATE + ($4 || ' days')::INTERVAL) AS warning,
          COUNT(*) FILTER (WHERE b.expiry_date > CURRENT_DATE + ($4 || ' days')::INTERVAL)                                                  AS ok,
          COUNT(*)                                                                                                                           AS total
        FROM batches b
        WHERE b.hotel_id = $1
          AND ($2::uuid IS NULL OR b.department_id = $2)
          AND b.quantity > 0
      `,
        [hotel_id, department_id || null, criticalDays, warningDays]
      )

      const s = result.rows[0]
      const expired = parseInt(s.expired) || 0
      const critical = parseInt(s.critical) || 0
      const warning = parseInt(s.warning) || 0
      const ok = parseInt(s.ok) || 0
      const total = parseInt(s.total) || 0

      const overallStatus =
        expired > 0 || critical > 0
          ? StatusIcon.EXPIRED
          : warning > 0
            ? StatusIcon.WARNING
            : StatusIcon.OK

      const lines = [
        `${overallStatus} <b>${tr.summaryTitle}</b>`,
        `<i>${this.formatDate(new Date())}</i>`,
        '',
        `${StatusIcon.EXPIRED} <b>${tr.summaryExpired}</b>: ${expired}`,
        `${StatusIcon.CRITICAL} <b>${tr.summaryCritical(criticalDays)}</b>: ${critical}`,
        `${StatusIcon.WARNING} <b>${tr.summaryWarning(warningDays)}</b>: ${warning}`,
        `${StatusIcon.OK} <b>${tr.summaryOk}</b>: ${ok}`,
        `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `${tr.summaryTotal}: <b>${total}</b>`,
        '',
        expired + critical + warning > 0
          ? tr.summaryUseReport
          : `<i>${tr.summaryNoAttention}</i>`,
      ]
      await this.sendMessage(chatId, lines.join('\n'))
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /snooze [hours|off]
   * Pause alerts temporarily.
   */
  static async handleSnoozeCommand(chatId, text) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    const match = text.match(/\/snooze\s+(\d+|off)/i)

    if (!match) {
      const opts = SNOOZE_OPTIONS_HOURS.map(
        (h) => `<code>/snooze ${h}</code>`
      ).join(' | ')
      await this.sendMessage(chatId, tr.snoozeUsage(opts))
      return
    }

    const arg = match[1].toLowerCase()

    try {
      if (arg === 'off') {
        await query(
          'UPDATE telegram_chats SET snooze_until = NULL WHERE chat_id = $1',
          [chatId]
        )
        await this.sendMessage(
          chatId,
          `${StatusIcon.SUCCESS} ${tr.snoozeCancelled}`
        )
        return
      }

      const hours = parseInt(arg)
      if (!SNOOZE_OPTIONS_HOURS.includes(hours)) {
        await this.sendMessage(
          chatId,
          `${StatusIcon.ERROR} ${tr.snoozeInvalidDuration(SNOOZE_OPTIONS_HOURS.join(', '))}`
        )
        return
      }

      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000)

      await query(
        'UPDATE telegram_chats SET snooze_until = $1 WHERE chat_id = $2',
        [snoozeUntil.toISOString(), chatId]
      )

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${tr.snoozeSet(this.formatTime(snoozeUntil))}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /lang [en|ru|kk]
   */
  static async handleLangCommand(chatId, text) {
    const currentLang = await this.getChatLang(chatId)
    const tr = t(currentLang)
    const match = text.match(/\/lang\s+(\S+)/i)

    if (!match) {
      await this.sendMessage(chatId, tr.langUsage())
      return
    }

    const lang = match[1].toLowerCase()

    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.langUnsupported(lang, SUPPORTED_LANGUAGES.join(', '))}`
      )
      return
    }

    const labels = { en: 'English', ru: 'Русский', kk: 'Қазақша' }

    try {
      await query(
        'UPDATE telegram_chats SET language = $1 WHERE chat_id = $2',
        [lang, chatId]
      )

      // Respond in the newly selected language
      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${t(lang).langSet(labels[lang])}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  // ───────────────────────────────────────────
  // Notification control commands
  // ───────────────────────────────────────────

  static async handleNotifyCommand(chatId, text) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    const match = text.match(/\/notify\s+(on|off)/i)

    if (!match) {
      await this.sendMessage(chatId, tr.notifyUsage())
      return
    }

    const enabled = match[1].toLowerCase() === 'on'

    try {
      await query(
        'UPDATE telegram_chats SET is_active = $1 WHERE chat_id = $2',
        [enabled, chatId]
      )

      await this.sendMessage(
        chatId,
        enabled
          ? `${StatusIcon.SUCCESS} ${tr.notifyEnabled}`
          : `${StatusIcon.ERROR} ${tr.notifyDisabled}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  static async handleFilterCommand(chatId, text) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    const validTypes = ['critical', 'warning', 'expired', 'all']
    const match = text.match(/\/filter\s+(\S+)/i)

    if (!match) {
      await this.sendMessage(chatId, tr.filterUsage())
      return
    }

    const filterType = match[1].toLowerCase()

    if (!validTypes.includes(filterType)) {
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.filterUnknown(filterType, validTypes.join(', '))}`
      )
      return
    }

    try {
      const notificationTypes =
        filterType === 'all' ? ['critical', 'warning', 'expired'] : [filterType]

      await query(
        'UPDATE telegram_chats SET notification_types = $1 WHERE chat_id = $2',
        [JSON.stringify(notificationTypes), chatId]
      )

      const allLabel = { en: 'All types', ru: 'Все типы', kk: 'Барлық түрлер' }
      const typeLabels = {
        critical: `${StatusIcon.CRITICAL} ${tr.summaryCritical(3)}`,
        warning: `${StatusIcon.WARNING} ${tr.summaryWarning(7)}`,
        expired: `${StatusIcon.EXPIRED} ${tr.summaryExpired}`,
        all: allLabel[lang] || 'All types',
      }

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${tr.filterUpdated(typeLabels[filterType])}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  static async handleSilentCommand(chatId, text) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    const match = text.match(/\/silent\s+(on|off)/i)

    if (!match) {
      await this.sendMessage(chatId, tr.silentUsage())
      return
    }

    const silent = match[1].toLowerCase() === 'on'

    try {
      await query(
        'UPDATE telegram_chats SET silent_mode = $1 WHERE chat_id = $2',
        [silent, chatId]
      )

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} ${silent ? tr.silentEnabled : tr.silentDisabled}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  /**
   * /test — proper instance-aware handler (replaces legacy sendTestNotification)
   */
  static async handleTestCommand(chatId) {
    const lang = await this.getChatLang(chatId)
    const tr = t(lang)
    try {
      const chatResult = await query(
        `SELECT tc.*, h.name AS hotel_name, d.name AS department_name
         FROM telegram_chats tc
         LEFT JOIN hotels h ON tc.hotel_id = h.id
         LEFT JOIN departments d ON tc.department_id = d.id
         WHERE tc.chat_id = $1`,
        [chatId]
      )

      const chat = chatResult.rows[0]
      const hotelName = chat?.hotel_name || tr.testNotLinked
      const deptName = chat?.department_name || tr.allDepts

      await this.sendMessage(
        chatId,
        `${StatusIcon.SUCCESS} <b>${tr.testTitle}</b>\n\n` +
          `${tr.testWorking}\n\n` +
          `<b>${tr.testHotel}:</b> ${hotelName}\n` +
          `<b>${tr.testDept}:</b> ${deptName}\n` +
          `<b>${tr.testSentAt}:</b> ${this.formatTime(new Date())}`
      )
    } catch (error) {
      logError('TelegramService', error)
      await this.sendMessage(
        chatId,
        `${StatusIcon.ERROR} ${tr.error(error.message)}`
      )
    }
  }

  // ───────────────────────────────────────────
  // Notification delivery
  // ───────────────────────────────────────────

  static async getChatsForContext(hotelId, departmentId = null) {
    try {
      let queryText = `
        SELECT * FROM telegram_chats
        WHERE is_active   = true
          AND bot_removed = false
          AND hotel_id    = $1
          AND (snooze_until IS NULL OR snooze_until < NOW())
      `
      const params = [hotelId]

      if (departmentId) {
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

  static async sendBatchNotification(
    batch,
    notificationType,
    hotelId,
    departmentId
  ) {
    if (!this.isConfigured()) {
      return { success: false, skipped: true, error: 'Telegram not configured' }
    }

    // getChatsForContext excludes snoozed chats automatically
    const chats = await this.getChatsForContext(hotelId, departmentId)

    if (chats.length === 0) {
      return {
        success: false,
        error: 'No linked Telegram chats found (or all are snoozed)',
      }
    }

    const results = []

    for (const chat of chats) {
      // Respect per-chat notification type filter
      if (chat.notification_types) {
        const types =
          typeof chat.notification_types === 'string'
            ? JSON.parse(chat.notification_types)
            : chat.notification_types
        if (!types.includes(notificationType)) continue
      }

      try {
        const message = this.formatBatchNotification(batch, notificationType)
        const result = await this.sendMessage(chat.chat_id, message, {
          disableNotification: chat.silent_mode,
        })

        results.push({
          chatId: chat.chat_id,
          success: true,
          messageId: result.message_id,
        })

        await query(
          'UPDATE telegram_chats SET last_message_at = NOW() WHERE chat_id = $1',
          [chat.chat_id]
        )
      } catch (error) {
        logError('TelegramService', error)
        results.push({
          chatId: chat.chat_id,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    return {
      success: successCount > 0,
      sentTo: successCount,
      totalChats: chats.length,
      results,
    }
  }

  static formatBatchNotification(batch, type) {
    const icon =
      type === 'expired' || type === 'critical'
        ? StatusIcon.EXPIRED
        : StatusIcon.WARNING

    const statusText =
      type === 'expired'
        ? 'Expired'
        : type === 'critical'
          ? 'Expiring Today'
          : 'Expiring Soon'

    const daysLeft = batch.daysLeft
    const daysText =
      daysLeft === 0
        ? 'today'
        : daysLeft === 1
          ? 'tomorrow'
          : daysLeft < 0
            ? `${Math.abs(daysLeft)} days ago`
            : `in ${daysLeft} days`

    const productName = batch.productName || batch.product_name
    const expiryDate = batch.expiryDate || batch.expiry_date
    const departmentName = batch.departmentName || batch.department_name

    return [
      `${icon} <b>${statusText}</b>`,
      '',
      `<b>${productName}</b>`,
      `Qty: ${batch.quantity} ${batch.unit || 'units'} \u2014 Exp: ${expiryDate} (${daysText})`,
      departmentName ? `<i>${departmentName}</i>` : null,
    ]
      .filter((line) => line !== null)
      .join('\n')
  }

  // ───────────────────────────────────────────
  // DB helpers
  // ───────────────────────────────────────────

  static async registerChat({
    chatId,
    chatType,
    chatTitle,
    addedBy: _addedBy,
  }) {
    try {
      await query(
        `
        INSERT INTO telegram_chats (chat_id, chat_type, chat_title, is_active, added_at)
        VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (chat_id) DO UPDATE SET
          chat_type   = EXCLUDED.chat_type,
          chat_title  = EXCLUDED.chat_title,
          is_active   = true,
          bot_removed = false
      `,
        [chatId, chatType, chatTitle]
      )

      logInfo('TelegramService', `Registered chat: ${chatTitle} (${chatId})`)
    } catch (error) {
      logError('TelegramService', error)
    }
  }

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

  // ───────────────────────────────────────────
  // Polling
  // ───────────────────────────────────────────

  static async startPolling(intervalMs = 1000) {
    if (!this.isConfigured()) {
      logWarn(
        'TelegramService',
        'Telegram polling skipped: TELEGRAM_BOT_TOKEN not configured'
      )
      return false
    }

    // Cache bot username for @-mention stripping in handleMessage
    try {
      const me = await this.getMe()
      this._botUsername = me.username
    } catch (err) {
      logWarn('TelegramService', `Could not fetch bot username: ${err.message}`)
    }

    await this.registerBotCommands()

    logInfo('TelegramService', 'Starting Telegram polling...')

    let offset = 0
    let consecutiveErrors = 0
    const MAX_ERRORS = 5

    const poll = async () => {
      try {
        const updates = await this.getUpdates(offset)
        consecutiveErrors = 0

        for (const update of updates) {
          offset = update.update_id + 1
          await this.processUpdate(update)
        }
      } catch (error) {
        consecutiveErrors++

        if (consecutiveErrors === 1 || consecutiveErrors % 10 === 0) {
          logError(
            'TelegramService',
            `Polling error (${consecutiveErrors}x): ${error.message}`
          )
        }

        if (consecutiveErrors >= MAX_ERRORS) {
          const backoffMs = Math.min(30000, intervalMs * consecutiveErrors)
          setTimeout(poll, backoffMs)
          return
        }
      }

      setTimeout(poll, intervalMs)
    }

    poll()
    return true
  }

  // ───────────────────────────────────────────
  // Utility
  // ───────────────────────────────────────────

  static formatDate(date) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-GB')
  }

  static formatTime(date) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

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
// Legacy compatibility wrappers
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use TelegramService.startPolling() */
export function initTelegramBot(enablePolling = false) {
  if (enablePolling) TelegramService.startPolling(2000)
  logInfo('TelegramService', 'Telegram bot initialized (legacy wrapper)')
  return true
}

/** @deprecated Use TelegramService.sendMessage() */
export async function sendCustomMessage(text) {
  if (!TelegramService.isConfigured()) {
    return { success: false, skipped: true, error: 'Telegram not configured' }
  }

  const defaultChatId = process.env.TELEGRAM_CHAT_ID
  if (!defaultChatId) {
    return { success: false, error: 'No default TELEGRAM_CHAT_ID configured' }
  }

  try {
    await TelegramService.sendMessage(defaultChatId, text)
    return { success: true }
  } catch (error) {
    logError('TelegramService', error)
    return { success: false, error: error.message }
  }
}

/** @deprecated Use NotificationEngine for multi-hotel notifications */
export async function sendDailyAlert({
  expiredProducts = [],
  expiringToday = [],
  expiringSoon = [],
}) {
  const total =
    expiredProducts.length + expiringToday.length + expiringSoon.length
  if (total === 0)
    return { success: true, message: 'No items require attention' }

  const date = TelegramService.formatDate(new Date())

  const section = (icon, label, items) => {
    if (!items.length) return ''
    const lines = items
      .slice(0, MAX_LIST_ITEMS)
      .map((p) => `\u2022 <b>${p.name}</b> \u2014 Qty: ${p.quantity}`)
    if (items.length > MAX_LIST_ITEMS)
      lines.push(`<i>...and ${items.length - MAX_LIST_ITEMS} more items</i>`)
    return `${icon} <b>${label}</b>\n${lines.join('\n')}\n`
  }

  const message = [
    `<b>FreshTrack Daily Alert</b>`,
    `<i>${date}</i>`,
    '',
    section(StatusIcon.CRITICAL, 'Expiring today', expiringToday),
    section(StatusIcon.WARNING, 'Expiring within 3 days', expiringSoon),
    section(StatusIcon.EXPIRED, 'Expired', expiredProducts),
  ].join('\n')

  return sendCustomMessage(message)
}

/** @deprecated Use TelegramService.handleTestCommand() */
export async function sendTestNotification() {
  const defaultChatId = process.env.TELEGRAM_CHAT_ID
  if (defaultChatId) {
    return TelegramService.handleTestCommand(defaultChatId)
  }
  return { success: false, error: 'No default TELEGRAM_CHAT_ID configured' }
}

export default TelegramService
