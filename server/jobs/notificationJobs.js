/**
 * FreshTrack Notification Jobs
 * Background jobs for notification processing
 * 
 * Schedule:
 * - Expiry check: Every hour (0 * * * *)
 * - Queue processing: Every 5 minutes (* /5 * * * *)
 * - Telegram polling: Continuous (for development)
 */

import cron from 'node-cron'
import { NotificationEngine } from '../services/NotificationEngine.js'
import { TelegramService } from '../services/TelegramService.js'

let expiryCheckJob = null
let queueProcessJob = null
let telegramPolling = false

/**
 * Start all notification jobs
 */
export function startNotificationJobs(options = {}) {
  const {
    enableExpiryCheck = true,
    enableQueueProcess = true,
    enableTelegramPolling = false,  // Use polling only in development
    expiryCheckSchedule = '0 * * * *',  // Every hour
    queueProcessSchedule = '*/5 * * * *'  // Every 5 minutes
  } = options
  
  console.log('🚀 Starting notification jobs...')
  
  // Expiry check job (hourly)
  if (enableExpiryCheck) {
    expiryCheckJob = cron.schedule(expiryCheckSchedule, async () => {
      console.log(`\n⏰ [${new Date().toISOString()}] Running expiry check...`)
      try {
        const count = await NotificationEngine.checkExpiringBatches()
        console.log(`✅ Expiry check complete. Created ${count} notifications.`)
      } catch (error) {
        console.error('❌ Expiry check failed:', error)
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Almaty'
    })
    
    console.log(`📅 Expiry check scheduled: ${expiryCheckSchedule}`)
  }
  
  // Queue processing job (every 5 minutes)
  if (enableQueueProcess) {
    queueProcessJob = cron.schedule(queueProcessSchedule, async () => {
      try {
        const result = await NotificationEngine.processQueue()
        if (result.delivered > 0 || result.failed > 0) {
          console.log(`📤 Queue processed: ${result.delivered} delivered, ${result.failed} failed`)
        }
      } catch (error) {
        console.error('❌ Queue processing failed:', error)
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Almaty'
    })
    
    console.log(`📤 Queue processing scheduled: ${queueProcessSchedule}`)
  }
  
  // Telegram polling (for development/small deployments)
  if (enableTelegramPolling && !telegramPolling) {
    telegramPolling = true
    TelegramService.startPolling(2000)  // Poll every 2 seconds
    console.log('🔄 Telegram polling started')
  }
  
  console.log('✅ Notification jobs started successfully')
  
  return {
    expiryCheckJob,
    queueProcessJob,
    telegramPolling
  }
}

/**
 * Stop all notification jobs
 */
export function stopNotificationJobs() {
  console.log('🛑 Stopping notification jobs...')
  
  if (expiryCheckJob) {
    expiryCheckJob.stop()
    expiryCheckJob = null
  }
  
  if (queueProcessJob) {
    queueProcessJob.stop()
    queueProcessJob = null
  }
  
  telegramPolling = false
  
  console.log('✅ Notification jobs stopped')
}

/**
 * Run expiry check immediately (manual trigger)
 */
export async function runExpiryCheckNow() {
  console.log('🔔 Running manual expiry check...')
  return NotificationEngine.checkExpiringBatches()
}

/**
 * Run queue processing immediately (manual trigger)
 */
export async function runQueueProcessNow() {
  console.log('📤 Running manual queue processing...')
  return NotificationEngine.processQueue()
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
    telegramPolling
  }
}

export default {
  startNotificationJobs,
  stopNotificationJobs,
  runExpiryCheckNow,
  runQueueProcessNow,
  getJobStatus
}
