/**
 * FreshTrack Database - SQLite
 * Управление базой данных для системы учёта сроков годности
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Путь к базе данных
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'freshtrack.db')

let db = null

/**
 * Инициализация базы данных и создание таблиц
 */
export function initDatabase() {
  db = new Database(dbPath)
  
  // Включаем foreign keys
  db.pragma('foreign_keys = ON')

  // Создаём таблицу пользователей
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'manager',
      departments TEXT, -- JSON массив доступных отделов
      telegram_chat_id TEXT,
      telegram_username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Создаём таблицу продуктов
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      expiry_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Создаём таблицу логов сборов
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      product_name TEXT NOT NULL,
      department_id TEXT NOT NULL,
      expiry_date DATE,
      quantity INTEGER,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      collected_by INTEGER REFERENCES users(id),
      reason TEXT DEFAULT 'manual'
    )
  `)

  // Создаём таблицу логов уведомлений
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      products_count INTEGER DEFAULT 0,
      content TEXT, -- JSON с деталями уведомления
      telegram_message_id TEXT,
      sent_by INTEGER REFERENCES users(id),
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent'
    )
  `)

  // Создаём таблицу системных настроек
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    )
  `)

  // Миграция: добавляем колонку login если её нет
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all()
    const columnNames = columns.map(col => col.name)
    
    // Миграция: добавляем login
    if (!columnNames.includes('login')) {
      console.log('🔄 Migrating database: adding login column to users...')
      db.exec(`ALTER TABLE users ADD COLUMN login TEXT`)
      db.exec(`UPDATE users SET login = SUBSTR(email, 1, INSTR(email, '@') - 1) WHERE login IS NULL`)
      console.log('✅ Migration complete: login column added')
    }
    
    // Миграция: добавляем departments
    if (!columnNames.includes('departments')) {
      console.log('🔄 Migrating database: adding departments column to users...')
      db.exec(`ALTER TABLE users ADD COLUMN departments TEXT`)
      console.log('✅ Migration complete: departments column added')
    }
    
    // Миграция: добавляем telegram_chat_id
    if (!columnNames.includes('telegram_chat_id')) {
      console.log('🔄 Migrating database: adding telegram_chat_id column to users...')
      db.exec(`ALTER TABLE users ADD COLUMN telegram_chat_id TEXT`)
      console.log('✅ Migration complete: telegram_chat_id column added')
    }
    
    // Миграция: добавляем telegram_username
    if (!columnNames.includes('telegram_username')) {
      console.log('🔄 Migrating database: adding telegram_username column to users...')
      db.exec(`ALTER TABLE users ADD COLUMN telegram_username TEXT`)
      console.log('✅ Migration complete: telegram_username column added')
    }
    
  } catch (err) {
    console.log('Migration error:', err.message)
  }

  // Миграция для таблицы notifications_log
  try {
    const notifColumns = db.prepare("PRAGMA table_info(notifications_log)").all()
    const notifColumnNames = notifColumns.map(col => col.name)
    
    // Миграция: добавляем content
    if (!notifColumnNames.includes('content')) {
      console.log('🔄 Migrating database: adding content column to notifications_log...')
      db.exec(`ALTER TABLE notifications_log ADD COLUMN content TEXT`)
      console.log('✅ Migration complete: content column added')
    }
    
    // Миграция: добавляем telegram_message_id
    if (!notifColumnNames.includes('telegram_message_id')) {
      console.log('🔄 Migrating database: adding telegram_message_id column to notifications_log...')
      db.exec(`ALTER TABLE notifications_log ADD COLUMN telegram_message_id TEXT`)
      console.log('✅ Migration complete: telegram_message_id column added')
    }
    
    // Миграция: добавляем sent_by
    if (!notifColumnNames.includes('sent_by')) {
      console.log('🔄 Migrating database: adding sent_by column to notifications_log...')
      db.exec(`ALTER TABLE notifications_log ADD COLUMN sent_by INTEGER`)
      console.log('✅ Migration complete: sent_by column added')
    }
    
    // Миграция: добавляем status
    if (!notifColumnNames.includes('status')) {
      console.log('🔄 Migrating database: adding status column to notifications_log...')
      db.exec(`ALTER TABLE notifications_log ADD COLUMN status TEXT DEFAULT 'sent'`)
      console.log('✅ Migration complete: status column added')
    }
    
  } catch (err) {
    console.log('Migration error (notifications_log):', err.message)
  }

  // Миграция для таблицы collection_logs
  try {
    const collectionColumns = db.prepare("PRAGMA table_info(collection_logs)").all()
    const collectionColumnNames = collectionColumns.map(col => col.name)
    
    // Миграция: добавляем comment
    if (!collectionColumnNames.includes('comment')) {
      console.log('🔄 Migrating database: adding comment column to collection_logs...')
      db.exec(`ALTER TABLE collection_logs ADD COLUMN comment TEXT`)
      console.log('✅ Migration complete: comment column added')
    }
  } catch (err) {
    console.log('Migration error (collection_logs):', err.message)
  }

  // Создаём индексы для быстрого поиска
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_products_department ON products(department);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_dept_expiry ON products(department, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
    CREATE INDEX IF NOT EXISTS idx_collection_logs_date ON collection_logs(collected_at);
    CREATE INDEX IF NOT EXISTS idx_collection_logs_dept ON collection_logs(department_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_log_date ON notifications_log(sent_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_log_type ON notifications_log(type);
  `)

  // Создаём системных пользователей если их нет
  initializeUsers()

  // Вставляем демо-данные продуктов если таблица пуста
  const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get()
  if (productsCount.count === 0) {
    insertDemoProducts()
  }

  console.log('Database tables created successfully')
  return db
}

/**
 * Инициализация системных пользователей
 */
function initializeUsers() {
  const users = [
    {
      login: 'admin',
      email: 'admin@ritzcarlton.com',
      password: 'AdminRC2025!',
      name: 'Administrator',
      role: 'admin',
      departments: ['honor-bar', 'mokki-bar', 'ozen-bar']
    },
    {
      login: 'honorbar',
      email: 'honorbar@ritzcarlton.com',
      password: 'Honor2025RC!',
      name: 'Honor Bar Manager',
      role: 'manager',
      departments: ['honor-bar']
    },
    {
      login: 'mokkibar',
      email: 'mokkibar@ritzcarlton.com',
      password: 'Mokki2025RC!',
      name: 'Mokki Bar Manager',
      role: 'manager',
      departments: ['mokki-bar']
    },
    {
      login: 'ozenbar',
      email: 'ozenbar@ritzcarlton.com',
      password: 'Ozen2025RC!',
      name: 'Ozen Bar Manager',
      role: 'manager',
      departments: ['ozen-bar']
    }
  ]

  for (const user of users) {
    const exists = db.prepare('SELECT id FROM users WHERE login = ?').get(user.login)
    if (!exists) {
      const hashedPassword = bcrypt.hashSync(user.password, 10)
      db.prepare(`
        INSERT INTO users (login, name, email, password, role, departments) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        user.login, 
        user.name, 
        user.email, 
        hashedPassword, 
        user.role, 
        JSON.stringify(user.departments)
      )
      console.log(`Created user: ${user.login}`)
    }
  }

  // Инициализация системных настроек
  initializeSettings()
}

/**
 * Инициализация системных настроек
 */
function initializeSettings() {
  const defaultSettings = [
    { key: 'notification_days_warning', value: '7' },
    { key: 'notification_days_critical', value: '3' },
    { key: 'notification_time', value: '09:00' },
    { key: 'notification_weekends', value: 'true' },
    { key: 'telegram_chat_id', value: '-5090103384' }
  ]

  for (const setting of defaultSettings) {
    const exists = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(setting.key)
    if (!exists) {
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run(setting.key, setting.value)
    }
  }
}

/**
 * Вставка демо-данных продуктов
 */
function insertDemoProducts() {
  const demoProducts = [
    { name: 'Premium Vodka', department: 'honor-bar', category: 'Spirits', quantity: 12, expiry_date: '2025-01-15' },
    { name: 'Fresh Orange Juice', department: 'honor-bar', category: 'Beverages', quantity: 24, expiry_date: '2024-12-15' },
    { name: 'Aged Whiskey', department: 'mokki-bar', category: 'Spirits', quantity: 8, expiry_date: '2026-06-20' },
    { name: 'Coconut Cream', department: 'mokki-bar', category: 'Mixers', quantity: 15, expiry_date: '2024-12-20' },
    { name: 'Champagne Brut', department: 'ozen-bar', category: 'Wine', quantity: 6, expiry_date: '2025-03-10' },
    { name: 'Fresh Lime Juice', department: 'ozen-bar', category: 'Beverages', quantity: 20, expiry_date: '2024-12-12' },
    { name: 'Artisan Gin', department: 'honor-bar', category: 'Spirits', quantity: 10, expiry_date: '2025-08-01' },
    { name: 'Organic Tonic Water', department: 'mokki-bar', category: 'Mixers', quantity: 48, expiry_date: '2024-12-25' },
    { name: 'Dark Rum', department: 'ozen-bar', category: 'Spirits', quantity: 14, expiry_date: '2025-12-01' },
    { name: 'Fresh Mint', department: 'mokki-bar', category: 'Produce', quantity: 30, expiry_date: '2024-12-11' },
    { name: 'Angostura Bitters', department: 'honor-bar', category: 'Mixers', quantity: 6, expiry_date: '2026-01-15' },
    { name: 'Prosecco', department: 'ozen-bar', category: 'Wine', quantity: 12, expiry_date: '2025-02-28' }
  ]

  const stmt = db.prepare(`
    INSERT INTO products (name, department, category, quantity, expiry_date) 
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const product of demoProducts) {
    stmt.run(product.name, product.department, product.category, product.quantity, product.expiry_date)
  }

  console.log(`Inserted ${demoProducts.length} demo products`)
}

/**
 * Получить экземпляр базы данных
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

// ============================================
// Функции для работы с продуктами
// ============================================

/**
 * Получить все продукты
 */
export function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY expiry_date ASC').all()
}

/**
 * Получить продукт по ID
 */
export function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
}

/**
 * Добавить новый продукт
 */
export function createProduct(product) {
  const { name, department, category, quantity, expiry_date } = product
  const result = db.prepare(`
    INSERT INTO products (name, department, category, quantity, expiry_date) 
    VALUES (?, ?, ?, ?, ?)
  `).run(name, department, category, quantity, expiry_date)
  
  return { id: result.lastInsertRowid, ...product }
}

/**
 * Обновить продукт
 */
export function updateProduct(id, updates) {
  const { name, department, category, quantity, expiry_date } = updates
  const result = db.prepare(`
    UPDATE products 
    SET name = COALESCE(?, name),
        department = COALESCE(?, department),
        category = COALESCE(?, category),
        quantity = COALESCE(?, quantity),
        expiry_date = COALESCE(?, expiry_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, department, category, quantity, expiry_date, id)
  
  return result.changes > 0
}

/**
 * Удалить продукт
 */
export function deleteProduct(id) {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Получить продукты по дате истечения
 */
export function getProductsByExpiryRange(startDate, endDate) {
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date BETWEEN ? AND ? 
    ORDER BY expiry_date ASC
  `).all(startDate, endDate)
}

/**
 * Получить просроченные продукты
 */
export function getExpiredProducts() {
  const today = new Date().toISOString().split('T')[0]
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date < ? 
    ORDER BY expiry_date ASC
  `).all(today)
}

/**
 * Получить продукты, истекающие сегодня
 */
export function getExpiringTodayProducts() {
  const today = new Date().toISOString().split('T')[0]
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date = ?
  `).all(today)
}

/**
 * Получить продукты, истекающие в течение N дней
 */
export function getExpiringSoonProducts(days = 3) {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + days)
  
  const todayStr = today.toISOString().split('T')[0]
  const futureStr = futureDate.toISOString().split('T')[0]
  
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date > ? AND expiry_date <= ?
    ORDER BY expiry_date ASC
  `).all(todayStr, futureStr)
}

/**
 * Получить все активные продукты (для Telegram бота и статистики)
 */
export function getActiveProducts() {
  return db.prepare(`
    SELECT * FROM products 
    WHERE quantity > 0
    ORDER BY expiry_date ASC
  `).all()
}

/**
 * Получить статистику по продуктам
 */
export function getStats() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  const threeDaysLater = new Date(today)
  threeDaysLater.setDate(threeDaysLater.getDate() + 3)
  const threeDaysStr = threeDaysLater.toISOString().split('T')[0]
  
  const sevenDaysLater = new Date(today)
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]
  
  const stats = {
    total: db.prepare('SELECT COUNT(*) as count FROM products').get().count,
    expired: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date < ?').get(todayStr).count,
    critical: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date >= ? AND expiry_date <= ?').get(todayStr, threeDaysStr).count,
    warning: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date > ? AND expiry_date <= ?').get(threeDaysStr, sevenDaysStr).count
  }
  
  stats.good = stats.total - stats.expired - stats.critical - stats.warning
  
  return stats
}

// ============================================
// Функции для работы с пользователями
// ============================================

/**
 * Найти пользователя по email
 */
export function getUserByEmail(email) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (user && user.departments) {
    user.departments = JSON.parse(user.departments)
  }
  return user
}

/**
 * Найти пользователя по логину
 */
export function getUserByLogin(login) {
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login)
  if (user && user.departments) {
    user.departments = JSON.parse(user.departments)
  }
  return user
}

/**
 * Найти пользователя по логину ИЛИ email
 */
export function getUserByLoginOrEmail(identifier) {
  // Если содержит @, ищем по email, иначе по login
  const isEmail = identifier.includes('@')
  const user = isEmail 
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(identifier)
    : db.prepare('SELECT * FROM users WHERE login = ?').get(identifier)
  
  if (user && user.departments) {
    user.departments = JSON.parse(user.departments)
  }
  return user
}

/**
 * Найти пользователя по telegram chat id
 */
export function getUserByTelegramId(chatId) {
  const user = db.prepare('SELECT * FROM users WHERE telegram_chat_id = ?').get(String(chatId))
  if (user && user.departments) {
    user.departments = JSON.parse(user.departments)
  }
  return user
}

/**
 * Обновить telegram данные пользователя
 */
export function updateUserTelegram(userId, chatId, username = null) {
  return db.prepare(`
    UPDATE users SET telegram_chat_id = ?, telegram_username = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(String(chatId), username, userId)
}

/**
 * Получить всех пользователей
 */
export function getAllUsers() {
  const users = db.prepare('SELECT id, login, name, email, role, departments, telegram_chat_id, telegram_username, created_at FROM users').all()
  return users.map(u => ({
    ...u,
    departments: u.departments ? JSON.parse(u.departments) : []
  }))
}

/**
 * Создать нового пользователя
 */
export function createUser(user) {
  const { name, email, password, role, department } = user
  const hashedPassword = bcrypt.hashSync(password, 10)
  
  const result = db.prepare(`
    INSERT INTO users (name, email, password, role, department) 
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, hashedPassword, role || 'Staff', department)
  
  return { id: result.lastInsertRowid, name, email, role: role || 'Staff', department }
}

/**
 * Проверить пароль пользователя
 */
export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

// ============================================
// Функции для работы с логами уведомлений
// ============================================

/**
 * Записать лог отправки уведомления
 */
export function logNotification(type, message, productsCount, status = 'sent', content = null, sentBy = null) {
  db.prepare(`
    INSERT INTO notifications_log (type, message, products_count, status, content, sent_by) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, message, productsCount, status, content ? JSON.stringify(content) : null, sentBy)
}

/**
 * Получить последние логи уведомлений с фильтрами
 */
export function getNotificationLogs(limit = 50, offset = 0, filters = {}) {
  let query = `
    SELECT nl.*, u.name as sent_by_name 
    FROM notifications_log nl
    LEFT JOIN users u ON nl.sent_by = u.id
    WHERE 1=1
  `
  const params = []

  if (filters.type) {
    query += ' AND nl.type = ?'
    params.push(filters.type)
  }

  if (filters.startDate) {
    query += ' AND nl.sent_at >= ?'
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    query += ' AND nl.sent_at <= ?'
    params.push(filters.endDate + ' 23:59:59')
  }

  query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const logs = db.prepare(query).all(...params)
  
  return logs.map(log => ({
    ...log,
    content: log.content ? JSON.parse(log.content) : null
  }))
}

/**
 * Получить количество логов уведомлений с фильтрами
 */
export function getNotificationLogsCount(filters = {}) {
  let query = 'SELECT COUNT(*) as count FROM notifications_log WHERE 1=1'
  const params = []

  if (filters.type) {
    query += ' AND type = ?'
    params.push(filters.type)
  }

  if (filters.startDate) {
    query += ' AND sent_at >= ?'
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    query += ' AND sent_at <= ?'
    params.push(filters.endDate + ' 23:59:59')
  }

  return db.prepare(query).get(...params).count
}

// ============================================
// Функции для работы с логами сборов
// ============================================

/**
 * Записать лог сбора
 */
export function logCollection(data) {
  const { batchId, productName, departmentId, expiryDate, quantity, collectedBy, reason } = data
  return db.prepare(`
    INSERT INTO collection_logs (batch_id, product_name, department_id, expiry_date, quantity, collected_by, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, productName, departmentId, expiryDate, quantity, collectedBy, reason || 'manual')
}

/**
 * Получить историю сборов
 */
export function getCollectionLogs(limit = 50, offset = 0, filters = {}) {
  let query = `
    SELECT cl.*, u.name as collected_by_name 
    FROM collection_logs cl
    LEFT JOIN users u ON cl.collected_by = u.id
    WHERE 1=1
  `
  const params = []

  if (filters.departmentId) {
    query += ' AND cl.department_id = ?'
    params.push(filters.departmentId)
  }
  
  if (filters.startDate) {
    query += ' AND cl.collected_at >= ?'
    params.push(filters.startDate)
  }
  
  if (filters.endDate) {
    query += ' AND cl.collected_at <= ?'
    params.push(filters.endDate)
  }
  
  if (filters.reason) {
    query += ' AND cl.reason = ?'
    params.push(filters.reason)
  }

  query += ' ORDER BY cl.collected_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return db.prepare(query).all(...params)
}

/**
 * Получить количество логов сборов
 */
export function getCollectionLogsCount(filters = {}) {
  let query = 'SELECT COUNT(*) as count FROM collection_logs WHERE 1=1'
  const params = []

  if (filters.departmentId) {
    query += ' AND department_id = ?'
    params.push(filters.departmentId)
  }
  
  if (filters.startDate) {
    query += ' AND collected_at >= ?'
    params.push(filters.startDate)
  }
  
  if (filters.endDate) {
    query += ' AND collected_at <= ?'
    params.push(filters.endDate)
  }

  return db.prepare(query).get(...params).count
}

/**
 * Получить статистику сборов по дням
 */
export function getCollectionStats(days = 7, departmentId = null) {
  let query = `
    SELECT DATE(collected_at) as date, COUNT(*) as count, SUM(quantity) as total_quantity
    FROM collection_logs
    WHERE collected_at >= datetime('now', '-${days} days')
  `
  const params = []
  
  if (departmentId) {
    query += ' AND department_id = ?'
    params.push(departmentId)
  }
  
  query += ' GROUP BY DATE(collected_at) ORDER BY date ASC'
  
  return db.prepare(query).all(...params)
}

// ============================================
// Функции для работы с настройками
// ============================================

/**
 * Получить системную настройку
 */
export function getSetting(key) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)
  return row ? row.value : null
}

/**
 * Сохранить системную настройку
 */
export function setSetting(key, value, userId = null) {
  const exists = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key)
  if (exists) {
    db.prepare('UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = ?')
      .run(value, userId, key)
  } else {
    db.prepare('INSERT INTO system_settings (key, value, updated_by) VALUES (?, ?, ?)')
      .run(key, value, userId)
  }
}

/**
 * Получить все настройки
 */
export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM system_settings').all()
  const settings = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

export default {
  initDatabase,
  getDb,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getExpiredProducts,
  getExpiringTodayProducts,
  getExpiringSoonProducts,
  getUserByEmail,
  getUserByLogin,
  getUserByLoginOrEmail,
  getUserByTelegramId,
  updateUserTelegram,
  getAllUsers,
  createUser,
  verifyPassword,
  logNotification,
  getNotificationLogs,
  getNotificationLogsCount,
  logCollection,
  getCollectionLogs,
  getCollectionLogsCount,
  getCollectionStats,
  getSetting,
  setSetting,
  getAllSettings
}
