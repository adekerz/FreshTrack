/**
 * FreshTrack Notification Jobs
 * Background jobs for notification processing
 * 
 * Schedule:
 * - Expiry check: Every hour (0 * * * *)
 * - Queue processing: Every 5 minutes (* /5 * * * *)
 * - Daily report: At configured sendTime (default 09:00)
 * - Telegram polling: Continuous (for development)
 */

import cron from 'node-cron'
import { NotificationEngine } from '../services/NotificationEngine.js'
import { TelegramService } from '../services/TelegramService.js'
import { logInfo, logError } from '../utils/logger.js'
import { query } from '../db/postgres.js'

let expiryCheckJob = null
let queueProcessJob = null
let dailyReportJob = null
let telegramPolling = false
let currentSendTime = '09:00'

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
  try {
    // Get global settings - check both with NULL hotel_id and scope='system'
    const result = await query(
      `SELECT value FROM settings 
       WHERE key IN ('notify.telegram.sendTime', 'notify.sendTime') 
       AND (hotel_id IS NULL OR scope = 'system')
       ORDER BY 
         CASE WHEN key = 'notify.telegram.sendTime' THEN 0 ELSE 1 END,
         updated_at DESC NULLS LAST
       LIMIT 1`
    )
    if (result.rows.length > 0) {
      try {
        // Try to parse as JSON first (in case it's wrapped in quotes)
        const parsed = JSON.parse(result.rows[0].value)
        return typeof parsed === 'string' ? parsed : '09:00'
      } catch {
        // If not JSON, return as-is
        const value = result.rows[0].value
        // Validate time format HH:MM
        if (value && /^\d{2}:\d{2}$/.test(value)) {
          return value
        }
        return '09:00'
      }
    }
    return '09:00'
  } catch (error) {
    logError('NotificationJobs', 'Failed to get send time from settings', error)
    return '09:00'
  }
}

/**
 * Reschedule daily report job with new time
 */
export async function rescheduleDailyReport() {
  const newSendTime = await getDailySendTime()

  logInfo('NotificationJobs', `📅 Send time from DB: "${newSendTime}", current: "${currentSendTime}"`)

  if (newSendTime === currentSendTime && dailyReportJob) {
    logInfo('NotificationJobs', `Send time unchanged: ${currentSendTime}`)
    return
  }

  currentSendTime = newSendTime
  const cronExpr = timeToCronExpression(newSendTime)

  // Stop existing job if running
  if (dailyReportJob) {
    dailyReportJob.stop()
    logInfo('NotificationJobs', '🔄 Rescheduling daily report job...')
  }

  // Create new job with updated schedule
  // This now also runs expiry check before sending reports
  dailyReportJob = cron.schedule(cronExpr, async () => {
    logInfo('NotificationJobs', `📊 Running daily notifications at ${currentSendTime}...`)
    try {
      // Step 1: Check expiring batches and create notifications
      logInfo('NotificationJobs', '⏰ Running expiry check...')
      const expiryCount = await NotificationEngine.checkExpiringBatches()
      logInfo('NotificationJobs', `✅ Expiry check complete. Created ${expiryCount} notifications.`)

      // Step 2: Process queue to send pending notifications
      const queueResult = await NotificationEngine.processQueue()
      logInfo('NotificationJobs', `📤 Queue processed: ${queueResult.delivered} delivered, ${queueResult.failed} failed`)

      // Step 3: Send daily reports
      await NotificationEngine.sendDailyReports()
      logInfo('NotificationJobs', '✅ Daily reports sent successfully')
    } catch (error) {
      logError('NotificationJobs', 'Daily notification job error', error)
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Almaty'
  })

  logInfo('NotificationJobs', `📊 Daily notifications scheduled: ${cronExpr} (${newSendTime}) [timezone: Asia/Almaty]`)

  // Log next run time for debugging
  if (dailyReportJob) {
    const now = new Date()
    const localTime = now.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })
    logInfo('NotificationJobs', `⏰ Current time in Asia/Almaty: ${localTime}`)
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

  // Expiry check job (hourly) - DISABLED by default
  // Now expiry check runs together with daily report at configured sendTime
  if (enableExpiryCheck) {
    expiryCheckJob = cron.schedule(expiryCheckSchedule, async () => {
      logInfo('NotificationJobs', `⏰ Running expiry check...`)
      try {
        const count = await NotificationEngine.checkExpiringBatches()
        logInfo('NotificationJobs', `✅ Expiry check complete. Created ${count} notifications.`)
      } catch (error) {
        logError('NotificationJobs', error)
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Almaty'
    })

    logInfo('NotificationJobs', `📅 Expiry check scheduled: ${expiryCheckSchedule}`)
  } else {
    logInfo('NotificationJobs', `📅 Hourly expiry check DISABLED (runs with daily report at sendTime)`)
  }

  // Queue processing job (every 5 minutes)
  if (enableQueueProcess) {
    queueProcessJob = cron.schedule(queueProcessSchedule, async () => {
      try {
        const result = await NotificationEngine.processQueue()
        if (result.delivered > 0 || result.failed > 0) {
          logInfo('NotificationJobs', `📤 Queue processed: ${result.delivered} delivered, ${result.failed} failed`)
        }
      } catch (error) {
        logError('NotificationJobs', error)
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Almaty'
    })

    logInfo('NotificationJobs', `📤 Queue processing scheduled: ${queueProcessSchedule}`)
  }

  // Daily report job - uses sendTime from settings
  rescheduleDailyReport().catch(err => {
    logError('NotificationJobs', 'Failed to schedule daily report', err)
  })

  // Telegram polling (for development/small deployments)
  if (enableTelegramPolling && !telegramPolling) {
    telegramPolling = true
    TelegramService.startPolling(2000)  // Poll every 2 seconds
    logInfo('NotificationJobs', '🔄 Telegram polling started')
  }

  logInfo('NotificationJobs', '✅ Notification jobs started successfully')

  return {
    expiryCheckJob,
    queueProcessJob,
    dailyReportJob,
    telegramPolling
  }
}

/**
 * Stop all notification jobs
 */
export function stopNotificationJobs() {
  logInfo('NotificationJobs', '🛑 Stopping notification jobs...')

  if (expiryCheckJob) {
    expiryCheckJob.stop()
    expiryCheckJob = null
  }

  if (queueProcessJob) {
    queueProcessJob.stop()
    queueProcessJob = null
  }

  if (dailyReportJob) {
    dailyReportJob.stop()
    dailyReportJob = null
  }

  telegramPolling = false

  logInfo('NotificationJobs', '✅ Notification jobs stopped')
}

/**
 * Run expiry check immediately (manual trigger)
 */
export async function runExpiryCheckNow() {
  logInfo('NotificationJobs', '🔔 Running manual expiry check...')
  return NotificationEngine.checkExpiringBatches()
}

/**
 * Run queue processing immediately (manual trigger)
 */
export async function runQueueProcessNow() {
  logInfo('NotificationJobs', '📤 Running manual queue processing...')
  return NotificationEngine.processQueue()
}

/**
 * Run daily report immediately (manual trigger)
 */
export async function runDailyReportNow() {
  logInfo('NotificationJobs', '📊 Running manual daily report...')
  return NotificationEngine.sendDailyReports()
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    expiryCheck: {
      running: expiryCheckJob !== null,
      nextRun: expiryCheckJob?.nextDate?.()?.toISOString() || null
    },
    queueProcess: {
      running: queueProcessJob !== null,
      nextRun: queueProcessJob?.nextDate?.()?.toISOString() || null
    },
    dailyReport: {
      running: dailyReportJob !== null,
      nextRun: dailyReportJob?.nextDate?.()?.toISOString() || null,
      sendTime: currentSendTime
    },
    telegramPolling
  }
}

export default {
  startNotificationJobs,
  stopNotificationJobs,
  runExpiryCheckNow,
  runQueueProcessNow,
  runDailyReportNow,
  rescheduleDailyReport,
  getJobStatus
}
