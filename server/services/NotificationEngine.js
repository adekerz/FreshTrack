/**
 * FreshTrack Notification Engine
 * Simplified: Daily aggregated reports only
 * 
 * RULES:
 * - Notifications are sent only once per day as an aggregated report
 * - No per-item or real-time alerts by design (anti-spam UX)
 * - Single entry point: sendDailyReport()
 * - All messages use templates.dailyReport only
 */

import { query } from '../db/database.js'
import { v4 as uuidv4 } from 'uuid'
import { logError, logInfo, logDebug } from '../utils/logger.js'
import { TelegramService } from './TelegramService.js'
import { sendDailyReportEmail, resolveEmailRecipient } from './EmailService.js'

/**
 * NotificationEngine - Centralized notification processing
 * 
 * Design: Simple, predictable, reliable
 * If code seems "too simple" - it's done right.
 */
export class NotificationEngine {

  /**
   * Send daily aggregated report
   * 
   * This is the ONLY public method for sending notifications.
   * Called by cron job once per day.
   * 
   * Algorithm:
   * 1. Get batches
   * 2. Calculate statistics (good, warning, expired, total)
   * 3. Build expiringList (top-10) and expiredList (top-10)
   * 4. Build templateData
   * 5. Check channel settings (notify.channels.*)
   * 6. Send ONCE via Telegram and/or Email using dailyReport template
   */
  static async sendDailyReport() {
    logInfo('NotificationEngine', '📊 Starting daily report generation...')

    try {
      // Get all active hotels
      const hotelsResult = await query(`
        SELECT id, name FROM hotels WHERE is_active = true
      `)
      const hotels = hotelsResult.rows

      let telegramReportsSent = 0
      let emailReportsSent = 0

      for (const hotel of hotels) {
        try {
          // Get departments for this hotel
          const deptsResult = await query(`
            SELECT id, name, email FROM departments 
            WHERE hotel_id = $1 AND is_active = true
          `, [hotel.id])
          const departments = deptsResult.rows

          // Process each department + hotel-wide (чаты без привязки к отделу)
          const scopes = departments.length > 0
            ? [
                ...departments.map(d => ({ type: 'department', ...d, hotel })),
                { type: 'hotel', id: null, name: null, email: null, hotel }
              ]
            : [{ type: 'hotel', id: null, name: null, email: null, hotel }]

          for (const scope of scopes) {
            // 1. Get batches for this scope
            const batchesQuery = scope.type === 'department'
              ? `
                SELECT 
                  b.id,
                  b.product_id,
                  b.expiry_date,
                  b.quantity,
                  p.unit,
                  p.name as product_name,
                  (b.expiry_date - CURRENT_DATE)::INTEGER as days_left
                FROM batches b
                JOIN products p ON p.id = b.product_id
                WHERE b.hotel_id = $1 
                  AND b.department_id = $2
                  AND b.quantity > 0
                  AND b.expiry_date IS NOT NULL
              `
              : `
                SELECT 
                  b.id,
                  b.product_id,
                  b.expiry_date,
                  b.quantity,
                  p.unit,
                  p.name as product_name,
                  (b.expiry_date - CURRENT_DATE)::INTEGER as days_left
                FROM batches b
                JOIN products p ON p.id = b.product_id
                WHERE b.hotel_id = $1 
                  AND b.quantity > 0
                  AND b.expiry_date IS NOT NULL
              `

            const batchesParams = scope.type === 'department' 
              ? [hotel.id, scope.id]
              : [hotel.id]

            const batchesResult = await query(batchesQuery, batchesParams)
            const batches = batchesResult.rows

            // 2. Calculate statistics
            // Notifications are sent only once per day as an aggregated report
            // No per-item or real-time alerts by design (anti-spam UX)
            const stats = {
              good: 0,
              warning: 0, // ≤7 days
              expired: 0,
              total: batches.length
            }

            for (const batch of batches) {
              const daysLeft = batch.days_left || 0
              if (daysLeft < 0) {
                stats.expired++
              } else if (daysLeft <= 7) {
                stats.warning++
              } else {
                stats.good++
              }
            }

            // 3. Build expiringList (top-10, ≤7 days, not expired)
            const expiringList = batches
              .filter(b => (b.days_left || 0) > 0 && (b.days_left || 0) <= 7)
              .sort((a, b) => (a.days_left || 0) - (b.days_left || 0))
              .slice(0, 10)
              .map(b => ({
                product_name: b.product_name,
                expiry_date: b.expiry_date,
                quantity: b.quantity,
                unit: b.unit || 'шт.',
                days_left: b.days_left || 0
              }))

            // 4. Build expiredList (top-10, expired)
            const expiredList = batches
              .filter(b => (b.days_left || 0) < 0)
              .sort((a, b) => (a.days_left || 0) - (b.days_left || 0))
              .slice(0, 10)
              .map(b => ({
                product_name: b.product_name,
                expiry_date: b.expiry_date,
                quantity: b.quantity,
                unit: b.unit || 'шт.',
                days_overdue: Math.abs(b.days_left || 0)
              }))

            // 5. Build templateData
            const currentDate = new Date().toLocaleDateString('ru-RU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            const templateData = {
              good: stats.good,
              warning: stats.warning,
              expired: stats.expired,
              total: stats.total,
              date: currentDate,
              expiringList,
              expiredList,
              department: scope.name || ''
            }

            // 6. Check channel settings and send

            // Telegram channel
            const telegramEnabledResult = await query(`
              SELECT value FROM settings 
              WHERE key = 'notify.channels.telegram' 
                AND (hotel_id = $1 OR hotel_id IS NULL)
              ORDER BY hotel_id NULLS LAST
              LIMIT 1
            `, [hotel.id])

            const telegramEnabled = telegramEnabledResult.rows.length === 0 ||
              (telegramEnabledResult.rows[0].value !== 'false' && 
               telegramEnabledResult.rows[0].value !== false)

            if (telegramEnabled) {
              // Get linked Telegram chats for this scope
              const chatsQuery = scope.type === 'department'
                ? `
                  SELECT chat_id, chat_title 
                  FROM telegram_chats 
                  WHERE hotel_id = $1 
                    AND department_id = $2 
                    AND is_active = true
                `
                : `
                  SELECT chat_id, chat_title 
                  FROM telegram_chats 
                  WHERE hotel_id = $1 
                    AND department_id IS NULL
                    AND is_active = true
                `

              const chatsParams = scope.type === 'department'
                ? [hotel.id, scope.id]
                : [hotel.id]

              const chatsResult = await query(chatsQuery, chatsParams)
              const chats = chatsResult.rows

              // Get template from settings
              const templatesResult = await query(`
                SELECT value FROM settings 
                WHERE key IN ('notify.templates', 'telegram_message_templates') 
                  AND (hotel_id = $1 OR hotel_id IS NULL)
                ORDER BY 
                  CASE WHEN key = 'notify.templates' THEN 0 ELSE 1 END,
                  hotel_id NULLS LAST
                LIMIT 1
              `, [hotel.id])

              let template = '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'

              if (templatesResult.rows.length > 0) {
                try {
                  const templateSettings = JSON.parse(templatesResult.rows[0].value)
                  if (templateSettings.dailyReport) {
                    template = templateSettings.dailyReport
                  }
                } catch {
                  // Use default template
                }
              }

              // Format lists for template
              const formatExpiringList = () => {
                if (expiringList.length === 0) return ''
                const items = expiringList.map(b => {
                  const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
                  return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (истекает ${date}, осталось ${b.days_left} дн.)`
                }).join('\n')
                return `⚠️ Истекают в ближайшее время:\n${items}`
              }

              const formatExpiredList = () => {
                if (expiredList.length === 0) return ''
                const items = expiredList.map(b => {
                  const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
                  return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (просрочено с ${date}, ${b.days_overdue} дн. назад)`
                }).join('\n')
                return `🔴 Просрочено:\n${items}`
              }

              const expiringListText = formatExpiringList()
              const expiredListText = formatExpiredList()

              // Build message
              const location = scope.type === 'department'
                ? `🏨 ${hotel.name} → 🏢 ${scope.name}`
                : `🏨 ${hotel.name}`

              const message = `${location}\n\n${template
                .replace(/{good}/g, templateData.good)
                .replace(/{warning}/g, templateData.warning)
                .replace(/{expired}/g, templateData.expired)
                .replace(/{total}/g, templateData.total)
                .replace(/{date}/g, templateData.date)
                .replace(/{expiringList}/g, expiringListText)
                .replace(/{expiredList}/g, expiredListText)
                .replace(/{department}/g, templateData.department)}`

              // Send to all linked chats
              for (const chat of chats) {
                try {
                  await TelegramService.sendMessage(chat.chat_id, message)
                  telegramReportsSent++
                  logInfo('NotificationEngine', `📤 Telegram daily report sent to ${chat.chat_title || chat.chat_id}`)
                } catch (error) {
                  logError('NotificationEngine', `Failed to send Telegram report to ${chat.chat_id}`, error)
                }
              }
            }

            // Email channel
            const emailEnabledResult = await query(`
              SELECT value FROM settings 
              WHERE key = 'notify.channels.email' 
                AND (hotel_id = $1 OR hotel_id IS NULL)
              ORDER BY hotel_id NULLS LAST
              LIMIT 1
            `, [hotel.id])

            const emailEnabled = emailEnabledResult.rows.length > 0 &&
              (emailEnabledResult.rows[0].value === 'true' || 
               emailEnabledResult.rows[0].value === true)

            if (emailEnabled && scope.type === 'department' && scope.email) {
              const department = { id: scope.id, name: scope.name, email: scope.email }
              const to = resolveEmailRecipient('DEPARTMENT', { department })
              
              if (to) {
                try {
                  await sendDailyReportEmail({
                    stats: {
                      totalBatches: stats.total,
                      expiringBatches: stats.warning,
                      expiredBatches: stats.expired,
                      collectionsToday: 0, // Can be added later if needed
                      hotel: { id: hotel.id, name: hotel.name },
                      department,
                      expiringList,
                      expiredList
                    },
                    to
                  })
                  emailReportsSent++
                  logInfo('NotificationEngine', `📧 Email daily report sent to ${to} for department ${department.name}`)
                } catch (error) {
                  logError('NotificationEngine', `Failed to send email report to ${to}`, error)
                }
              }
            }
          }
        } catch (error) {
          logError('NotificationEngine', `Failed to process hotel ${hotel.id}`, error)
        }
      }

      // Notifications are sent only once per day as an aggregated report
      // No per-item or real-time alerts by design (anti-spam UX)
      logInfo('NotificationEngine', 'Daily notification report sent', {
        telegramEnabled: telegramReportsSent > 0,
        emailEnabled: emailReportsSent > 0,
        total: telegramReportsSent + emailReportsSent,
        expired: hotels.length // Number of hotels processed
      })

      return {
        sent: telegramReportsSent + emailReportsSent,
        telegram: telegramReportsSent,
        email: emailReportsSent
      }
    } catch (error) {
      logError('NotificationEngine', 'Daily report failed', error)
      throw error
    }
  }

  /**
   * Get notification rules for a hotel
   * @param {string} hotelId - Hotel ID (required)
   * @param {string} departmentId - Optional department ID to filter by
   * @param {boolean} includeDisabled - Include disabled rules
   */
  static async getRules(hotelId = null, departmentId = null, includeDisabled = true) {
    let queryText = 'SELECT * FROM notification_rules WHERE 1=1'
    const params = []

    if (!includeDisabled) {
      queryText += ' AND enabled = true'
    }

    if (hotelId) {
      queryText += ` AND (hotel_id = $${params.length + 1} OR hotel_id IS NULL)`
      params.push(hotelId)
    }

    if (departmentId) {
      queryText += ` AND (department_id = $${params.length + 1} OR department_id IS NULL)`
      params.push(departmentId)
    }

    queryText += ' ORDER BY hotel_id NULLS FIRST, department_id NULLS FIRST'

    const result = await query(queryText, params)

    // Add flags for UI
    return result.rows.map(rule => ({
      ...rule,
      isSystemRule: rule.hotel_id === null,
      isHotelRule: rule.hotel_id !== null && rule.department_id === null,
      isDepartmentRule: rule.department_id !== null
    }))
  }

  /**
   * Create or update notification rule
   */
  static async upsertRule(rule) {
    const id = rule.id || uuidv4()

    // Ensure channels is an array
    let channels = rule.channels || ['app']
    if (typeof channels === 'string') {
      try {
        channels = JSON.parse(channels)
      } catch (e) {
        logDebug('NotificationEngine', `Invalid channels format, using default: ${channels}`)
        channels = ['app']
      }
    }
    if (!Array.isArray(channels)) {
      logDebug('NotificationEngine', `Channels is not an array: ${typeof channels}, using default`)
      channels = ['app']
    }

    const channelsJson = JSON.stringify(channels)
    logDebug('NotificationEngine', `Saving rule ${id}: channels=${channelsJson}`)

    await query(`
      INSERT INTO notification_rules (
        id, hotel_id, department_id, type, name, description,
        warning_days, critical_days, channels, recipient_roles, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      ON CONFLICT (
        COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000'),
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'),
        type
      ) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        warning_days = EXCLUDED.warning_days,
        critical_days = EXCLUDED.critical_days,
        channels = EXCLUDED.channels,
        recipient_roles = EXCLUDED.recipient_roles,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `, [
      id,
      rule.hotelId || null,
      rule.departmentId || null,
      rule.type || 'expiry',
      rule.name,
      rule.description || null,
      rule.warningDays || 7,
      rule.criticalDays || 3,
      channelsJson,
      JSON.stringify(rule.recipientRoles || ['HOTEL_ADMIN', 'DEPARTMENT_MANAGER']),
      rule.enabled !== false
    ])

    return id
  }

  /**
   * Get notification statistics
   */
  static async getStats(hotelId, startDate = null, endDate = null) {
    let dateFilter = ''
    const params = [hotelId]
    let paramIndex = 2

    if (startDate) {
      dateFilter += ` AND DATE(created_at) >= $${paramIndex++}`
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ` AND DATE(created_at) <= $${paramIndex++}`
      params.push(endDate)
    }

    const result = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        type,
        DATE(created_at) as date
      FROM notifications
      WHERE hotel_id = $1 ${dateFilter}
      GROUP BY status, type, DATE(created_at)
      ORDER BY date DESC
    `, params)

    return result.rows
  }
}

export default NotificationEngine
