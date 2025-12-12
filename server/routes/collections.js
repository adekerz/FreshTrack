/**
 * FreshTrack Collections API
 * Управление историей сборов товаров
 */

import express from 'express'
import { 
  getCollectionLogs, 
  getCollectionLogsCount,
  logCollection
} from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

/**
 * GET /api/collections - Получить историю сборов с пагинацией и фильтрами
 */
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit
    
    // Фильтры
    const filters = {
      departmentId: req.query.departmentId || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      reason: req.query.reason || null
    }
    
    const logs = getCollectionLogs(limit, offset, filters)
    const total = getCollectionLogsCount(filters)
    
    res.json({
      logs: logs.map(log => ({
        id: log.id,
        batchId: log.batch_id,
        productName: log.product_name,
        departmentId: log.department_id,
        expiryDate: log.expiry_date,
        quantity: log.quantity,
        collectedAt: log.collected_at,
        collectedBy: log.collected_by,
        collectedByName: log.collected_by_name,
        reason: log.reason
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Collections error:', error)
    res.status(500).json({ error: 'Failed to get collection logs' })
  }
})

/**
 * POST /api/collections - Записать сбор
 */
router.post('/', (req, res) => {
  try {
    const { batchId, productName, departmentId, expiryDate, quantity, reason } = req.body
    
    // Получаем user id из токена (если есть middleware)
    const collectedBy = req.user?.id || null
    
    logCollection({
      batchId,
      productName,
      departmentId,
      expiryDate,
      quantity: parseInt(quantity),
      collectedBy,
      reason: reason || 'manual'
    })
    
    res.status(201).json({ success: true, message: 'Collection logged' })
  } catch (error) {
    console.error('Log collection error:', error)
    res.status(500).json({ error: 'Failed to log collection' })
  }
})

/**
 * GET /api/collections/stats - Статистика по сборам
 */
router.get('/stats', (req, res) => {
  try {
    // Получаем статистику за разные периоды
    const today = new Date().toISOString().split('T')[0]
    
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    const monthAgoStr = monthAgo.toISOString().split('T')[0]
    
    const todayCount = getCollectionLogsCount({ startDate: today })
    const weekCount = getCollectionLogsCount({ startDate: weekAgoStr })
    const monthCount = getCollectionLogsCount({ startDate: monthAgoStr })
    const totalCount = getCollectionLogsCount({})
    
    res.json({
      today: todayCount,
      week: weekCount,
      month: monthCount,
      total: totalCount
    })
  } catch (error) {
    console.error('Collection stats error:', error)
    res.status(500).json({ error: 'Failed to get collection stats' })
  }
})

export default router
