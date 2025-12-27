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
    console.log('🔔 Starting expiry check...')
    
    try {
      // Get all enabled notification rules
      const rulesResult = await query(`
        SELECT * FROM notification_rules 
        WHERE enabled = true AND type = 'expiry'
        ORDER BY hotel_id NULLS FIRST
      `)
      
      const rules = rulesResult.rows
      console.log(`📋 Found ${rules.length} active expiry rules`)
      
      let totalNotifications = 0
      
      for (const rule of rules) {
        const notifications = await this.processRule(rule)
        totalNotifications += notifications
      }
      
      console.log(`✅ Expiry check complete. Created ${totalNotifications} notifications.`)
      return totalNotifications
      
    } catch (error) {
      console.error('❌ Expiry check failed:', error)
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
      whereClause += ` AND (u.department_id = $${paramIndex++} OR u.role IN ('HOTEL_ADMIN', 'SUPER_ADMIN'))`
      params.push(rule.department_id)
    }
    
    whereClause += ` AND u.role = ANY($${paramIndex++})`
    params.push(recipientRoles)
    
    const result = await query(`
      SELECT id, name, email, telegram_chat_id, role, department_id
      FROM users u
      WHERE ${whereClause}
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
      console.error('Failed to send to linked chats:', error)
    }
  }
  
  /**
   * Process pending notification queue
   * Called by cron job (every 5 minutes)
   */
  static async processQueue() {
    console.log('📤 Processing notification queue...')
    
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
      console.log(`📬 Found ${notifications.length} notifications to process`)
      
      let delivered = 0
      let failed = 0
      
      for (const notification of notifications) {
        const success = await this.sendWithRetry(notification)
        if (success) delivered++
        else failed++
      }
      
      console.log(`✅ Queue processed. Delivered: ${delivered}, Failed: ${failed}`)
      return { delivered, failed }
      
    } catch (error) {
      console.error('❌ Queue processing failed:', error)
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
        
        console.log(`🔄 Notification ${notification.id} scheduled for retry ${retryCount}/${MAX_RETRIES}`)
      } else {
        await query(`
          UPDATE notifications 
          SET status = 'failed', 
              retry_count = $1,
              failure_reason = $2
          WHERE id = $3
        `, [retryCount, `Max retries exceeded: ${error.message}`, notification.id])
        
        console.log(`❌ Notification ${notification.id} failed after ${MAX_RETRIES} retries`)
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
        // TODO: Implement email
        console.log('📧 Email notifications not yet implemented')
        return true
        
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
   */
  static async getRules(hotelId = null) {
    let queryText = 'SELECT * FROM notification_rules WHERE enabled = true'
    const params = []
    
    if (hotelId) {
      queryText += ' AND (hotel_id = $1 OR hotel_id IS NULL)'
      params.push(hotelId)
    }
    
    queryText += ' ORDER BY hotel_id NULLS FIRST, department_id NULLS FIRST'
    
    const result = await query(queryText, params)
    return result.rows
  }
  
  /**
   * Create or update notification rule
   */
  static async upsertRule(rule) {
    const id = rule.id || uuidv4()
    
    await query(`
      INSERT INTO notification_rules (
        id, hotel_id, department_id, type, name, description,
        warning_days, critical_days, channels, recipient_roles, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      JSON.stringify(rule.channels || ['app']),
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
