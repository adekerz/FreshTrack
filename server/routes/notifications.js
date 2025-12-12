/**
 * FreshTrack Notifications API
 * Управление уведомлениями и Telegram интеграция
 */

import express from 'express'
import { sendTestNotification, sendDailyAlert } from '../services/telegram.js'
import { runDailyCheck, getSchedulerStatus } from '../services/scheduler.js'
import { 
  getExpiredProducts, 
  getExpiringTodayProducts, 
  getExpiringSoonProducts,
  getNotificationLogs,
  getNotificationLogsCount
} from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

/**
 * POST /api/notifications/test - Отправить тестовое уведомление
 */
router.post('/test', async (req, res) => {
  try {
    const result = await sendTestNotification()
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test notification sent successfully' 
      })
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to send notification' 
      })
    }
  } catch (error) {
    console.error('Test notification error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send test notification' 
    })
  }
})

/**
 * GET /api/notifications/send-daily - Принудительно отправить ежедневное уведомление
 */
router.get('/send-daily', async (req, res) => {
  try {
    const result = await runDailyCheck()
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Daily notification sent',
        productsNotified: result.productsNotified || 0
      })
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to send daily notification' 
      })
    }
  } catch (error) {
    console.error('Daily notification error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send daily notification' 
    })
  }
})

/**
 * GET /api/notifications/status - Получить статус планировщика
 */
router.get('/status', (req, res) => {
  const status = getSchedulerStatus()
  res.json(status)
})

/**
 * GET /api/notifications/summary - Получить сводку по продуктам для уведомлений
 */
router.get('/summary', (req, res) => {
  try {
    const expired = getExpiredProducts()
    const expiringToday = getExpiringTodayProducts()
    const expiringSoon = getExpiringSoonProducts(3)
    
    res.json({
      expired: {
        count: expired.length,
        products: expired.map(p => ({
          id: p.id,
          name: p.name,
          department: p.department,
          quantity: p.quantity,
          expiryDate: p.expiry_date
        }))
      },
      expiringToday: {
        count: expiringToday.length,
        products: expiringToday.map(p => ({
          id: p.id,
          name: p.name,
          department: p.department,
          quantity: p.quantity,
          expiryDate: p.expiry_date
        }))
      },
      expiringSoon: {
        count: expiringSoon.length,
        products: expiringSoon.map(p => ({
          id: p.id,
          name: p.name,
          department: p.department,
          quantity: p.quantity,
          expiryDate: p.expiry_date
        }))
      },
      total: expired.length + expiringToday.length + expiringSoon.length
    })
  } catch (error) {
    console.error('Summary error:', error)
    res.status(500).json({ error: 'Failed to get notification summary' })
  }
})

/**
 * GET /api/notifications/logs - Получить логи уведомлений с пагинацией и фильтрами
 */
router.get('/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit
    
    const type = req.query.type || null
    const startDate = req.query.startDate || null
    const endDate = req.query.endDate || null
    
    const logs = getNotificationLogs(limit, offset, { type, startDate, endDate })
    const total = getNotificationLogsCount({ type, startDate, endDate })
    
    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Logs error:', error)
    res.status(500).json({ error: 'Failed to get notification logs' })
  }
})

/**
 * POST /api/notifications/send-custom - Отправить кастомное уведомление
 */
router.post('/send-custom', async (req, res) => {
  try {
    const { expiredProducts, expiringToday, expiringSoon } = req.body
    
    const result = await sendDailyAlert({
      expiredProducts: expiredProducts || [],
      expiringToday: expiringToday || [],
      expiringSoon: expiringSoon || []
    })
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Custom notification sent',
        productsNotified: result.productsNotified 
      })
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      })
    }
  } catch (error) {
    console.error('Custom notification error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send custom notification' 
    })
  }
})

export default router
