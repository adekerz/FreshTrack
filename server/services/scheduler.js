/**
 * FreshTrack Scheduler Service
 * Планировщик задач для автоматической проверки сроков годности
 */

import cron from 'node-cron'
import { getExpiredProducts, getExpiringTodayProducts, getExpiringSoonProducts, getAllHotels } from '../db/database.js'
import { sendDailyAlert, initTelegramBot } from './TelegramService.js'
import { logError, logInfo, logDebug } from '../utils/logger.js'
import sseManager from './SSEManager.js'
import { SSE_EVENTS } from '../utils/constants.js'

let dailyJob = null

/**
 * Инициализация планировщика
 */
export function initScheduler() {
  // Инициализируем Telegram бота
  initTelegramBot()

  // Ежедневная проверка в 9:00 утра
  // Формат cron: минуты часы день месяц день_недели
  dailyJob = cron.schedule('0 9 * * *', async () => {
    logInfo('Scheduler', '⏰ Running daily expiry check...')
    await runDailyCheck()
  }, {
    timezone: 'Asia/Almaty' // Часовой пояс Казахстана
  })

  logInfo('Scheduler', '📅 Daily check scheduled for 9:00 AM (Asia/Almaty)')

  // Также запускаем проверку сразу при старте сервера (опционально)
  // Раскомментируйте если нужна проверка при запуске:
  // setTimeout(() => runDailyCheck(), 5000)
}

/**
 * Выполнение ежедневной проверки
 */
export async function runDailyCheck() {
  logDebug('Scheduler', '🔍 Starting daily expiry check...')
  
  try {
    // Получаем продукты из базы данных
    const expiredProducts = getExpiredProducts()
    const expiringToday = getExpiringTodayProducts()
    const expiringSoon = getExpiringSoonProducts(3) // В течение 3 дней

    logDebug('Scheduler', `📊 Found: ${expiredProducts.length} expired, ${expiringToday.length} expiring today, ${expiringSoon.length} expiring soon`)

    // SSE: Broadcast expiry alerts to all connected clients
    await broadcastExpiryAlerts(expiredProducts, expiringToday, expiringSoon)

    // Отправляем уведомление в Telegram
    const result = await sendDailyAlert({
      expiredProducts,
      expiringToday,
      expiringSoon
    })

    if (result.success) {
      logInfo('Scheduler', '✅ Daily check completed successfully')
    } else {
      logError('Scheduler', result.error)
    }

    return result
  } catch (error) {
    logError('scheduler', error)
    return { success: false, error: error.message }
  }
}

/**
 * Broadcast expiry alerts via SSE
 * Groups products by hotel for isolated broadcasts
 */
async function broadcastExpiryAlerts(expiredProducts, expiringToday, expiringSoon) {
  try {
    // Get all hotels for broadcasting
    const hotels = await getAllHotels()
    
    for (const hotel of hotels) {
      const hotelId = hotel.id
      
      // Filter products by hotel
      const hotelExpired = expiredProducts.filter(p => p.hotel_id === hotelId)
      const hotelCritical = expiringToday.filter(p => p.hotel_id === hotelId)
      const hotelWarning = expiringSoon.filter(p => p.hotel_id === hotelId && 
        !expiringToday.some(t => t.id === p.id))
      
      // Broadcast expired products
      if (hotelExpired.length > 0) {
        sseManager.broadcast(hotelId, SSE_EVENTS.EXPIRED, {
          count: hotelExpired.length,
          products: hotelExpired.slice(0, 10).map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            expiryDate: p.expiry_date
          })),
          message: `${hotelExpired.length} продуктов просрочено`
        })
      }
      
      // Broadcast critical (expiring today / < 3 days)
      if (hotelCritical.length > 0) {
        sseManager.broadcast(hotelId, SSE_EVENTS.EXPIRING_CRITICAL, {
          count: hotelCritical.length,
          products: hotelCritical.slice(0, 10).map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            expiryDate: p.expiry_date,
            daysLeft: p.days_left
          })),
          message: `${hotelCritical.length} продуктов истекает < 3 дней`
        })
      }
      
      // Broadcast warning (expiring < 7 days)
      if (hotelWarning.length > 0) {
        sseManager.broadcast(hotelId, SSE_EVENTS.EXPIRING_WARNING, {
          count: hotelWarning.length,
          products: hotelWarning.slice(0, 10).map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            expiryDate: p.expiry_date,
            daysLeft: p.days_left
          })),
          message: `${hotelWarning.length} продуктов истекает < 7 дней`
        })
      }
      
      // Broadcast stats update if there are any expiry issues
      if (hotelExpired.length > 0 || hotelCritical.length > 0 || hotelWarning.length > 0) {
        sseManager.broadcast(hotelId, SSE_EVENTS.STATS_UPDATE, {
          reason: 'expiry_check',
          expired: hotelExpired.length,
          critical: hotelCritical.length,
          warning: hotelWarning.length,
          timestamp: new Date().toISOString()
        })
      }
    }
    
    logInfo('Scheduler', '📡 Expiry alerts broadcasted via SSE')
  } catch (error) {
    logError('Scheduler', `Failed to broadcast expiry alerts: ${error.message}`)
  }
}

/**
 * Остановка планировщика
 */
export function stopScheduler() {
  if (dailyJob) {
    dailyJob.stop()
    logInfo('Scheduler', '⏹️ Scheduler stopped')
  }
}

/**
 * Перезапуск планировщика
 */
export function restartScheduler() {
  stopScheduler()
  initScheduler()
  logInfo('Scheduler', '🔄 Scheduler restarted')
}

/**
 * Получить статус планировщика
 */
export function getSchedulerStatus() {
  return {
    isRunning: dailyJob !== null,
    nextRun: dailyJob ? 'Daily at 9:00 AM (Asia/Almaty)' : 'Not scheduled'
  }
}

export default {
  initScheduler,
  runDailyCheck,
  stopScheduler,
  restartScheduler,
  getSchedulerStatus
}


