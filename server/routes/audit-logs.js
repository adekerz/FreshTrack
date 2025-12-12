import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

let tableInitialized = false

// Ленивая инициализация таблицы audit_logs
const ensureTable = () => {
  if (tableInitialized) return
  
  try {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        target_type TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    tableInitialized = true
    console.log('Таблица audit_logs готова')
  } catch (error) {
    console.log('Ошибка создания таблицы audit_logs:', error.message)
  }
}

// Функция для логирования действий (экспортируем для использования в других роутах)
export const logAction = (userId, userName, action, target, targetType, details, ipAddress = null) => {
  ensureTable() // Убеждаемся, что таблица создана
  try {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, target, target_type, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(userId, userName, action, target, targetType, details, ipAddress)
  } catch (error) {
    console.error('Ошибка записи в audit_logs:', error)
  }
}

// Middleware для инициализации таблицы
router.use((req, res, next) => {
  ensureTable()
  next()
})
// GET /api/audit-logs - получить все логи
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { action, userId, limit = 100, offset = 0 } = req.query
    
    let sql = `
      SELECT 
        id,
        user_id as userId,
        user_name as user,
        action,
        target,
        target_type as targetType,
        details,
        ip_address as ipAddress,
        timestamp
      FROM audit_logs
      WHERE 1=1
    `
    const params = []
    
    if (action && action !== 'all') {
      sql += ' AND action = ?'
      params.push(action)
    }
    
    if (userId && userId !== 'all') {
      sql += ' AND user_id = ?'
      params.push(userId)
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))
    
    const logs = db.prepare(sql).all(...params)
    
    // Получаем общее количество
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1'
    const countParams = []
    
    if (action && action !== 'all') {
      countSql += ' AND action = ?'
      countParams.push(action)
    }
    
    if (userId && userId !== 'all') {
      countSql += ' AND user_id = ?'
      countParams.push(userId)
    }
    
    const countResult = db.prepare(countSql).get(...countParams)
    
    res.json({
      logs,
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Ошибка получения audit logs:', error)
    res.status(500).json({ error: 'Ошибка получения журнала действий' })
  }
})

// GET /api/audit-logs/users - получить список пользователей из логов
router.get('/users', (req, res) => {
  try {
    const db = getDb()
    const users = db.prepare(`
      SELECT DISTINCT user_id as userId, user_name as userName
      FROM audit_logs
      ORDER BY user_name
    `).all()
    
    res.json({ users })
  } catch (error) {
    console.error('Ошибка получения списка пользователей:', error)
    res.status(500).json({ error: 'Ошибка получения списка пользователей' })
  }
})

// GET /api/audit-logs/actions - получить статистику по действиям
router.get('/actions', (req, res) => {
  try {
    const db = getDb()
    const stats = db.prepare(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `).all()
    
    res.json({ stats })
  } catch (error) {
    console.error('Ошибка получения статистики:', error)
    res.status(500).json({ error: 'Ошибка получения статистики' })
  }
})

export default router
