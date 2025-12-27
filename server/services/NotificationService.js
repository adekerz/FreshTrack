/**
 * FreshTrack Notification Service
 * Centralized notification engine with queue, retry logic, and multi-channel support
 * 
 * Channels: App (in-app), Telegram, Email (future)
 * Features: Queue management, retry with exponential backoff, delivery tracking
 */

import { query } from '../db/database.js'
import { sendCustomMessage } from './telegram.js'

/**
 * Notification channels
 */
export const NotificationChannel = {
  APP: 'app',         // In-app notifications
  TELEGRAM: 'telegram', // Telegram bot
  EMAIL: 'email'      // Email (future)
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
  SYSTEM_ALERT: 'system_alert',
  USER_ACTION: 'user_action'
}

/**
 * Notification priority levels
 */
export const NotificationPriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
}

/**
 * Delivery status
 */
export const DeliveryStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  SENDING: 'sending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETRY: 'retry'
}

// In-memory queue for notifications
const notificationQueue = []
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s

/**
 * Notification Service class
 */
export class NotificationService {
  
  /**
   * Create and queue a notification
   * @param {Object} notification - Notification data
   * @returns {Object} - Created notification
   */
  static async create(notification) {
    const {
      hotelId,
      userId,
      type,
      title,
      message,
      data = {},
      channels = [NotificationChannel.APP],
      priority = NotificationPriority.NORMAL
    } = notification
    
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const notif = {
      id,
      hotel_id: hotelId,
      user_id: userId,
      type,
      title,
      message,
      data,
      channels,
      priority,
      status: DeliveryStatus.PENDING,
      retries: 0,
      created_at: new Date().toISOString(),
      delivered_at: null,
      error: null
    }
    
    // Save to database
    try {
      await this.saveToDb(notif)
    } catch (error) {
      console.error('Failed to save notification to DB:', error)
      // Continue - notification will still be processed from memory
    }
    
    // Add to queue
    notificationQueue.push(notif)
    
    // Process immediately if high priority
    if (priority >= NotificationPriority.HIGH) {
      setImmediate(() => this.processNext())
    }
    
    return notif
  }
  
  /**
   * Save notification to database
   */
  static async saveToDb(notification) {
    try {
      await query(`
        INSERT INTO notifications (
          id, hotel_id, user_id, type, title, message, data, 
          channels, priority, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          delivered_at = EXCLUDED.delivered_at,
          error = EXCLUDED.error,
          retries = EXCLUDED.retries
      `, [
        notification.id,
        notification.hotel_id,
        notification.user_id,
        notification.type,
        notification.title,
        notification.message,
        JSON.stringify(notification.data),
        JSON.stringify(notification.channels),
        notification.priority,
        notification.status,
        notification.created_at
      ])
    } catch (error) {
      // Table might not exist - gracefully handle
      if (!error.message?.includes('does not exist')) {
        throw error
      }
    }
  }
  
  /**
   * Send notification through specified channels
   * @param {Object} notification - Notification to send
   * @returns {Object} - Delivery results per channel
   */
  static async send(notification) {
    const results = {}
    
    for (const channel of notification.channels) {
      try {
        switch (channel) {
          case NotificationChannel.APP:
            results[channel] = await this.sendAppNotification(notification)
            break
            
          case NotificationChannel.TELEGRAM:
            results[channel] = await this.sendTelegramNotification(notification)
            break
            
          case NotificationChannel.EMAIL:
            results[channel] = await this.sendEmailNotification(notification)
            break
            
          default:
            results[channel] = { success: false, error: `Unknown channel: ${channel}` }
        }
      } catch (error) {
        results[channel] = { success: false, error: error.message }
      }
    }
    
    return results
  }
  
  /**
   * Send in-app notification (stored for polling/WebSocket)
   */
  static async sendAppNotification(notification) {
    // In-app notifications are stored in DB and fetched by frontend
    notification.status = DeliveryStatus.DELIVERED
    notification.delivered_at = new Date().toISOString()
    await this.saveToDb(notification)
    return { success: true, channel: NotificationChannel.APP }
  }
  
  /**
   * Send Telegram notification
   */
  static async sendTelegramNotification(notification) {
    try {
      // Get user's Telegram chat ID
      const userResult = await query(
        'SELECT telegram_chat_id FROM users WHERE id = $1',
        [notification.user_id]
      )
      
      const chatId = userResult.rows[0]?.telegram_chat_id
      if (!chatId) {
        return { success: false, error: 'User has no Telegram chat ID' }
      }
      
      // Format message for Telegram
      const telegramMessage = this.formatTelegramMessage(notification)
      
      // Send via telegram service
      await sendCustomMessage(telegramMessage)
      
      return { success: true, channel: NotificationChannel.TELEGRAM }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  /**
   * Send email notification (stub for future implementation)
   */
  static async sendEmailNotification(notification) {
    // TODO: Implement email sending
    return { success: false, error: 'Email notifications not yet implemented' }
  }
  
  /**
   * Format notification for Telegram
   */
  static formatTelegramMessage(notification) {
    const icon = this.getNotificationIcon(notification.type)
    let message = `${icon} *${notification.title}*\n\n${notification.message}`
    
    // Add data details if present
    if (notification.data) {
      if (notification.data.productName) {
        message += `\n📦 Продукт: ${notification.data.productName}`
      }
      if (notification.data.quantity) {
        message += `\n📊 Количество: ${notification.data.quantity}`
      }
      if (notification.data.expiryDate) {
        message += `\n📅 Срок: ${notification.data.expiryDate}`
      }
      if (notification.data.daysLeft !== undefined) {
        message += `\n⏰ Осталось дней: ${notification.data.daysLeft}`
      }
    }
    
    return message
  }
  
  /**
   * Get icon for notification type
   */
  static getNotificationIcon(type) {
    const icons = {
      [NotificationType.EXPIRY_WARNING]: '⚠️',
      [NotificationType.EXPIRY_CRITICAL]: '🔴',
      [NotificationType.EXPIRED]: '❌',
      [NotificationType.LOW_STOCK]: '📉',
      [NotificationType.COLLECTION_REMINDER]: '🔔',
      [NotificationType.SYSTEM_ALERT]: '🔧',
      [NotificationType.USER_ACTION]: '👤'
    }
    return icons[type] || '📌'
  }
  
  /**
   * Process next notification in queue
   */
  static async processNext() {
    if (notificationQueue.length === 0) return
    
    const notification = notificationQueue.shift()
    notification.status = DeliveryStatus.SENDING
    
    try {
      const results = await this.send(notification)
      
      // Check if all channels succeeded
      const allSucceeded = Object.values(results).every(r => r.success)
      
      if (allSucceeded) {
        notification.status = DeliveryStatus.DELIVERED
        notification.delivered_at = new Date().toISOString()
      } else {
        // Handle partial or complete failure
        const allFailed = Object.values(results).every(r => !r.success)
        
        if (allFailed && notification.retries < MAX_RETRIES) {
          // Schedule retry with exponential backoff
          notification.retries++
          notification.status = DeliveryStatus.RETRY
          notification.error = Object.values(results).map(r => r.error).filter(Boolean).join('; ')
          
          const delay = RETRY_DELAYS[notification.retries - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
          setTimeout(() => {
            notificationQueue.push(notification)
            this.processNext()
          }, delay)
        } else {
          notification.status = allFailed ? DeliveryStatus.FAILED : DeliveryStatus.DELIVERED
          notification.error = Object.values(results).map(r => r.error).filter(Boolean).join('; ')
        }
      }
      
      // Update in DB
      await this.saveToDb(notification)
      
    } catch (error) {
      notification.status = DeliveryStatus.FAILED
      notification.error = error.message
      await this.saveToDb(notification)
    }
    
    // Process next if queue not empty
    if (notificationQueue.length > 0) {
      setImmediate(() => this.processNext())
    }
  }
  
  /**
   * Get pending notifications for user (for frontend polling)
   */
  static async getPendingForUser(userId, options = {}) {
    const { limit = 50, since } = options
    
    let queryText = `
      SELECT * FROM notifications 
      WHERE user_id = $1 AND status = 'delivered' AND channels::text LIKE '%app%'
    `
    const params = [userId]
    let paramIndex = 2
    
    if (since) {
      queryText += ` AND created_at > $${paramIndex++}`
      params.push(since)
    }
    
    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(limit)
    
    try {
      const result = await query(queryText, params)
      return result.rows
    } catch (error) {
      console.error('Failed to get notifications:', error)
      return []
    }
  }
  
  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      await query(`
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId])
      return true
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      return false
    }
  }
  
  /**
   * Create batch expiry notifications
   */
  static async createExpiryNotifications(batches, hotelId) {
    const notifications = []
    
    for (const batch of batches) {
      const type = batch.daysLeft <= 0 
        ? NotificationType.EXPIRED
        : batch.daysLeft <= 3
          ? NotificationType.EXPIRY_CRITICAL
          : NotificationType.EXPIRY_WARNING
      
      const priority = type === NotificationType.EXPIRED
        ? NotificationPriority.URGENT
        : type === NotificationType.EXPIRY_CRITICAL
          ? NotificationPriority.HIGH
          : NotificationPriority.NORMAL
      
      // Get users to notify (department managers and hotel admins)
      const usersToNotify = await this.getUsersToNotify(hotelId, batch.department_id)
      
      for (const user of usersToNotify) {
        const notif = await this.create({
          hotelId,
          userId: user.id,
          type,
          title: this.getExpiryTitle(type, batch),
          message: this.getExpiryMessage(type, batch),
          data: {
            batchId: batch.id,
            productId: batch.product_id,
            productName: batch.product_name,
            quantity: batch.quantity,
            expiryDate: batch.expiry_date,
            daysLeft: batch.daysLeft
          },
          channels: user.telegram_chat_id 
            ? [NotificationChannel.APP, NotificationChannel.TELEGRAM]
            : [NotificationChannel.APP],
          priority
        })
        
        notifications.push(notif)
      }
    }
    
    return notifications
  }
  
  /**
   * Get users to notify for a department
   */
  static async getUsersToNotify(hotelId, departmentId) {
    try {
      const result = await query(`
        SELECT id, telegram_chat_id FROM users 
        WHERE hotel_id = $1 
        AND is_active = true
        AND (
          role IN ('HOTEL_ADMIN', 'SUPER_ADMIN')
          OR (role = 'DEPARTMENT_MANAGER' AND department_id = $2)
        )
      `, [hotelId, departmentId])
      return result.rows
    } catch (error) {
      console.error('Failed to get users to notify:', error)
      return []
    }
  }
  
  /**
   * Get expiry notification title
   */
  static getExpiryTitle(type, batch) {
    switch (type) {
      case NotificationType.EXPIRED:
        return `❌ Продукт просрочен: ${batch.product_name}`
      case NotificationType.EXPIRY_CRITICAL:
        return `🔴 Критический срок: ${batch.product_name}`
      case NotificationType.EXPIRY_WARNING:
        return `⚠️ Скоро истекает: ${batch.product_name}`
      default:
        return `📦 ${batch.product_name}`
    }
  }
  
  /**
   * Get expiry notification message
   */
  static getExpiryMessage(type, batch) {
    const daysText = batch.daysLeft === 0 
      ? 'сегодня'
      : batch.daysLeft === 1
        ? 'завтра'
        : `через ${batch.daysLeft} дн.`
    
    switch (type) {
      case NotificationType.EXPIRED:
        return `Партия "${batch.product_name}" (${batch.quantity} шт.) просрочена. Требуется списание.`
      case NotificationType.EXPIRY_CRITICAL:
        return `Партия "${batch.product_name}" (${batch.quantity} шт.) истекает ${daysText}. Срочно требуется внимание!`
      case NotificationType.EXPIRY_WARNING:
        return `Партия "${batch.product_name}" (${batch.quantity} шт.) истекает ${daysText}.`
      default:
        return `${batch.product_name}: ${batch.quantity} шт.`
    }
  }
  
  /**
   * Start queue processor (call on app startup)
   */
  static startQueueProcessor(intervalMs = 5000) {
    setInterval(() => {
      if (notificationQueue.length > 0) {
        this.processNext()
      }
    }, intervalMs)
    
    console.log('📬 Notification queue processor started')
  }
  
  /**
   * Get queue status
   */
  static getQueueStatus() {
    return {
      queueLength: notificationQueue.length,
      pending: notificationQueue.filter(n => n.status === DeliveryStatus.PENDING).length,
      retry: notificationQueue.filter(n => n.status === DeliveryStatus.RETRY).length
    }
  }
}

export default NotificationService
