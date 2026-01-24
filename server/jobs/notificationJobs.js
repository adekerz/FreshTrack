/**
 * FreshTrack Notification Jobs
 * Background jobs for notification processing
 * 
 * Schedule:
 * - Daily report: At configured sendTime (default 09:00)
 *   Notifications are sent only once per day as an aggregated report
 *   No per-item or real-time alerts by design (anti-spam UX)
 * - Telegram polling: Continuous (for development)
 */

import cron from 'node-cron'
import { NotificationEngine } from '../services/NotificationEngine.js'
import { TelegramService } from '../services/TelegramService.js'
import { logInfo, logError, logDebug, logWarn } from '../utils/logger.js'
import { query } from '../db/postgres.js'

let dailyReportJob = null
let telegramPolling = false
let currentSendTime = '09:00'
let currentTimezone = null // Будет определяться автоматически

/**
 * Get timezone for notifications
 * Priority: Hotel timezone → Settings timezone → System timezone
 */
async function getTimezone() {
  try {
    // 1. Пытаемся получить из настроек отеля (если есть активный отель)
    const settingsResult = await query(`
      SELECT value FROM settings 
      WHERE key IN ('locale.timezone', 'display.timezone')
      AND (hotel_id IS NULL OR scope = 'system')
      ORDER BY 
        CASE WHEN key = 'locale.timezone' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST
      LIMIT 1
    `)
    
    if (settingsResult.rows.length > 0) {
      try {
        const timezone = JSON.parse(settingsResult.rows[0].value)
        if (typeof timezone === 'string' && timezone) {
          logDebug('getTimezone', `✅ Found timezone from settings: ${timezone}`)
          return timezone
        }
      } catch {
        const timezone = settingsResult.rows[0].value
        if (timezone && typeof timezone === 'string') {
          logDebug('getTimezone', `✅ Found timezone from settings: ${timezone}`)
          return timezone
        }
      }
    }
    
    // 2. Пытаемся получить из таблицы hotels (первый активный отель)
    const hotelResult = await query(`
      SELECT timezone FROM hotels 
      WHERE is_active = true AND timezone IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1
    `)
    
    if (hotelResult.rows.length > 0 && hotelResult.rows[0].timezone) {
      const timezone = hotelResult.rows[0].timezone
      logDebug('getTimezone', `✅ Found timezone from hotel: ${timezone}`)
      return timezone
    }
    
    // 3. Используем системный часовой пояс сервера
    try {
      const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      logDebug('getTimezone', `✅ Using system timezone: ${systemTimezone}`)
      return systemTimezone
    } catch {
      // 4. Fallback на Asia/Almaty если ничего не найдено
      logWarn('getTimezone', '⚠️ Could not determine timezone, using fallback: Asia/Almaty')
      return 'Asia/Almaty'
    }
  } catch (error) {
    logError('getTimezone', error)
    // Fallback
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty'
    } catch {
      return 'Asia/Almaty'
    }
  }
}

/**
 * Convert time string (HH:MM) to cron expression for daily run
 */
function timeToCronExpression(timeStr) {
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number)
  return `${minutes || 0} ${hours || 9} * * *`
}

/**
 * Get daily send time from settings
 */
async function getDailySendTime() {
  logDebug('getDailySendTime', '🔍 Starting search for send time...')
  
  try {
    // Проверяем ВСЕ возможные ключи напрямую из БД
    logDebug('getDailySendTime', '📊 Querying database for send time...')
    
    // Получаем все записи с нужными ключами
    const dbCheck = await query(`
      SELECT key, value, scope, hotel_id, updated_at 
      FROM settings 
      WHERE key IN ('notify.telegram.sendTime', 'notify.sendTime')
      ORDER BY 
        CASE scope 
          WHEN 'system' THEN 1 
          WHEN 'hotel' THEN 2 
          ELSE 3 
        END,
        CASE WHEN key = 'notify.telegram.sendTime' THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST
    `)
    
    logDebug('getDailySendTime', `🗄️ Direct DB check found ${dbCheck.rows.length} records:`)
    dbCheck.rows.forEach((row, idx) => {
      logDebug('getDailySendTime', `  [${idx + 1}] key="${row.key}", scope="${row.scope}", value="${row.value}", hotel_id="${row.hotel_id}"`)
    })
    
    // Приоритет: notify.telegram.sendTime (system) > notify.sendTime (system) > остальное
    const result = await query(
      `SELECT value FROM settings 
       WHERE key IN ('notify.telegram.sendTime', 'notify.sendTime') 
       AND (hotel_id IS NULL OR scope = 'system')
       ORDER BY 
         CASE WHEN key = 'notify.telegram.sendTime' THEN 0 ELSE 1 END,
         CASE scope 
           WHEN 'system' THEN 0 
           ELSE 1 
         END,
         updated_at DESC NULLS LAST
       LIMIT 1`
    )
    
    if (result.rows.length > 0) {
      let sendTime = null
      
      try {
        // Try to parse as JSON first (in case it's wrapped in quotes)
        const parsed = JSON.parse(result.rows[0].value)
        sendTime = typeof parsed === 'string' ? parsed : null
      } catch {
        // If not JSON, return as-is
        const value = result.rows[0].value
        // Validate time format HH:MM
        if (value && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
          sendTime = value
        }
      }
      
      if (sendTime) {
        logInfo('getDailySendTime', `✅ Resolved send time: ${sendTime}`)
        return sendTime
      } else {
        logWarn('getDailySendTime', `⚠️ Invalid time format from DB: "${result.rows[0].value}", using default`)
      }
    } else {
      logDebug('getDailySendTime', '📭 No send time found in database, using default')
    }
    
    const defaultTime = '09:00'
    logInfo('getDailySendTime', `✅ Using default send time: ${defaultTime}`)
    return defaultTime
  } catch (error) {
    logError('getDailySendTime', error)
    logInfo('getDailySendTime', '✅ Falling back to default: 09:00')
    return '09:00'
  }
}

/**
 * Reschedule daily report job with new time
 */
export async function rescheduleDailyReport() {
  logInfo('rescheduleDailyReport', '🔄 Starting reschedule...')
  
  try {
    const newSendTime = await getDailySendTime()
    const timezone = await getTimezone()
    
    logInfo('rescheduleDailyReport', `⏰ New send time: ${newSendTime}`)
    logInfo('rescheduleDailyReport', `🌍 Timezone: ${timezone}`)
    
    // Валидация формата
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newSendTime)) {
      throw new Error(`Invalid time format: ${newSendTime}. Expected HH:MM`)
    }
    
    logInfo('rescheduleDailyReport', `📅 Send time from DB: "${newSendTime}", current: "${currentSendTime}"`)

    // Проверяем, нужно ли перепланировать
    if (newSendTime === currentSendTime && timezone === currentTimezone && dailyReportJob) {
      logInfo('rescheduleDailyReport', `✅ Send time and timezone unchanged: ${currentSendTime} (${currentTimezone}), no reschedule needed`)
      return
    }

    const cronExpr = timeToCronExpression(newSendTime)
    logInfo('rescheduleDailyReport', `📅 Cron expression: ${cronExpr}`)

    // Останавливаем старую задачу
    if (dailyReportJob) {
      logDebug('rescheduleDailyReport', '🛑 Stopping existing job...')
      dailyReportJob.stop()
      dailyReportJob = null
      logDebug('rescheduleDailyReport', '✅ Old job stopped')
    }

    // Обновляем текущее время и часовой пояс
    currentSendTime = newSendTime
    currentTimezone = timezone

    // Создаем новую задачу
    logDebug('rescheduleDailyReport', '🔨 Creating new cron job...')
    
    dailyReportJob = cron.schedule(cronExpr, async () => {
      logInfo('dailyReportJob', `🔔 Daily report job triggered at ${new Date().toISOString()}`)
      
      try {
        // Notifications are sent only once per day as an aggregated report
        // No per-item or real-time alerts by design (anti-spam UX)
        logInfo('dailyReportJob', '📊 Sending daily aggregated report...')
        const reportResult = await NotificationEngine.sendDailyReport()
        logInfo('dailyReportJob', `📊 Sent ${reportResult.sent || 0} daily reports (Telegram: ${reportResult.telegram || 0}, Email: ${reportResult.email || 0})`)
        
        logInfo('dailyReportJob', '✅ Daily notification cycle completed successfully')
      } catch (error) {
        logError('dailyReportJob', error)
      }
    }, {
      scheduled: true,
      timezone: timezone
    })
    
    logInfo('rescheduleDailyReport', `✅ Job rescheduled successfully for ${newSendTime} (${cronExpr}) in timezone ${timezone}`)
    
    // Логируем текущее время и следующее выполнение
    const now = new Date()
    const localTime = now.toLocaleString('ru-RU', { timeZone: timezone })
    logInfo('rescheduleDailyReport', `🌍 Timezone: ${timezone} (current time: ${localTime})`)
    
    if (dailyReportJob && dailyReportJob.nextDate) {
      try {
        const nextRun = dailyReportJob.nextDate()
        if (nextRun) {
          const nextRunLocal = nextRun.toLocaleString('ru-RU', { timeZone: timezone })
          logInfo('rescheduleDailyReport', `⏭️ Next run scheduled: ${nextRunLocal} (${nextRun.toISOString()})`)
        }
      } catch (err) {
        logDebug('rescheduleDailyReport', 'Could not determine next run time', err)
      }
    }
    
  } catch (error) {
    logError('rescheduleDailyReport', error)
    throw error
  }
}

/**
 * Start all notification jobs
 */
export function startNotificationJobs(options = {}) {
  const {
    enableExpiryCheck = false,  // DISABLED: Now runs with daily report at sendTime
    enableQueueProcess = true,
    enableTelegramPolling = false,  // Use polling only in development
    expiryCheckSchedule = '0 * * * *',  // Every hour (disabled by default)
    queueProcessSchedule = '*/5 * * * *'  // Every 5 minutes
  } = options

  logInfo('NotificationJobs', '🚀 Starting notification jobs...')

  // Получаем часовой пояс для всех задач
  getTimezone().then(tz => {
    currentTimezone = tz
    logInfo('NotificationJobs', `🌍 Using timezone: ${tz}`)
  }).catch(err => {
    logError('NotificationJobs', 'Failed to get timezone', err)
    currentTimezone = 'Asia/Almaty'
  })

  // Expiry check and queue processing jobs REMOVED
  // All notifications are sent only once per day as aggregated reports via sendDailyReport()
  logInfo('NotificationJobs', `📅 Hourly expiry check and queue processing DISABLED (all notifications via daily report)`)

  // Daily report job - uses sendTime from settings
  rescheduleDailyReport().catch(err => {
    logError('NotificationJobs', 'Failed to schedule daily report', err)
  })

  // Telegram polling (for development/small deployments)
  // WARNING: Only ONE server can use polling at a time! 
  // For production, use webhooks instead.
  if (enableTelegramPolling && !telegramPolling) {
    if (!TelegramService.isConfigured()) {
      logInfo('NotificationJobs', '⏸️ Telegram polling skipped: TELEGRAM_BOT_TOKEN not configured')
    } else {
      // Start polling (runs in background, no need to await)
      TelegramService.startPolling(2000)  // Poll every 2 seconds
      telegramPolling = true
      logInfo('NotificationJobs', '🔄 Telegram polling started')
    }
  }

  logInfo('NotificationJobs', '✅ Notification jobs started successfully')

  return {
    dailyReportJob,
    telegramPolling
  }
}

/**
 * Stop all notification jobs
 */
export function stopNotificationJobs() {
  logInfo('NotificationJobs', '🛑 Stopping notification jobs...')

  if (dailyReportJob) {
    dailyReportJob.stop()
    dailyReportJob = null
  }

  telegramPolling = false

  logInfo('NotificationJobs', '✅ Notification jobs stopped')
}

/**
 * Run daily report immediately (manual trigger)
 * This is the only notification method - sends aggregated daily report
 */
export async function runDailyReportNow() {
  logInfo('NotificationJobs', '📊 Running manual daily report...')
  return NotificationEngine.sendDailyReport()
}

/**
 * Run expiry check now (manual trigger).
 * Delegates to daily report; returns notificationsCreated for API compatibility.
 */
export async function runExpiryCheckNow() {
  logInfo('NotificationJobs', '🔄 Running manual expiry check (via daily report)...')
  const result = await NotificationEngine.sendDailyReport()
  return result?.sent ?? 0
}

/**
 * Run queue process now (manual trigger).
 * Delegates to daily report; returns { delivered, failed } for API compatibility.
 */
export async function runQueueProcessNow() {
  logInfo('NotificationJobs', '📤 Running manual queue process (via daily report)...')
  const result = await NotificationEngine.sendDailyReport()
  return {
    delivered: (result?.telegram ?? 0) + (result?.email ?? 0),
    failed: 0
  }
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    dailyReport: {
      running: dailyReportJob !== null,
      nextRun: dailyReportJob?.nextDate?.()?.toISOString() || null,
      sendTime: currentSendTime
    },
    telegramPolling
  }
}

/**
 * Get current schedule status (for debugging and UI)
 */
export async function getScheduleStatus() {
  const sendTime = await getDailySendTime()
  const timezone = await getTimezone()
  const cronExpr = timeToCronExpression(sendTime)
  
  let nextRun = null
  if (dailyReportJob && dailyReportJob.nextDate) {
    try {
      nextRun = dailyReportJob.nextDate()
    } catch (err) {
      logDebug('getScheduleStatus', 'Could not get next run time', err)
    }
  }
  
  return {
    isScheduled: !!dailyReportJob,
    sendTime,
    cronExpression: cronExpr,
    nextRun: nextRun ? nextRun.toISOString() : null,
    nextRunLocal: nextRun ? nextRun.toLocaleString('ru-RU', { timeZone: timezone }) : null,
    timezone: timezone,
    currentSendTime: currentSendTime
  }
}

export default {
  startNotificationJobs,
  stopNotificationJobs,
  runDailyReportNow,
  runExpiryCheckNow,
  runQueueProcessNow,
  rescheduleDailyReport,
  getJobStatus,
  getScheduleStatus
}
