import express from 'express'
import { getDb } from '../db/database.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

let tableInitialized = false

// Ленивая инициализация таблицы audit_logs с расширенными полями
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
        action_type TEXT,
        entity_type TEXT,
        entity_id TEXT,
        entity_name TEXT,
        target TEXT,
        target_type TEXT,
        details TEXT,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Добавляем новые колонки если их нет (для миграции)
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN action_type TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN entity_type TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN entity_id TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN entity_name TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN old_value TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN new_value TEXT`)
    } catch (e) { /* колонка уже существует */ }
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN user_agent TEXT`)
    } catch (e) { /* колонка уже существует */ }
    
    tableInitialized = true
    console.log('Таблица audit_logs готова (расширенная)')
  } catch (error) {
    console.log('Ошибка создания таблицы audit_logs:', error.message)
  }
}

// Расширенная функция для логирования действий
export const logAction = (userId, userName, action, target, targetType, details, ipAddress = null, options = {}) => {
  ensureTable()
  try {
    const db = getDb()
    const {
      actionType = null,
      entityType = null,
      entityId = null,
      entityName = null,
      oldValue = null,
      newValue = null,
      userAgent = null
    } = options
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        user_id, user_name, action, target, target_type, details, ip_address,
        action_type, entity_type, entity_id, entity_name, old_value, new_value, user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      userId, 
      userName, 
      action, 
      target, 
      targetType, 
      details, 
      ipAddress,
      actionType,
      entityType,
      entityId,
      entityName,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      userAgent
    )
  } catch (error) {
    console.error('Ошибка записи в audit_logs:', error)
  }
}

// Хелперы для типичных действий
export const logLogin = (user, ip, userAgent) => {
  logAction(user.id, user.name || user.login, 'login', null, 'session', 'Вход в систему', ip, {
    actionType: 'login',
    entityType: 'session',
    userAgent
  })
}

export const logLogout = (user, ip) => {
  logAction(user.id, user.name || user.login, 'logout', null, 'session', 'Выход из системы', ip, {
    actionType: 'logout',
    entityType: 'session'
  })
}

export const logBatchCreate = (user, batch, ip) => {
  logAction(user.id, user.name || user.login, 'create', batch.id?.toString(), 'batch', 
    `Добавлена партия: ${batch.name || batch.product_name}`, ip, {
    actionType: 'create',
    entityType: 'batch',
    entityId: batch.id?.toString(),
    entityName: batch.name || batch.product_name,
    newValue: batch
  })
}

export const logBatchCollect = (user, batch, reason, ip) => {
  logAction(user.id, user.name || user.login, 'collect', batch.id?.toString(), 'batch',
    `Собрана партия: ${batch.name || batch.product_name} (${reason})`, ip, {
    actionType: 'collect',
    entityType: 'batch',
    entityId: batch.id?.toString(),
    entityName: batch.name || batch.product_name,
    oldValue: { is_collected: false },
    newValue: { is_collected: true, reason }
  })
}

export const logBatchDelete = (user, batch, ip) => {
  logAction(user.id, user.name || user.login, 'delete', batch.id?.toString(), 'batch',
    `Удалена партия: ${batch.name || batch.product_name}`, ip, {
    actionType: 'delete',
    entityType: 'batch',
    entityId: batch.id?.toString(),
    entityName: batch.name || batch.product_name,
    oldValue: batch
  })
}

export const logSettingsChange = (user, settingName, oldValue, newValue, ip) => {
  logAction(user.id, user.name || user.login, 'settingsChange', settingName, 'settings',
    `Изменены настройки: ${settingName}`, ip, {
    actionType: 'update',
    entityType: 'settings',
    entityName: settingName,
    oldValue,
    newValue
  })
}

export const logUserCreate = (user, newUser, ip) => {
  logAction(user.id, user.name || user.login, 'create', newUser.id?.toString(), 'user',
    `Создан пользователь: ${newUser.name || newUser.login}`, ip, {
    actionType: 'create',
    entityType: 'user',
    entityId: newUser.id?.toString(),
    entityName: newUser.name || newUser.login,
    newValue: { login: newUser.login, name: newUser.name, role: newUser.role }
  })
}

export const logUserUpdate = (user, targetUser, changes, ip) => {
  logAction(user.id, user.name || user.login, 'update', targetUser.id?.toString(), 'user',
    `Обновлён пользователь: ${targetUser.name || targetUser.login}`, ip, {
    actionType: 'update',
    entityType: 'user',
    entityId: targetUser.id?.toString(),
    entityName: targetUser.name || targetUser.login,
    newValue: changes
  })
}

// Middleware для инициализации таблицы
router.use((req, res, next) => {
  ensureTable()
  next()
})
// GET /api/audit-logs - получить все логи с расширенными фильтрами
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { 
      action, 
      actionType,
      entityType,
      userId, 
      dateFrom,
      dateTo,
      limit = 50, 
      offset = 0,
      page = 1
    } = req.query
    
    // Вычисляем offset из page если передан page
    const actualOffset = page > 1 ? (parseInt(page) - 1) * parseInt(limit) : parseInt(offset)
    
    let sql = `
      SELECT 
        id,
        user_id as userId,
        user_name as userName,
        action,
        action_type as actionType,
        entity_type as entityType,
        entity_id as entityId,
        entity_name as entityName,
        target,
        target_type as targetType,
        details,
        old_value as oldValue,
        new_value as newValue,
        ip_address as ipAddress,
        user_agent as userAgent,
        timestamp as createdAt
      FROM audit_logs
      WHERE 1=1
    `
    const params = []
    
    if (action && action !== 'all' && action !== '') {
      sql += ' AND action = ?'
      params.push(action)
    }
    
    if (actionType && actionType !== 'all' && actionType !== '') {
      sql += ' AND action_type = ?'
      params.push(actionType)
    }
    
    if (entityType && entityType !== 'all' && entityType !== '') {
      sql += ' AND entity_type = ?'
      params.push(entityType)
    }
    
    if (userId && userId !== 'all' && userId !== '') {
      sql += ' AND user_id = ?'
      params.push(userId)
    }
    
    if (dateFrom) {
      sql += ' AND date(timestamp) >= date(?)'
      params.push(dateFrom)
    }
    
    if (dateTo) {
      sql += ' AND date(timestamp) <= date(?)'
      params.push(dateTo)
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), actualOffset)
    
    const logs = db.prepare(sql).all(...params)
    
    // Получаем общее количество с учётом фильтров
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1'
    const countParams = []
    
    if (action && action !== 'all' && action !== '') {
      countSql += ' AND action = ?'
      countParams.push(action)
    }
    
    if (actionType && actionType !== 'all' && actionType !== '') {
      countSql += ' AND action_type = ?'
      countParams.push(actionType)
    }
    
    if (entityType && entityType !== 'all' && entityType !== '') {
      countSql += ' AND entity_type = ?'
      countParams.push(entityType)
    }
    
    if (userId && userId !== 'all' && userId !== '') {
      countSql += ' AND user_id = ?'
      countParams.push(userId)
    }
    
    if (dateFrom) {
      countSql += ' AND date(timestamp) >= date(?)'
      countParams.push(dateFrom)
    }
    
    if (dateTo) {
      countSql += ' AND date(timestamp) <= date(?)'
      countParams.push(dateTo)
    }
    
    const countResult = db.prepare(countSql).get(...countParams)
    
    res.json({
      logs,
      total: countResult.total,
      limit: parseInt(limit),
      offset: actualOffset,
      page: parseInt(page)
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
