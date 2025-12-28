/**
 * FreshTrack Scheduler Service
 * Планировщик задач для автоматической проверки сроков годности
 */

import cron from 'node-cron'
import { getExpiredProducts, getExpiringTodayProducts, getExpiringSoonProducts } from '../db/database.js'
import { sendDailyAlert, initTelegramBot } from './telegram.js'
import { logError } from '../utils/logger.js'

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
    console.log('⏰ Running daily expiry check...')
    await runDailyCheck()
  }, {
    timezone: 'Asia/Almaty' // Часовой пояс Казахстана
  })

  console.log('📅 Daily check scheduled for 9:00 AM (Asia/Almaty)')

  // Также запускаем проверку сразу при старте сервера (опционально)
  // Раскомментируйте если нужна проверка при запуске:
  // setTimeout(() => runDailyCheck(), 5000)
}

/**
 * Выполнение ежедневной проверки
 */
export async function runDailyCheck() {
  console.log('🔍 Starting daily expiry check...')
  
  try {
    // Получаем продукты из базы данных
    const expiredProducts = getExpiredProducts()
    const expiringToday = getExpiringTodayProducts()
    const expiringSoon = getExpiringSoonProducts(3) // В течение 3 дней

    console.log(`📊 Found: ${expiredProducts.length} expired, ${expiringToday.length} expiring today, ${expiringSoon.length} expiring soon`)

    // Отправляем уведомление в Telegram
    const result = await sendDailyAlert({
      expiredProducts,
      expiringToday,
      expiringSoon
    })

    if (result.success) {
      console.log('✅ Daily check completed successfully')
    } else {
      logError('scheduler', result.error)
    }

    return result
  } catch (error) {
    logError('scheduler', error)
    return { success: false, error: error.message }
  }
}

/**
 * Остановка планировщика
 */
export function stopScheduler() {
  if (dailyJob) {
    dailyJob.stop()
    console.log('⏹️ Scheduler stopped')
  }
}

/**
 * Перезапуск планировщика
 */
export function restartScheduler() {
  stopScheduler()
  initScheduler()
  console.log('🔄 Scheduler restarted')
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


