/**
 * FreshTrack Enterprise Database
 * Clean architecture - NO demo data
 * Multi-property ready
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'freshtrack.db')

let db = null

/**
 * Get database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Initialize database and create tables
 */
export function initDatabase() {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  console.log('📦 Initializing FreshTrack Enterprise Database...')

  // ═══════════════════════════════════════════════════════════════
  // ENTERPRISE TABLES
  // ═══════════════════════════════════════════════════════════════

  // Hotel Chains / Brands
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotel_chains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#FF8D6B',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Properties (Hotels)
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      address TEXT,
      city TEXT,
      country TEXT,
      timezone TEXT DEFAULT 'UTC',
      currency TEXT DEFAULT 'USD',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chain_id) REFERENCES hotel_chains(id)
    )
  `)

  // Roles with permissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT,
      description TEXT,
      permissions TEXT,
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // ═══════════════════════════════════════════════════════════════
  // CORE TABLES
  // ═══════════════════════════════════════════════════════════════

  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'staff',
      property_id INTEGER,
      department_id TEXT,
      departments TEXT,
      is_active INTEGER DEFAULT 1,
      telegram_chat_id TEXT,
      telegram_username TEXT,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `)

  // User-Property assignments (for multi-property access)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_properties (
      user_id INTEGER,
      property_id INTEGER,
      role TEXT DEFAULT 'staff',
      PRIMARY KEY (user_id, property_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `)

  // Departments (created by admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      property_id INTEGER,
      color TEXT DEFAULT '#FF8D6B',
      icon TEXT DEFAULT 'package',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `)

  // Categories (created by admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      color TEXT DEFAULT '#6B6560',
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Products catalog (created by admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      category_id INTEGER,
      department TEXT,
      category TEXT,
      default_shelf_life INTEGER DEFAULT 30,
      barcode TEXT,
      sku TEXT,
      unit TEXT DEFAULT 'pcs',
      image_url TEXT,
      quantity INTEGER DEFAULT 0,
      expiry_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `)

  // Batches (inventory items with expiry)
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      department_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      manufacturing_date DATE,
      expiry_date DATE NOT NULL,
      batch_number TEXT,
      supplier TEXT,
      purchase_price REAL,
      is_collected INTEGER DEFAULT 0,
      collected_at DATETIME,
      collected_by INTEGER,
      collection_reason TEXT,
      added_by INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (added_by) REFERENCES users(id),
      FOREIGN KEY (collected_by) REFERENCES users(id)
    )
  `)

  // Collections (collection history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      department_id TEXT,
      quantity INTEGER,
      reason TEXT,
      comment TEXT,
      collected_by INTEGER,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (collected_by) REFERENCES users(id)
    )
  `)

  // Collection logs (legacy support)
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
      reason TEXT DEFAULT 'manual',
      comment TEXT
    )
  `)

  // Delivery templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id TEXT,
      items TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // Notification rules
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      department_id TEXT,
      warning_days INTEGER DEFAULT 7,
      critical_days INTEGER DEFAULT 3,
      telegram_enabled INTEGER DEFAULT 1,
      email_enabled INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // System settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER REFERENCES users(id)
    )
  `)

  // Audit logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      action_type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      entity_name TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      title TEXT,
      message TEXT,
      department_id TEXT,
      batch_id INTEGER,
      is_read INTEGER DEFAULT 0,
      sent_telegram INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Notification logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      products_count INTEGER DEFAULT 0,
      content TEXT,
      telegram_message_id TEXT,
      sent_by INTEGER REFERENCES users(id),
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'sent'
    )
  `)

  // Department notification settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS department_notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      UNIQUE(department_id, setting_key)
    )
  `)

  // Custom texts/branding
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Webhooks for integrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      events TEXT,
      secret TEXT,
      property_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // ═══════════════════════════════════════════════════════════════
  // INDEXES
  // ═══════════════════════════════════════════════════════════════

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_products_department ON products(department);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_department ON batches(department_id);
    CREATE INDEX IF NOT EXISTS idx_batches_collected ON batches(is_collected);
    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_collection_logs_date ON collection_logs(collected_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  `)

  // ═══════════════════════════════════════════════════════════════
  // INITIAL SETUP - ONLY SUPER ADMIN
  // ═══════════════════════════════════════════════════════════════

  initializeRoles()
  initializeAdmin()
  initializeSettings()

  console.log('✅ Database initialized successfully')
  console.log('   No demo data - clean slate for production')
  
  return db
}

/**
 * Initialize system roles
 */
function initializeRoles() {
  const roles = [
    { 
      name: 'super_admin', 
      display_name: 'Super Administrator',
      description: 'Full system access', 
      permissions: ['*'] 
    },
    { 
      name: 'chain_admin', 
      display_name: 'Chain Administrator',
      description: 'Hotel chain administrator', 
      permissions: ['chain.*', 'property.*', 'users.*', 'reports.*'] 
    },
    { 
      name: 'property_admin', 
      display_name: 'Property Administrator',
      description: 'Single property administrator', 
      permissions: ['property.view', 'users.manage', 'inventory.*', 'reports.property'] 
    },
    { 
      name: 'admin', 
      display_name: 'Administrator',
      description: 'System administrator', 
      permissions: ['inventory.*', 'users.*', 'settings.*', 'reports.*'] 
    },
    { 
      name: 'manager', 
      display_name: 'Manager',
      description: 'Department manager', 
      permissions: ['inventory.*', 'reports.department'] 
    },
    { 
      name: 'staff', 
      display_name: 'Staff',
      description: 'Regular staff member', 
      permissions: ['inventory.view', 'inventory.add_batch', 'inventory.collect'] 
    },
  ]

  for (const role of roles) {
    const exists = db.prepare('SELECT id FROM roles WHERE name = ?').get(role.name)
    if (!exists) {
      db.prepare(`
        INSERT INTO roles (name, display_name, description, permissions, is_system) 
        VALUES (?, ?, ?, ?, 1)
      `).run(role.name, role.display_name, role.description, JSON.stringify(role.permissions))
    }
  }
}

/**
 * Initialize admin user
 */
function initializeAdmin() {
  const adminExists = db.prepare('SELECT id FROM users WHERE login = ?').get('admin')
  
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Admin123!', 10)
    db.prepare(`
      INSERT INTO users (login, password, name, email, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', hashedPassword, 'System Administrator', 'admin@freshtrack.local', 'admin', 1)
    
    console.log('')
    console.log('┌─────────────────────────────────────────────┐')
    console.log('│  🔐 INITIAL ADMIN CREDENTIALS               │')
    console.log('├─────────────────────────────────────────────┤')
    console.log('│  Login:    admin                            │')
    console.log('│  Password: Admin123!                        │')
    console.log('├─────────────────────────────────────────────┤')
    console.log('│  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!      │')
    console.log('└─────────────────────────────────────────────┘')
    console.log('')
  }
}

/**
 * Initialize default settings
 */
function initializeSettings() {
  const defaultSettings = [
    { key: 'site_name', value: 'FreshTrack' },
    { key: 'notification_days_warning', value: '7' },
    { key: 'notification_days_critical', value: '3' },
    { key: 'notification_time', value: '09:00' },
    { key: 'date_format', value: 'DD.MM.YYYY' },
    { key: 'timezone', value: 'UTC' },
    { key: 'default_language', value: 'en' }
  ]

  for (const setting of defaultSettings) {
    const exists = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(setting.key)
    if (!exists) {
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run(setting.key, setting.value)
    }
  }
}

/**
 * Reset database (for development)
 */
export function resetDatabase() {
  console.log('🗑️  Resetting database...')
  
  db.exec('DELETE FROM batches')
  db.exec('DELETE FROM collections')
  db.exec('DELETE FROM collection_logs')
  db.exec('DELETE FROM products')
  db.exec('DELETE FROM categories')
  db.exec('DELETE FROM departments')
  db.exec('DELETE FROM delivery_templates')
  db.exec('DELETE FROM notification_rules')
  db.exec('DELETE FROM notifications')
  db.exec('DELETE FROM notifications_log')
  db.exec('DELETE FROM audit_logs')
  db.exec('DELETE FROM webhooks')
  db.exec("DELETE FROM users WHERE login != 'admin'")
  
  // Reset auto-increment
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('batches', 'collections', 'collection_logs', 'products', 'categories', 'delivery_templates', 'notification_rules', 'notifications', 'notifications_log', 'audit_logs', 'webhooks')")
  
  console.log('✅ Database reset complete')
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllProducts() {
  return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY expiry_date ASC').all()
}

export function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
}

export function createProduct(product) {
  const { name, department, category, quantity, expiry_date } = product
  const result = db.prepare(`
    INSERT INTO products (name, department, category, quantity, expiry_date, is_active) 
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name, department, category, quantity || 0, expiry_date)
  
  return { id: result.lastInsertRowid, ...product }
}

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

export function deleteProduct(id) {
  const result = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id)
  return result.changes > 0
}

export function getProductsByExpiryRange(startDate, endDate) {
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date BETWEEN ? AND ? AND is_active = 1
    ORDER BY expiry_date ASC
  `).all(startDate, endDate)
}

export function getExpiredProducts() {
  const today = new Date().toISOString().split('T')[0]
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date < ? AND is_active = 1
    ORDER BY expiry_date ASC
  `).all(today)
}

export function getExpiringTodayProducts() {
  const today = new Date().toISOString().split('T')[0]
  return db.prepare('SELECT * FROM products WHERE expiry_date = ? AND is_active = 1').all(today)
}

export function getExpiringSoonProducts(days = 3) {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + days)
  
  const todayStr = today.toISOString().split('T')[0]
  const futureStr = futureDate.toISOString().split('T')[0]
  
  return db.prepare(`
    SELECT * FROM products 
    WHERE expiry_date > ? AND expiry_date <= ? AND is_active = 1
    ORDER BY expiry_date ASC
  `).all(todayStr, futureStr)
}

export function getActiveProducts() {
  return db.prepare('SELECT * FROM products WHERE quantity > 0 AND is_active = 1 ORDER BY expiry_date ASC').all()
}

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
    total: db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count,
    expired: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date < ? AND is_active = 1').get(todayStr).count,
    critical: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date >= ? AND expiry_date <= ? AND is_active = 1').get(todayStr, threeDaysStr).count,
    warning: db.prepare('SELECT COUNT(*) as count FROM products WHERE expiry_date > ? AND expiry_date <= ? AND is_active = 1').get(threeDaysStr, sevenDaysStr).count
  }
  
  stats.good = stats.total - stats.expired - stats.critical - stats.warning
  
  return stats
}

// ═══════════════════════════════════════════════════════════════
// USER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getUserByEmail(email) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (user && user.departments) {
    try { user.departments = JSON.parse(user.departments) } catch { user.departments = [] }
  }
  return user
}

export function getUserByLogin(login) {
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login)
  if (user && user.departments) {
    try { user.departments = JSON.parse(user.departments) } catch { user.departments = [] }
  }
  return user
}

export function getUserByLoginOrEmail(identifier) {
  const isEmail = identifier.includes('@')
  const user = isEmail 
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(identifier)
    : db.prepare('SELECT * FROM users WHERE login = ?').get(identifier)
  
  if (user && user.departments) {
    try { user.departments = JSON.parse(user.departments) } catch { user.departments = [] }
  }
  return user
}

export function getUserByTelegramId(chatId) {
  const user = db.prepare('SELECT * FROM users WHERE telegram_chat_id = ?').get(String(chatId))
  if (user && user.departments) {
    try { user.departments = JSON.parse(user.departments) } catch { user.departments = [] }
  }
  return user
}

export function updateUserTelegram(userId, chatId, username = null) {
  return db.prepare(`
    UPDATE users SET telegram_chat_id = ?, telegram_username = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(String(chatId), username, userId)
}

export function getAllUsers() {
  const users = db.prepare(`
    SELECT id, login, name, email, role, departments, telegram_chat_id, telegram_username, is_active, created_at 
    FROM users 
    ORDER BY created_at DESC
  `).all()
  return users.map(u => ({
    ...u,
    departments: u.departments ? JSON.parse(u.departments) : []
  }))
}

export function createUser(user) {
  const { login, name, email, password, role, departments } = user
  const hashedPassword = bcrypt.hashSync(password, 10)
  
  const result = db.prepare(`
    INSERT INTO users (login, name, email, password, role, departments, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(login, name, email, hashedPassword, role || 'staff', departments ? JSON.stringify(departments) : null)
  
  return { id: result.lastInsertRowid, login, name, email, role: role || 'staff' }
}

export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION & COLLECTION LOGS
// ═══════════════════════════════════════════════════════════════

export function logNotification(type, message, productsCount, status = 'sent', content = null, sentBy = null) {
  db.prepare(`
    INSERT INTO notifications_log (type, message, products_count, status, content, sent_by) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, message, productsCount, status, content ? JSON.stringify(content) : null, sentBy)
}

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

export function logCollection(data) {
  const { batchId, productName, departmentId, expiryDate, quantity, collectedBy, reason } = data
  return db.prepare(`
    INSERT INTO collection_logs (batch_id, product_name, department_id, expiry_date, quantity, collected_by, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, productName, departmentId, expiryDate, quantity, collectedBy, reason || 'manual')
}

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

// ═══════════════════════════════════════════════════════════════
// SETTINGS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)
  return row ? row.value : null
}

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

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM system_settings').all()
  const settings = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllDepartments() {
  return db.prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY sort_order ASC').all()
}

export function getDepartmentById(id) {
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(id)
}

export function createDepartment(dept) {
  const { id, name, name_en, name_kk, color, icon } = dept
  db.prepare(`
    INSERT INTO departments (id, name, name_en, name_kk, color, icon, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, name_en, name_kk, color || '#FF8D6B', icon || 'package')
  return dept
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllCategories() {
  return db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all()
}

export function getCategoryById(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
}

export function createCategory(cat) {
  const { name, name_en, name_kk, color, icon } = cat
  const result = db.prepare(`
    INSERT INTO categories (name, name_en, name_kk, color, icon, is_active) 
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name, name_en, name_kk, color || '#6B6560', icon)
  return { id: result.lastInsertRowid, ...cat }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export default {
  initDatabase,
  getDb,
  resetDatabase,
  // Products
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getExpiredProducts,
  getExpiringTodayProducts,
  getExpiringSoonProducts,
  getActiveProducts,
  getStats,
  // Users
  getUserByEmail,
  getUserByLogin,
  getUserByLoginOrEmail,
  getUserByTelegramId,
  updateUserTelegram,
  getAllUsers,
  createUser,
  verifyPassword,
  // Notifications
  logNotification,
  getNotificationLogs,
  getNotificationLogsCount,
  // Collections
  logCollection,
  getCollectionLogs,
  getCollectionLogsCount,
  getCollectionStats,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // Departments
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  // Categories
  getAllCategories,
  getCategoryById,
  createCategory
}
