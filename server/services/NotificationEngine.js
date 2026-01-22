/**
 * FreshTrack Notification Engine
 * Phase 5: Centralized notification system with rules, retry, and deduplication
 * 
 * Features:
 * - NotificationRules: WHO, WHEN, WHERE to notify
 * - ExpiryService integration for batch analysis
 * - Retry logic with exponential backoff
 * - 24h deduplication to prevent spam
 * - Multi-channel: App, Telegram, Email
 */

import crypto from 'crypto'
import { query } from '../db/database.js'
import { v4 as uuidv4 } from 'uuid'
import { HOTEL_WIDE_ROLES } from '../utils/constants.js'
import { logError, logInfo, logDebug, logWarn } from '../utils/logger.js'
import { TelegramService } from './TelegramService.js'
import { getExpiryStatus, enrichBatchWithExpiryData } from './ExpiryService.js'

/**
 * Notification channels
 */
export const NotificationChannel = {
  APP: 'app',
  TELEGRAM: 'telegram',
  EMAIL: 'email'
}

/**
 * Notification types
 */
export const NotificationType = {
  EXPIRY_WARNING: 'expiry_warning',
  EXPIRY_CRITICAL: 'expiry_critical',
  EXPIRED: 'expired',
  LOW_STOCK: 'low_stock',
  COLLECTION_REMINDER: 'collection_reminder',
  SYSTEM_ALERT: 'system_alert'
}

/**
 * Delivery status
 */
export const DeliveryStatus = {
  PENDING: 'pending',
  SENDING: 'sending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETRY: 'retry'
}

/**
 * Priority levels
 */
export const Priority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
}

// Retry configuration
const MAX_RETRIES = 3
const RETRY_HOURS = [2, 4, 8] // Exponential backoff: 2h, 4h, 8h

/**
 * NotificationEngine - Centralized notification processing
 */
export class NotificationEngine {

  /**
   * Check all expiring batches and create notifications
   * Called by cron job (hourly)
   */
  static async checkExpiringBatches() {
    logInfo('NotificationEngine', '🔔 Starting expiry check...')

    try {
      // Get all enabled notification rules
      const rulesResult = await query(`
        SELECT * FROM notification_rules 
        WHERE enabled = true AND type = 'expiry'
        ORDER BY hotel_id NULLS FIRST
      `)

      const rules = rulesResult.rows
      logInfo('NotificationEngine', `📋 Found ${rules.length} active expiry rules`)

      let totalNotifications = 0

      for (const rule of rules) {
        const notifications = await this.processRule(rule)
        totalNotifications += notifications
      }

      logInfo('NotificationEngine', `✅ Expiry check complete. Created ${totalNotifications} notifications.`)
      return totalNotifications

    } catch (error) {
      logError('NotificationEngine', error)
      throw error
    }
  }

  /**
   * Process a single notification rule
   */
  static async processRule(rule) {
    // Build WHERE clause based on rule context
    let whereClause = "b.status = 'active'"
    const params = []
    let paramIndex = 1

    if (rule.hotel_id) {
      whereClause += ` AND b.hotel_id = $${paramIndex++}`
      params.push(rule.hotel_id)
    }

    if (rule.department_id) {
      whereClause += ` AND b.department_id = $${paramIndex++}`
      params.push(rule.department_id)
    }

    // Get batches within warning/critical threshold
    const batchesResult = await query(`
      SELECT 
        b.*,
        p.name as product_name,
        p.unit,
        d.name as department_name,
        c.name as category_name,
        (b.expiry_date - CURRENT_DATE) as days_left
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN departments d ON b.department_id = d.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
        AND b.expiry_date IS NOT NULL
        AND (b.expiry_date - CURRENT_DATE) <= $${paramIndex}
      ORDER BY b.expiry_date ASC
    `, [...params, rule.warning_days])

    const batches = batchesResult.rows
    let notificationsCreated = 0

    for (const batch of batches) {
      const daysLeft = parseInt(batch.days_left)

      // Determine notification type based on thresholds
      let type, priority
      if (daysLeft <= 0) {
        type = NotificationType.EXPIRED
        priority = Priority.URGENT
      } else if (daysLeft <= rule.critical_days) {
        type = NotificationType.EXPIRY_CRITICAL
        priority = Priority.HIGH
      } else if (daysLeft <= rule.warning_days) {
        type = NotificationType.EXPIRY_WARNING
        priority = Priority.NORMAL
      } else {
        continue // Outside thresholds
      }

      // Create notifications for all recipients
      const created = await this.createNotificationsForRecipients(rule, batch, type, priority, daysLeft)
      notificationsCreated += created
    }

    return notificationsCreated
  }

  /**
   * Create notifications for all recipients based on rule
   */
  static async createNotificationsForRecipients(rule, batch, type, priority, daysLeft) {
    const channels = typeof rule.channels === 'string'
      ? JSON.parse(rule.channels)
      : rule.channels

    const recipientRoles = typeof rule.recipient_roles === 'string'
      ? JSON.parse(rule.recipient_roles)
      : rule.recipient_roles

    let created = 0

    // Get users to notify
    const users = await this.getRecipientsForRule(rule, recipientRoles)

    for (const user of users) {
      for (const channel of channels) {
        // Check deduplication
        if (await this.isAlreadyNotified(batch.id, user.id, channel)) {
          continue
        }

        // Create notification
        await this.createNotification({
          hotelId: batch.hotel_id,
          userId: user.id,
          batchId: batch.id,
          ruleId: rule.id,
          type,
          channel,
          priority,
          title: this.getNotificationTitle(type, batch),
          message: this.getNotificationMessage(type, batch, daysLeft),
          data: {
            batchId: batch.id,
            productId: batch.product_id,
            productName: batch.product_name,
            departmentName: batch.department_name,
            quantity: batch.quantity,
            unit: batch.unit,
            expiryDate: batch.expiry_date,
            daysLeft
          }
        })

        created++
      }
    }

    // Also send to linked Telegram chats (if telegram channel is enabled)
    if (channels.includes(NotificationChannel.TELEGRAM)) {
      await this.sendToLinkedChats(batch, type, daysLeft)
    }

    return created
  }

  /**
   * Get recipients based on rule and roles
   */
  static async getRecipientsForRule(rule, recipientRoles) {
    let whereClause = 'u.is_active = true'
    const params = []
    let paramIndex = 1

    if (rule.hotel_id) {
      whereClause += ` AND u.hotel_id = $${paramIndex++}`
      params.push(rule.hotel_id)
    }

    if (rule.department_id) {
      whereClause += ` AND (u.department_id = $${paramIndex++} OR u.role = ANY($${paramIndex++}))`
      params.push(rule.department_id)
      params.push(HOTEL_WIDE_ROLES)
    }

    whereClause += ` AND u.role = ANY($${paramIndex++})`
    params.push(recipientRoles)

    const result = await query(`
      SELECT id, name, email, telegram_chat_id, role, department_id
      FROM users u
      WHERE ${whereClause}
        AND (email IS NULL OR (email_valid IS NOT FALSE AND email_blocked IS NOT TRUE))
    `, params)

    return result.rows
  }

  /**
   * Check if notification was already sent (24h deduplication)
   */
  static async isAlreadyNotified(batchId, userId, channel) {
    const hash = this.generateHash(batchId, userId, channel)

    const result = await query(`
      SELECT 1 FROM notifications 
      WHERE notification_hash = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status != 'failed'
      LIMIT 1
    `, [hash])

    return result.rows.length > 0
  }

  /**
   * Generate deduplication hash
   */
  static generateHash(batchId, userId, channel) {
    const date = new Date().toISOString().split('T')[0]
    return crypto.createHash('md5')
      .update(`${batchId}:${userId}:${channel}:${date}`)
      .digest('hex')
  }

  /**
   * Create a notification record
   */
  static async createNotification({
    hotelId, userId, batchId, ruleId, type, channel, priority, title, message, data
  }) {
    const id = uuidv4()
    const hash = this.generateHash(batchId, userId, channel)

    await query(`
      INSERT INTO notifications (
        id, hotel_id, user_id, batch_id, rule_id, type, title, message, 
        data, channels, priority, status, notification_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    `, [
      id,
      hotelId,
      userId,
      batchId,
      ruleId,
      type,
      title,
      message,
      JSON.stringify(data),
      JSON.stringify([channel]),
      priority,
      DeliveryStatus.PENDING,
      hash
    ])

    return id
  }

  /**
   * Send notification to linked Telegram chats
   */
  static async sendToLinkedChats(batch, type, daysLeft) {
    try {
      const notifType = type === NotificationType.EXPIRED ? 'expired'
        : type === NotificationType.EXPIRY_CRITICAL ? 'critical'
          : 'warning'

      await TelegramService.sendBatchNotification(
        {
          ...batch,
          daysLeft,
          productName: batch.product_name,
          departmentName: batch.department_name
        },
        notifType,
        batch.hotel_id,
        batch.department_id
      )
    } catch (error) {
      logError('NotificationEngine', error)
    }
  }

  /**
   * Process pending notification queue
   * Called by cron job (every 5 minutes)
   */
  static async processQueue() {
    logDebug('NotificationEngine', '📤 Processing notification queue...')

    try {
      // Get pending notifications ready to send
      const result = await query(`
        SELECT n.*, u.telegram_chat_id as user_telegram_id
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.status IN ('pending', 'retry')
          AND (n.next_retry_at IS NULL OR n.next_retry_at <= NOW())
        ORDER BY n.priority DESC, n.created_at ASC
        LIMIT 100
      `)

      const notifications = result.rows
      logDebug('NotificationEngine', `📬 Found ${notifications.length} notifications to process`)

      let delivered = 0
      let failed = 0

      for (const notification of notifications) {
        const success = await this.sendWithRetry(notification)
        if (success) delivered++
        else failed++
      }

      logInfo('NotificationEngine', `✅ Queue processed. Delivered: ${delivered}, Failed: ${failed}`)
      return { delivered, failed }

    } catch (error) {
      logError('NotificationEngine', error)
      throw error
    }
  }

  /**
   * Send notification with retry logic
   */
  static async sendWithRetry(notification) {
    try {
      // Update status to sending
      await query(
        "UPDATE notifications SET status = 'sending' WHERE id = $1",
        [notification.id]
      )

      // Check if batch was already written off (cancelled)
      if (notification.batch_id) {
        const batchCheck = await query(
          "SELECT status FROM batches WHERE id = $1",
          [notification.batch_id]
        )

        if (batchCheck.rows[0]?.status === 'written_off') {
          // Batch was collected/written off, mark notification as obsolete
          await query(`
            UPDATE notifications 
            SET status = 'failed', failure_reason = 'Batch already written off'
            WHERE id = $1
          `, [notification.id])
          return false
        }
      }

      // Dispatch based on channel
      const channels = typeof notification.channels === 'string'
        ? JSON.parse(notification.channels)
        : notification.channels

      for (const channel of channels) {
        await this.dispatch(notification, channel)
      }

      // Success
      await query(`
        UPDATE notifications 
        SET status = 'delivered', delivered_at = NOW()
        WHERE id = $1
      `, [notification.id])

      return true

    } catch (error) {
      // Handle retry
      const retryCount = (notification.retry_count || 0) + 1

      if (retryCount < MAX_RETRIES) {
        const hoursDelay = RETRY_HOURS[retryCount - 1] || RETRY_HOURS[RETRY_HOURS.length - 1]

        await query(`
          UPDATE notifications 
          SET status = 'retry', 
              retry_count = $1, 
              next_retry_at = NOW() + INTERVAL '1 hour' * $2,
              failure_reason = $3
          WHERE id = $4
        `, [retryCount, hoursDelay, error.message, notification.id])

        logDebug('NotificationEngine', `🔄 Notification ${notification.id} scheduled for retry ${retryCount}/${MAX_RETRIES}`)
      } else {
        await query(`
          UPDATE notifications 
          SET status = 'failed', 
              retry_count = $1,
              failure_reason = $2
          WHERE id = $3
        `, [retryCount, `Max retries exceeded: ${error.message}`, notification.id])

        logDebug('NotificationEngine', `❌ Notification ${notification.id} failed after ${MAX_RETRIES} retries`)
      }

      return false
    }
  }

  /**
   * Dispatch notification to specific channel
   */
  static async dispatch(notification, channel) {
    switch (channel) {
      case NotificationChannel.APP:
        // App notifications are stored in DB, already done
        return true

      case NotificationChannel.TELEGRAM:
        return this.dispatchTelegram(notification)

      case NotificationChannel.EMAIL:
        return this.dispatchEmail(notification)

      default:
        throw new Error(`Unknown channel: ${channel}`)
    }
  }

  /**
   * Dispatch to Telegram
   */
  static async dispatchTelegram(notification) {
    const chatId = notification.telegram_chat_id || notification.user_telegram_id

    if (!chatId) {
      throw new Error('User has no Telegram chat ID')
    }

    const message = this.formatTelegramMessage(notification)
    const result = await TelegramService.sendMessage(chatId, message)

    // Store message ID for potential edit/delete
    await query(
      'UPDATE notifications SET telegram_message_id = $1 WHERE id = $2',
      [result.message_id, notification.id]
    )

    return true
  }

  /**
   * Dispatch to Email
   */
  static async dispatchEmail(notification) {
    try {
      // Получаем email пользователя (проверяем статус)
      const userResult = await query(
        'SELECT email, name FROM users WHERE id = $1 AND email IS NOT NULL AND (email_valid IS NOT FALSE AND email_blocked IS NOT TRUE)',
        [notification.user_id]
      )

      if (userResult.rows.length === 0 || !userResult.rows[0].email) {
        throw new Error('User has no valid email address')
      }

      const user = userResult.rows[0]

      // Форматируем email сообщение
      const emailHtml = this.formatEmailMessage(notification, user)
      const emailText = this.formatEmailMessageText(notification, user)

      // Импортируем EmailService
      const { sendEmail, EMAIL_FROM } = await import('./EmailService.js')

      // Отправляем email через EmailService (по умолчанию использует system@)
      await sendEmail({
        to: user.email,
        from: EMAIL_FROM.system, // 99% писем идут от system@
        subject: notification.title || 'Уведомление FreshTrack',
        html: emailHtml,
        text: emailText
      })

      logInfo('NotificationEngine', `📧 Email sent to ${user.email}: ${notification.title}`)
      return true
    } catch (error) {
      logError('NotificationEngine', 'Failed to send email', error)
      throw error
    }
  }

  /**
   * Format notification as HTML email
   */
  static formatEmailMessage(notification, user) {
    const priorityColors = {
      critical: '#DC2626', // red
      warning: '#F59E0B', // amber
      info: '#3B82F6' // blue
    }

    const priority = notification.priority || 'info'
    const color = priorityColors[priority] || priorityColors.info
    const icon = priority === 'critical' ? '🔴' : priority === 'warning' ? '⚠️' : 'ℹ️'

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .header {
      border-left: 4px solid ${color};
      padding-left: 16px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 8px 0;
    }
    .priority {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: ${color}15;
      color: ${color};
      margin-top: 8px;
    }
    .content {
      margin: 24px 0;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
    }
    .details {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .detail-label {
      color: #6b7280;
      font-weight: 500;
    }
    .detail-value {
      color: #1f2937;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    .button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #FF8D6B;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${icon} ${notification.title || 'Уведомление FreshTrack'}</h1>
      <span class="priority">${priority.toUpperCase()}</span>
    </div>
    
    <div class="content">
      <div class="message">
        ${notification.message || ''}
      </div>
      
      ${notification.data ? `
      <div class="details">
        ${notification.data.productName ? `
        <div class="detail-row">
          <span class="detail-label">Продукт:</span>
          <span class="detail-value">${notification.data.productName}</span>
        </div>
        ` : ''}
        ${notification.data.quantity ? `
        <div class="detail-row">
          <span class="detail-label">Количество:</span>
          <span class="detail-value">${notification.data.quantity} ${notification.data.unit || 'шт'}</span>
        </div>
        ` : ''}
        ${notification.data.expiryDate ? `
        <div class="detail-row">
          <span class="detail-label">Срок годности:</span>
          <span class="detail-value">${notification.data.expiryDate}</span>
        </div>
        ` : ''}
        ${notification.data.daysLeft !== undefined ? `
        <div class="detail-row">
          <span class="detail-label">Осталось дней:</span>
          <span class="detail-value">${notification.data.daysLeft}</span>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>Это автоматическое уведомление от FreshTrack.</p>
      <p>Вы получили это письмо, так как являетесь получателем уведомлений о состоянии инвентаря.</p>
    </div>
  </div>
</body>
</html>
    `
  }

  /**
   * Format notification as plain text email
   */
  static formatEmailMessageText(notification, user) {
    let text = `${notification.title || 'Уведомление FreshTrack'}\n\n`
    text += `${notification.message || ''}\n\n`
    
    if (notification.data) {
      text += 'Детали:\n'
      if (notification.data.productName) {
        text += `Продукт: ${notification.data.productName}\n`
      }
      if (notification.data.quantity) {
        text += `Количество: ${notification.data.quantity} ${notification.data.unit || 'шт'}\n`
      }
      if (notification.data.expiryDate) {
        text += `Срок годности: ${notification.data.expiryDate}\n`
      }
      if (notification.data.daysLeft !== undefined) {
        text += `Осталось дней: ${notification.data.daysLeft}\n`
      }
    }
    
    text += '\n---\n'
    text += 'Это автоматическое уведомление от FreshTrack.'
    
    return text
  }

  /**
   * Format Telegram message
   */
  static formatTelegramMessage(notification) {
    const icon = notification.type === NotificationType.EXPIRED ? '❌'
      : notification.type === NotificationType.EXPIRY_CRITICAL ? '🚨'
        : notification.type === NotificationType.EXPIRY_WARNING ? '⚠️'
          : 'ℹ️'

    let message = `${icon} *${notification.title}*\n\n${notification.message}`

    const data = typeof notification.data === 'string'
      ? JSON.parse(notification.data)
      : notification.data

    if (data) {
      if (data.productName) message += `\n\n📦 *Продукт:* ${data.productName}`
      if (data.quantity) message += `\n📊 *Количество:* ${data.quantity} ${data.unit || 'шт'}`
      if (data.departmentName) message += `\n🏢 *Отдел:* ${data.departmentName}`
      if (data.expiryDate) message += `\n📅 *Срок:* ${data.expiryDate}`
    }

    return message
  }

  /**
   * Get notification title based on type
   */
  static getNotificationTitle(type, batch) {
    switch (type) {
      case NotificationType.EXPIRED:
        return `Продукт просрочен: ${batch.product_name}`
      case NotificationType.EXPIRY_CRITICAL:
        return `Критический срок: ${batch.product_name}`
      case NotificationType.EXPIRY_WARNING:
        return `Скоро истекает: ${batch.product_name}`
      default:
        return batch.product_name
    }
  }

  /**
   * Get notification message
   */
  static getNotificationMessage(type, batch, daysLeft) {
    const daysText = daysLeft === 0 ? 'сегодня'
      : daysLeft === 1 ? 'завтра'
        : daysLeft < 0 ? `${Math.abs(daysLeft)} дн. назад`
          : `через ${daysLeft} дн.`

    switch (type) {
      case NotificationType.EXPIRED:
        return `Партия "${batch.product_name}" (${batch.quantity} ${batch.unit || 'шт'}) просрочена. Требуется списание.`
      case NotificationType.EXPIRY_CRITICAL:
        return `Партия "${batch.product_name}" (${batch.quantity} ${batch.unit || 'шт'}) истекает ${daysText}. Срочно требуется внимание!`
      case NotificationType.EXPIRY_WARNING:
        return `Партия "${batch.product_name}" (${batch.quantity} ${batch.unit || 'шт'}) истекает ${daysText}.`
      default:
        return `${batch.product_name}: ${batch.quantity} ${batch.unit || 'шт'}`
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

    // Добавляем флаги для UI
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
        logWarn('NotificationEngine', `Invalid channels format, using default: ${channels}`)
        channels = ['app']
      }
    }
    if (!Array.isArray(channels)) {
      logWarn('NotificationEngine', `Channels is not an array: ${typeof channels}, using default`)
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
   * Send expiry warning emails to departments
   * Groups products by department and sends one email per department
   * Only sends if email channel is enabled
   */
  static async sendExpiryWarningEmails() {
    logInfo('NotificationEngine', '📧 Sending expiry warning emails...')

    try {
      // Check if email channel is enabled globally
      const emailEnabledResult = await query(`
        SELECT value FROM settings 
        WHERE key = 'notify.channels.email' AND scope = 'hotel'
        LIMIT 1
      `)
      
      const emailEnabled = emailEnabledResult.rows.length > 0 && 
        (emailEnabledResult.rows[0].value === 'true' || emailEnabledResult.rows[0].value === true)
      
      if (!emailEnabled) {
        logDebug('NotificationEngine', 'Email channel disabled, skipping expiry warning emails')
        return { sent: 0 }
      }

      // First, get all active expiry rules for debugging
      const allRulesResult = await query(`
        SELECT id, name, type, channels, enabled, hotel_id, department_id 
        FROM notification_rules 
        WHERE enabled = true AND type = 'expiry' AND hotel_id IS NOT NULL
      `)
      
      logDebug('NotificationEngine', `Found ${allRulesResult.rows.length} active expiry rules`)
      
      // Log channels for debugging
      for (const rule of allRulesResult.rows) {
        logDebug('NotificationEngine', `Rule ${rule.id} (${rule.name}): channels=${JSON.stringify(rule.channels)}, type=${typeof rule.channels}`)
      }
      
      // Get all active notification rules with email channel enabled
      // Try multiple SQL syntaxes for checking array membership
      let rulesResult
      try {
        // Method 1: Check if JSONB array contains string
        rulesResult = await query(`
          SELECT * FROM notification_rules 
          WHERE enabled = true 
            AND type = 'expiry'
            AND (channels::jsonb @> '"email"'::jsonb 
                 OR channels::jsonb ? 'email'
                 OR channels::jsonb @> '["email"]'::jsonb)
            AND hotel_id IS NOT NULL
        `)
      } catch (queryError) {
        logError('NotificationEngine', 'Error querying email rules, trying alternative syntax', queryError)
        // Fallback: Get all rules and filter in JS
        const allRules = await query(`
          SELECT * FROM notification_rules 
          WHERE enabled = true 
            AND type = 'expiry'
            AND hotel_id IS NOT NULL
        `)
        rulesResult = {
          rows: allRules.rows.filter(rule => {
            const channels = rule.channels
            if (!channels) return false
            // Handle both array and object formats
            if (Array.isArray(channels)) {
              return channels.includes('email')
            }
            if (typeof channels === 'string') {
              try {
                const parsed = JSON.parse(channels)
                return Array.isArray(parsed) && parsed.includes('email')
              } catch (e) {
                return false
              }
            }
            return false
          })
        }
      }

      logDebug('NotificationEngine', `Found ${rulesResult.rows.length} rules with email channel`)
      
      if (rulesResult.rows.length === 0) {
        logInfo('NotificationEngine', '📧 No active email rules found')
        logInfo('NotificationEngine', `💡 Hint: Make sure notification rule has 'email' in channels array: ["email", "telegram"]`)
        return { sent: 0 }
      }
      
      logInfo('NotificationEngine', `📧 Found ${rulesResult.rows.length} active email rules for expiry warnings`)

      let totalEmailsSent = 0

      for (const rule of rulesResult.rows) {
        try {
          // Get expiring batches for this rule's scope
          // warning_days comes from DB (safe to use in INTERVAL)
          const warningDays = parseInt(rule.warning_days) || 7
          const params = [rule.hotel_id]
          let queryText = `
            SELECT 
              b.id,
              b.product_id,
              b.department_id,
              b.expiry_date,
              b.quantity,
              b.unit,
              p.name as product_name,
              d.name as department_name,
              d.email as department_email,
              h.name as hotel_name,
              h.id as hotel_id,
              EXTRACT(DAY FROM (b.expiry_date - CURRENT_DATE))::INTEGER as days_until_expiry
            FROM batches b
            JOIN products p ON p.id = b.product_id
            LEFT JOIN departments d ON d.id = b.department_id
            LEFT JOIN hotels h ON h.id = b.hotel_id
            WHERE b.quantity > 0
              AND b.expiry_date IS NOT NULL
              AND b.expiry_date <= CURRENT_DATE + INTERVAL '${warningDays} days'
              AND b.expiry_date > CURRENT_DATE
              AND b.hotel_id = $1
          `
          
          if (rule.department_id) {
            params.push(rule.department_id)
            queryText += ` AND b.department_id = $${params.length}`
          }
          
          queryText += ` ORDER BY b.expiry_date ASC, d.name, p.name`
          
          const batchesResult = await query(queryText, params)

          const batches = batchesResult.rows

          if (batches.length === 0) {
            logDebug('NotificationEngine', `No expiring products for rule ${rule.id}`)
            continue
          }

          // Group batches by department
          const byDepartment = {}
          for (const batch of batches) {
            const deptId = batch.department_id || 'no-department'
            if (!byDepartment[deptId]) {
              byDepartment[deptId] = {
                department: {
                  id: batch.department_id,
                  name: batch.department_name || 'Без отдела',
                  email: batch.department_email || null
                },
                hotel: { id: batch.hotel_id, name: batch.hotel_name },
                products: []
              }
            }
            byDepartment[deptId].products.push(batch)
          }

          const { sendExpiryWarningEmail, resolveEmailRecipient } = await import('./EmailService.js')

          for (const [deptId, deptData] of Object.entries(byDepartment)) {
            // Skip batches without a department (no department inbox)
            if (deptId === 'no-department') {
              logDebug('NotificationEngine', 'Skipping expiry email for batches without department')
              continue
            }

            const to = resolveEmailRecipient('DEPARTMENT', { department: deptData.department })
            if (!to) continue

            await sendExpiryWarningEmail({
              products: deptData.products,
              department: deptData.department,
              hotel: deptData.hotel,
              to
            })

            totalEmailsSent++
            logInfo('NotificationEngine', `📧 Sent expiry warning email to ${to} for department ${deptData.department.name}`)
          }

        } catch (error) {
          logError('NotificationEngine', `Failed to send expiry warnings for rule ${rule.id}`, error)
          // Continue with other rules
        }
      }

      logInfo('NotificationEngine', `✅ Expiry warning emails sent: ${totalEmailsSent}`)
      return { sent: totalEmailsSent }

    } catch (error) {
      logError('NotificationEngine', 'Failed to send expiry warning emails', error)
      return { sent: 0, error: error.message }
    }
  }

  /**
   * Send daily reports to all linked Telegram chats and email
   * Generates summary of inventory status for each hotel
   */
  static async sendDailyReports() {
    logInfo('NotificationEngine', '📊 Generating daily reports...')

    try {
      // 1. Send Telegram reports (existing logic)
      let telegramReportsSent = 0

      // Get all active linked chats
      const chatsResult = await query(`
        SELECT DISTINCT tc.chat_id, tc.hotel_id, tc.department_id, tc.chat_title,
               h.name as hotel_name, d.name as department_name
        FROM telegram_chats tc
        LEFT JOIN hotels h ON h.id = tc.hotel_id
        LEFT JOIN departments d ON d.id = tc.department_id
        WHERE tc.is_active = true AND tc.hotel_id IS NOT NULL
      `)

      let totalReportsSent = 0

      for (const chat of chatsResult.rows) {
        try {
          // Get inventory summary for this hotel/department
          const statsQuery = chat.department_id
            ? `
              SELECT 
                COUNT(*) FILTER (WHERE expiry_date > NOW() + INTERVAL '7 days') as good,
                COUNT(*) FILTER (WHERE expiry_date <= NOW() + INTERVAL '7 days' AND expiry_date > NOW()) as warning,
                COUNT(*) FILTER (WHERE expiry_date <= NOW()) as expired
              FROM batches b
              JOIN products p ON p.id = b.product_id
              WHERE b.hotel_id = $1 AND p.department_id = $2 AND b.quantity > 0
            `
            : `
              SELECT 
                COUNT(*) FILTER (WHERE expiry_date > NOW() + INTERVAL '7 days') as good,
                COUNT(*) FILTER (WHERE expiry_date <= NOW() + INTERVAL '7 days' AND expiry_date > NOW()) as warning,
                COUNT(*) FILTER (WHERE expiry_date <= NOW()) as expired
              FROM batches b
              WHERE b.hotel_id = $1 AND b.quantity > 0
            `

          const params = chat.department_id ? [chat.hotel_id, chat.department_id] : [chat.hotel_id]
          const statsResult = await query(statsQuery, params)
          const stats = statsResult.rows[0] || { good: 0, warning: 0, expired: 0 }

          // Check if Telegram channel is enabled
          const telegramEnabledResult = await query(`
            SELECT value FROM settings 
            WHERE key = 'notify.channels.telegram' AND hotel_id = $1
            LIMIT 1
          `, [chat.hotel_id])
          
          const telegramEnabled = telegramEnabledResult.rows.length === 0 || 
            (telegramEnabledResult.rows[0].value !== 'false' && telegramEnabledResult.rows[0].value !== false)
          
          if (!telegramEnabled) {
            logDebug('NotificationEngine', `Telegram channel disabled for hotel ${chat.hotel_id}, skipping`)
            continue
          }

          // Get unified message template from settings (prefer notify.templates, fallback to telegram_message_templates)
          const templatesResult = await query(`
            SELECT value FROM settings 
            WHERE key IN ('notify.templates', 'telegram_message_templates') AND hotel_id = $1
            ORDER BY CASE WHEN key = 'notify.templates' THEN 1 ELSE 2 END
            LIMIT 1
          `, [chat.hotel_id])

          let templateSettings = {}
          if (templatesResult.rows.length > 0) {
            try {
              templateSettings = JSON.parse(templatesResult.rows[0].value)
            } catch { }
          }

          const template = templateSettings.dailyReport ||
            '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}'

          // Generate message
          const location = chat.department_name
            ? `🏨 ${chat.hotel_name} → 🏢 ${chat.department_name}`
            : `🏨 ${chat.hotel_name}`

          const message = `${location}\n\n${template
            .replace('{good}', stats.good || 0)
            .replace('{warning}', stats.warning || 0)
            .replace('{expired}', stats.expired || 0)}`

          // Send via TelegramService
          await TelegramService.sendMessage(chat.chat_id, message)
          totalReportsSent++

          logInfo('NotificationEngine', `📤 Daily report sent to ${chat.chat_title || chat.chat_id}`)
        } catch (chatError) {
          logError('NotificationEngine', `Failed to send daily report to chat ${chat.chat_id}`, chatError)
        }
      }

      telegramReportsSent = totalReportsSent

      // 2. Send email daily reports (system emails → department.email, one per department)
      // Only if email channel is enabled
      let emailReportsSent = 0
      try {
        // Check if email channel is enabled globally
        const emailEnabledResult = await query(`
          SELECT value FROM settings 
          WHERE key = 'notify.channels.email' AND scope = 'hotel'
          LIMIT 1
        `)
        
        const emailEnabled = emailEnabledResult.rows.length > 0 && 
          (emailEnabledResult.rows[0].value === 'true' || emailEnabledResult.rows[0].value === true)
        
        if (!emailEnabled) {
          logDebug('NotificationEngine', 'Email channel disabled, skipping email daily reports')
        } else {
          const deptsResult = await query(`
            SELECT d.id, d.name, d.email, d.hotel_id, h.name as hotel_name
            FROM departments d
            JOIN hotels h ON h.id = d.hotel_id
            WHERE d.is_active = true AND h.is_active = true
              AND d.email IS NOT NULL AND TRIM(d.email) != ''
          `)

          const { sendDailyReportEmail, resolveEmailRecipient } = await import('./EmailService.js')

          for (const row of deptsResult.rows) {
            const department = { id: row.id, name: row.name, email: row.email }
            const hotel = { id: row.hotel_id, name: row.hotel_name }
            const to = resolveEmailRecipient('DEPARTMENT', { department })
            if (!to) continue

            try {
              const statsResult = await query(`
                SELECT 
                  COUNT(*) FILTER (WHERE b.expiry_date > CURRENT_DATE) as total_batches,
                  COUNT(*) FILTER (WHERE b.expiry_date <= CURRENT_DATE + INTERVAL '7 days' AND b.expiry_date > CURRENT_DATE) as expiring_batches,
                  COUNT(*) FILTER (WHERE b.expiry_date <= CURRENT_DATE) as expired_batches,
                  (
                    SELECT COUNT(*)::int
                    FROM collection_history ch
                    WHERE ch.hotel_id = $1 AND ch.department_id = $2
                      AND DATE(ch.collected_at) = CURRENT_DATE
                  ) as collections_today
                FROM batches b
                WHERE b.hotel_id = $1 AND b.department_id = $2 AND b.quantity > 0
              `, [row.hotel_id, row.id])

              const s = statsResult.rows[0] || {
                total_batches: 0,
                expiring_batches: 0,
                expired_batches: 0,
                collections_today: 0
              }

              await sendDailyReportEmail({
                stats: {
                  totalBatches: parseInt(s.total_batches) || 0,
                  expiringBatches: parseInt(s.expiring_batches) || 0,
                  expiredBatches: parseInt(s.expired_batches) || 0,
                  collectionsToday: parseInt(s.collections_today) || 0,
                  hotel,
                  department
                },
                to
              })
              emailReportsSent++
              logInfo('NotificationEngine', `📧 Daily report sent to ${to} for department ${department.name}`)
            } catch (emailError) {
              logError('NotificationEngine', `Failed to send daily report to ${to} (${department.name})`, emailError)
            }
          }
        }
      } catch (error) {
        logError('NotificationEngine', 'Failed to send email daily reports', error)
      }

      logInfo('NotificationEngine', `✅ Daily reports complete. Telegram: ${telegramReportsSent}, Email: ${emailReportsSent}`)
      return { 
        sent: telegramReportsSent + emailReportsSent,
        telegram: telegramReportsSent,
        email: emailReportsSent
      }
    } catch (error) {
      logError('NotificationEngine', 'Daily reports failed', error)
      throw error
    }
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


