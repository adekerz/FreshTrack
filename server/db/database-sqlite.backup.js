/**
 * FreshTrack Pilot Database
 * Multi-hotel architecture for Ritz-Carlton Astana Honor Bar pilot
 * Version: 2.0.0
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'freshtrack.db')

// Database instance - exported for direct queries
export let db = null

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

  console.log('📦 Initializing FreshTrack Pilot Database...')
  console.log('   Multi-hotel architecture ready')

  // ═══════════════════════════════════════════════════════════════
  // CORE TABLES - MULTI-HOTEL ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════

  // 1. Hotels (отели)
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      city TEXT,
      country TEXT DEFAULT 'Kazakhstan',
      timezone TEXT DEFAULT 'Asia/Almaty',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 2. Departments (отделы отеля)
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      type TEXT DEFAULT 'other',
      color TEXT DEFAULT '#FF8D6B',
      icon TEXT DEFAULT 'package',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id)
    )
  `)

  // 3. Users (пользователи с hotel_id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'STAFF',
      hotel_id TEXT,
      department_id TEXT,
      telegram_chat_id TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `)

  // 4. Categories (категории продуктов)
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      color TEXT DEFAULT '#6B6560',
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id)
    )
  `)

  // 5. Products (справочник продуктов)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      category_id TEXT,
      name TEXT NOT NULL,
      name_en TEXT,
      name_kk TEXT,
      barcode TEXT,
      default_shelf_life INTEGER DEFAULT 30,
      unit TEXT DEFAULT 'pcs',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `)

  // 6. Batches (партии товаров с датами)
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      expiry_date DATE NOT NULL,
      batch_number TEXT,
      status TEXT DEFAULT 'active',
      added_by TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      collected_at DATETIME,
      collected_by TEXT,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (added_by) REFERENCES users(id),
      FOREIGN KEY (collected_by) REFERENCES users(id)
    )
  `)

  // 7. Write-offs (списания - журнал)
  db.exec(`
    CREATE TABLE IF NOT EXISTS write_offs (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT DEFAULT 'expired',
      comment TEXT,
      written_off_by TEXT NOT NULL,
      written_off_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (written_off_by) REFERENCES users(id)
    )
  `)

  // 8. Notifications (уведомления)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      department_id TEXT,
      type TEXT DEFAULT 'expiry',
      title TEXT NOT NULL,
      message TEXT,
      batch_id TEXT,
      is_read INTEGER DEFAULT 0,
      sent_telegram INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `)

  // 9. Audit Logs (журнал действий)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      hotel_id TEXT,
      user_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // 10. Settings (настройки отеля)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hotel_id, key),
      FOREIGN KEY (hotel_id) REFERENCES hotels(id)
    )
  `)

  // 11. Delivery Templates (шаблоны поставок)
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_templates (
      id TEXT PRIMARY KEY,
      hotel_id TEXT NOT NULL,
      department_id TEXT,
      name TEXT NOT NULL,
      items TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // ═══════════════════════════════════════════════════════════════
  // INDEXES
  // ═══════════════════════════════════════════════════════════════

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_departments_hotel ON departments(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_users_hotel ON users(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
    CREATE INDEX IF NOT EXISTS idx_categories_hotel ON categories(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_products_hotel ON products(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_batches_hotel ON batches(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_batches_department ON batches(department_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
    CREATE INDEX IF NOT EXISTS idx_write_offs_hotel ON write_offs(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_write_offs_date ON write_offs(written_off_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_hotel ON notifications(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel ON audit_logs(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_settings_hotel ON settings(hotel_id);
  `)

  // ═══════════════════════════════════════════════════════════════
  // PILOT DATA INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  initializePilotData()

  console.log('✅ Database initialized successfully')
  console.log('   Pilot: Ritz-Carlton Astana Honor Bar')
  
  return db
}

/**
 * Initialize pilot data for Ritz-Carlton Astana Honor Bar
 */
function initializePilotData() {
  // Check if pilot data already exists
  const hotelExists = db.prepare('SELECT id FROM hotels WHERE code = ?').get('RC-ASTANA')
  if (hotelExists) {
    console.log('   Pilot data already exists')
    return
  }

  console.log('🏨 Creating pilot data for Ritz-Carlton Astana...')

  // 1. Create Hotel
  const hotelId = uuidv4()
  db.prepare(`
    INSERT INTO hotels (id, name, code, city, country, timezone) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(hotelId, 'The Ritz-Carlton, Astana', 'RC-ASTANA', 'Astana', 'Kazakhstan', 'Asia/Almaty')

  // 2. Create Honor Bar Department
  const deptId = uuidv4()
  db.prepare(`
    INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(deptId, hotelId, 'Хонор Бар', 'Honor Bar', 'Хонор Бар', 'minibar', '#FF8D6B', 'wine')

  // 3. Create Users
  const superAdminId = uuidv4()
  const hotelAdminId = uuidv4()
  const staffId = uuidv4()

  // Super Admin (no hotel restriction)
  db.prepare(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(superAdminId, 'superadmin', bcrypt.hashSync('SuperAdmin123!', 10), 'Супер Администратор', 'SUPER_ADMIN', null, null, 1)

  // Hotel Admin (Ritz-Carlton)
  db.prepare(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(hotelAdminId, 'hoteladmin', bcrypt.hashSync('HotelAdmin123!', 10), 'Администратор Отеля', 'HOTEL_ADMIN', hotelId, null, 1)

  // Staff (Honor Bar)
  db.prepare(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(staffId, 'honorbar', bcrypt.hashSync('Staff123!', 10), 'Сотрудник Honor Bar', 'STAFF', hotelId, deptId, 1)

  // 4. Create Categories for Honor Bar
  const categories = [
    { id: uuidv4(), name: 'Безалкогольные напитки', name_en: 'Soft Drinks', name_kk: 'Алкогольсіз сусындар', color: '#4A90D9', icon: 'cup' },
    { id: uuidv4(), name: 'Алкогольные напитки', name_en: 'Alcohol Drinks', name_kk: 'Алкогольді сусындар', color: '#722F37', icon: 'wine' },
    { id: uuidv4(), name: 'Еда', name_en: 'Food', name_kk: 'Тағам', color: '#8B4513', icon: 'cookie' },
    { id: uuidv4(), name: 'Другое', name_en: 'Other', name_kk: 'Басқа', color: '#6B7280', icon: 'package' }
  ]

  const categoryMap = {}
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    db.prepare(`
      INSERT INTO categories (id, hotel_id, name, name_en, name_kk, color, icon, sort_order) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cat.id, hotelId, cat.name, cat.name_en, cat.name_kk, cat.color, cat.icon, i)
    categoryMap[cat.name_en] = cat.id
  }

  // 5. Create Products for Honor Bar
  const products = [
    // Soft Drinks
    { name: 'Pepsi', name_en: 'Pepsi', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Coca-Cola Original', name_en: 'Coca-Cola Original', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Fanta', name_en: 'Fanta', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Sprite', name_en: 'Sprite', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: '7 Up', name_en: '7 Up', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Mirinda', name_en: 'Mirinda', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Pago Apple', name_en: 'Pago Apple', category: 'Soft Drinks', unit: 'шт', shelf_life: 365 },
    { name: 'Pago Orange', name_en: 'Pago Orange', category: 'Soft Drinks', unit: 'шт', shelf_life: 365 },
    { name: 'Red Bull', name_en: 'Red Bull', category: 'Soft Drinks', unit: 'шт', shelf_life: 365 },
    { name: 'San Pellegrino Sparkling', name_en: 'San Pellegrino Sparkling', category: 'Soft Drinks', unit: 'шт', shelf_life: 730 },
    { name: 'Acqua Panna Still', name_en: 'Acqua Panna Still', category: 'Soft Drinks', unit: 'шт', shelf_life: 730 },
    { name: 'Coca-Cola Zero', name_en: 'Coca-Cola Zero', category: 'Soft Drinks', unit: 'шт', shelf_life: 180 },
    // Alcohol Drinks
    { name: 'Budweiser', name_en: 'Budweiser', category: 'Alcohol Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Corona', name_en: 'Corona', category: 'Alcohol Drinks', unit: 'шт', shelf_life: 180 },
    // Food
    { name: 'Kazakhstan Chocolate', name_en: 'Kazakhstan Chocolate', category: 'Food', unit: 'шт', shelf_life: 365 },
    { name: 'Snickers', name_en: 'Snickers', category: 'Food', unit: 'шт', shelf_life: 365 },
    { name: 'Mars', name_en: 'Mars', category: 'Food', unit: 'шт', shelf_life: 365 },
    { name: 'Chewing Gum', name_en: 'Chewing Gum', category: 'Food', unit: 'шт', shelf_life: 730 },
    { name: 'Ritter Sport', name_en: 'Ritter Sport', category: 'Food', unit: 'шт', shelf_life: 365 },
    { name: 'Pistachio', name_en: 'Pistachio', category: 'Food', unit: 'шт', shelf_life: 180 },
    { name: 'Cashew', name_en: 'Cashew', category: 'Food', unit: 'шт', shelf_life: 180 },
    { name: 'Chocolate Peanuts', name_en: 'Chocolate Peanuts', category: 'Food', unit: 'шт', shelf_life: 180 },
    { name: 'Gummy Bears', name_en: 'Gummy Bears', category: 'Food', unit: 'шт', shelf_life: 365 },
    { name: 'Potato Chips', name_en: 'Potato Chips', category: 'Food', unit: 'шт', shelf_life: 90 },
    { name: 'Fruit Chips', name_en: 'Fruit Chips', category: 'Food', unit: 'шт', shelf_life: 90 },
    // Other
    { name: 'Feminine Pack', name_en: 'Feminine Pack', category: 'Other', unit: 'шт', shelf_life: 1095 }
  ]

  for (const product of products) {
    const catId = categoryMap[product.category]
    db.prepare(`
      INSERT INTO products (id, hotel_id, category_id, name, name_en, default_shelf_life, unit) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), hotelId, catId, product.name, product.name_en, product.shelf_life, product.unit)
  }

  // 6. Create Default Settings
  const defaultSettings = [
    { key: 'warning_days', value: '7' },
    { key: 'critical_days', value: '3' },
    { key: 'notification_time', value: '09:00' },
    { key: 'telegram_enabled', value: 'false' },
    { key: 'language', value: 'ru' }
  ]

  for (const setting of defaultSettings) {
    db.prepare(`
      INSERT INTO settings (id, hotel_id, key, value) 
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), hotelId, setting.key, setting.value)
  }

  console.log('')
  console.log('┌──────────────────────────────────────────────────────┐')
  console.log('│  🏨 PILOT: RITZ-CARLTON ASTANA HONOR BAR             │')
  console.log('├──────────────────────────────────────────────────────┤')
  console.log('│  Hotel: The Ritz-Carlton, Astana (RC-ASTANA)         │')
  console.log('│  Department: Honor Bar (minibar)                     │')
  console.log('├──────────────────────────────────────────────────────┤')
  console.log('│  CATEGORIES: 4 (Soft Drinks, Alcohol, Food, Other)   │')
  console.log('│  PRODUCTS: 26 items                                  │')
  console.log('├──────────────────────────────────────────────────────┤')
  console.log('│  USERS:                                              │')
  console.log('│  1. superadmin / SuperAdmin123! (SUPER_ADMIN)        │')
  console.log('│  2. hoteladmin / HotelAdmin123! (HOTEL_ADMIN)        │')
  console.log('│  3. honorbar / Staff123! (STAFF)                     │')
  console.log('├──────────────────────────────────────────────────────┤')
  console.log('│  ⚠️  CHANGE PASSWORDS AFTER FIRST LOGIN!             │')
  console.log('└──────────────────────────────────────────────────────┘')
  console.log('')
}

/**
 * Log audit action
 */
export function logAudit(data) {
  const { hotel_id, user_id, user_name, action, entity_type, entity_id, details, ip_address } = data
  db.prepare(`
    INSERT INTO audit_logs (id, hotel_id, user_id, user_name, action, entity_type, entity_id, details, ip_address) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), hotel_id, user_id, user_name, action, entity_type, entity_id, 
    details ? JSON.stringify(details) : null, ip_address)
}

// ═══════════════════════════════════════════════════════════════
// USER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getUserByLogin(login) {
  return db.prepare('SELECT * FROM users WHERE login = ? AND is_active = 1').get(login)
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(id)
}

export function getUserByLoginOrEmail(identifier) {
  const isEmail = identifier.includes('@')
  if (isEmail) {
    return db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(identifier)
  }
  return db.prepare('SELECT * FROM users WHERE login = ? AND is_active = 1').get(identifier)
}

export function getAllUsers(hotelId = null) {
  if (hotelId) {
    return db.prepare(`
      SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, created_at 
      FROM users 
      WHERE hotel_id = ? OR hotel_id IS NULL
      ORDER BY created_at DESC
    `).all(hotelId)
  }
  return db.prepare(`
    SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, created_at 
    FROM users 
    ORDER BY created_at DESC
  `).all()
}

export function createUser(user) {
  const { login, name, email, password, role, hotel_id, department_id } = user
  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  
  db.prepare(`
    INSERT INTO users (id, login, name, email, password, role, hotel_id, department_id, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, login, name, email, hashedPassword, role || 'STAFF', hotel_id, department_id)
  
  return { id, login, name, email, role: role || 'STAFF', hotel_id, department_id }
}

export function updateUser(id, updates) {
  const fields = []
  const values = []
  
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email) }
  if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role) }
  if (updates.department_id !== undefined) { fields.push('department_id = ?'); values.push(updates.department_id) }
  if (updates.password !== undefined) { 
    fields.push('password = ?')
    values.push(bcrypt.hashSync(updates.password, 10))
  }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active) }
  if (updates.telegram_chat_id !== undefined) { fields.push('telegram_chat_id = ?'); values.push(updates.telegram_chat_id) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

export function updateLastLogin(userId) {
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
}

// ═══════════════════════════════════════════════════════════════
// HOTEL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllHotels() {
  return db.prepare('SELECT * FROM hotels WHERE is_active = 1 ORDER BY name ASC').all()
}

export function getHotelById(id) {
  return db.prepare('SELECT * FROM hotels WHERE id = ?').get(id)
}

export function getHotelByCode(code) {
  return db.prepare('SELECT * FROM hotels WHERE code = ?').get(code)
}

export function createHotel(hotel) {
  const { name, code, address, city, country, timezone } = hotel
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO hotels (id, name, code, address, city, country, timezone) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, code, address, city, country || 'Kazakhstan', timezone || 'Asia/Almaty')
  
  return { id, name, code, address, city, country, timezone }
}

export function updateHotel(id, updates) {
  const fields = []
  const values = []
  
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.address !== undefined) { fields.push('address = ?'); values.push(updates.address) }
  if (updates.city !== undefined) { fields.push('city = ?'); values.push(updates.city) }
  if (updates.country !== undefined) { fields.push('country = ?'); values.push(updates.country) }
  if (updates.timezone !== undefined) { fields.push('timezone = ?'); values.push(updates.timezone) }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE hotels SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllDepartments(hotelId = null) {
  if (hotelId) {
    return db.prepare('SELECT * FROM departments WHERE hotel_id = ? AND is_active = 1 ORDER BY name ASC').all(hotelId)
  }
  return db.prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY name ASC').all()
}

export function getDepartmentById(id) {
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(id)
}

export function createDepartment(dept) {
  const { hotel_id, name, name_en, name_kk, type, color, icon } = dept
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, hotel_id, name, name_en, name_kk, type || 'other', color || '#FF8D6B', icon || 'package')
  
  return { id, hotel_id, name, name_en, name_kk, type, color, icon }
}

export function updateDepartment(id, updates) {
  const fields = []
  const values = []
  
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push('name_en = ?'); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push('name_kk = ?'); values.push(updates.name_kk) }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type) }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function deleteDepartment(id) {
  const result = db.prepare('UPDATE departments SET is_active = 0 WHERE id = ?').run(id)
  return result.changes > 0
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllCategories(hotelId = null) {
  if (hotelId) {
    return db.prepare('SELECT * FROM categories WHERE hotel_id = ? AND is_active = 1 ORDER BY sort_order ASC').all(hotelId)
  }
  return db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all()
}

export function getCategoryById(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
}

export function createCategory(cat) {
  const { hotel_id, name, name_en, name_kk, color, icon, sort_order } = cat
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO categories (id, hotel_id, name, name_en, name_kk, color, icon, sort_order) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, hotel_id, name, name_en, name_kk, color || '#6B6560', icon, sort_order || 0)
  
  return { id, hotel_id, name, name_en, name_kk, color, icon, sort_order }
}

export function updateCategory(id, updates) {
  const fields = []
  const values = []
  
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push('name_en = ?'); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push('name_kk = ?'); values.push(updates.name_kk) }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
  if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order) }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function deleteCategory(id) {
  const result = db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id)
  return result.changes > 0
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllProducts(hotelId = null) {
  if (hotelId) {
    return db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.hotel_id = ? AND p.is_active = 1 
      ORDER BY p.name ASC
    `).all(hotelId)
  }
  return db.prepare(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1 
    ORDER BY p.name ASC
  `).all()
}

export function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
}

export function getProductByName(name, hotelId = null) {
  if (hotelId) {
    return db.prepare('SELECT * FROM products WHERE name = ? AND hotel_id = ? AND is_active = 1').get(name, hotelId)
  }
  return db.prepare('SELECT * FROM products WHERE name = ? AND is_active = 1').get(name)
}

export function createProduct(product) {
  const { hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit } = product
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO products (id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life || 30, unit || 'pcs')
  
  return { id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit }
}

export function updateProduct(id, updates) {
  const fields = []
  const values = []
  
  if (updates.category_id !== undefined) { fields.push('category_id = ?'); values.push(updates.category_id) }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push('name_en = ?'); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push('name_kk = ?'); values.push(updates.name_kk) }
  if (updates.barcode !== undefined) { fields.push('barcode = ?'); values.push(updates.barcode) }
  if (updates.default_shelf_life !== undefined) { fields.push('default_shelf_life = ?'); values.push(updates.default_shelf_life) }
  if (updates.unit !== undefined) { fields.push('unit = ?'); values.push(updates.unit) }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function deleteProduct(id) {
  const result = db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id)
  return result.changes > 0
}

// ═══════════════════════════════════════════════════════════════
// BATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAllBatches(hotelId, departmentId = null, status = null) {
  let query = `
    SELECT b.*, p.name as product_name, p.barcode, c.name as category_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.hotel_id = ?
  `
  const params = [hotelId]
  
  if (departmentId) {
    query += ' AND b.department_id = ?'
    params.push(departmentId)
  }
  
  if (status) {
    query += ' AND b.status = ?'
    params.push(status)
  }
  
  query += ' ORDER BY b.expiry_date ASC'
  
  return db.prepare(query).all(...params)
}

export function getBatchById(id) {
  return db.prepare(`
    SELECT b.*, p.name as product_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.id = ?
  `).get(id)
}

export function createBatch(batch) {
  const { hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by } = batch
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(id, hotel_id, department_id, product_id, quantity || 1, expiry_date, batch_number, added_by)
  
  return { id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, status: 'active' }
}

export function updateBatch(id, updates) {
  const fields = []
  const values = []
  
  if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity) }
  if (updates.expiry_date !== undefined) { fields.push('expiry_date = ?'); values.push(updates.expiry_date) }
  if (updates.batch_number !== undefined) { fields.push('batch_number = ?'); values.push(updates.batch_number) }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
  if (updates.collected_at !== undefined) { fields.push('collected_at = ?'); values.push(updates.collected_at) }
  if (updates.collected_by !== undefined) { fields.push('collected_by = ?'); values.push(updates.collected_by) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE batches SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function collectBatch(batchId, userId, reason = 'expired', comment = null) {
  const batch = getBatchById(batchId)
  if (!batch) return null
  
  const product = getProductById(batch.product_id)
  
  // Create write-off record
  const writeOffId = uuidv4()
  db.prepare(`
    INSERT INTO write_offs (id, hotel_id, department_id, batch_id, product_id, product_name, quantity, reason, comment, written_off_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(writeOffId, batch.hotel_id, batch.department_id, batchId, batch.product_id, 
    product?.name || batch.product_name, batch.quantity, reason, comment, userId)
  
  // Update batch status
  db.prepare(`
    UPDATE batches SET status = 'collected', collected_at = CURRENT_TIMESTAMP, collected_by = ? WHERE id = ?
  `).run(userId, batchId)
  
  return { writeOffId, batchId }
}

export function getExpiringBatches(hotelId, days = 7) {
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const futureDateStr = futureDate.toISOString().split('T')[0]
  
  return db.prepare(`
    SELECT b.*, p.name as product_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.hotel_id = ? AND b.status = 'active' 
    AND b.expiry_date >= ? AND b.expiry_date <= ?
    ORDER BY b.expiry_date ASC
  `).all(hotelId, today, futureDateStr)
}

export function getExpiredBatches(hotelId) {
  const today = new Date().toISOString().split('T')[0]
  
  return db.prepare(`
    SELECT b.*, p.name as product_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.hotel_id = ? AND b.status = 'active' AND b.expiry_date < ?
    ORDER BY b.expiry_date ASC
  `).all(hotelId, today)
}

export function getBatchStats(hotelId, departmentId = null) {
  const today = new Date().toISOString().split('T')[0]
  
  const threeDaysLater = new Date()
  threeDaysLater.setDate(threeDaysLater.getDate() + 3)
  const threeDaysStr = threeDaysLater.toISOString().split('T')[0]
  
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  const sevenDaysStr = sevenDaysLater.toISOString().split('T')[0]
  
  let whereClause = 'hotel_id = ? AND status = \'active\''
  const params = [hotelId]
  
  if (departmentId) {
    whereClause += ' AND department_id = ?'
    params.push(departmentId)
  }
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause}`).get(...params).count
  const expired = db.prepare(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date < ?`).get(...params, today).count
  const critical = db.prepare(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date >= ? AND expiry_date <= ?`).get(...params, today, threeDaysStr).count
  const warning = db.prepare(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date > ? AND expiry_date <= ?`).get(...params, threeDaysStr, sevenDaysStr).count
  
  return {
    total,
    expired,
    critical,
    warning,
    good: total - expired - critical - warning
  }
}

// ═══════════════════════════════════════════════════════════════
// WRITE-OFF FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getWriteOffs(hotelId, filters = {}) {
  let query = `
    SELECT wo.*, u.name as written_off_by_name, d.name as department_name
    FROM write_offs wo
    LEFT JOIN users u ON wo.written_off_by = u.id
    JOIN departments d ON wo.department_id = d.id
    WHERE wo.hotel_id = ?
  `
  const params = [hotelId]
  
  if (filters.departmentId) {
    query += ' AND wo.department_id = ?'
    params.push(filters.departmentId)
  }
  
  if (filters.startDate) {
    query += ' AND DATE(wo.written_off_at) >= ?'
    params.push(filters.startDate)
  }
  
  if (filters.endDate) {
    query += ' AND DATE(wo.written_off_at) <= ?'
    params.push(filters.endDate)
  }
  
  if (filters.reason) {
    query += ' AND wo.reason = ?'
    params.push(filters.reason)
  }
  
  query += ' ORDER BY wo.written_off_at DESC'
  
  if (filters.limit) {
    query += ' LIMIT ?'
    params.push(filters.limit)
  }
  
  return db.prepare(query).all(...params)
}

export function getWriteOffStats(hotelId, startDate = null, endDate = null) {
  let query = `
    SELECT 
      COUNT(*) as total_count,
      SUM(quantity) as total_quantity,
      reason,
      DATE(written_off_at) as date
    FROM write_offs
    WHERE hotel_id = ?
  `
  const params = [hotelId]
  
  if (startDate) {
    query += ' AND DATE(written_off_at) >= ?'
    params.push(startDate)
  }
  
  if (endDate) {
    query += ' AND DATE(written_off_at) <= ?'
    params.push(endDate)
  }
  
  query += ' GROUP BY DATE(written_off_at), reason ORDER BY date DESC'
  
  return db.prepare(query).all(...params)
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function createNotification(data) {
  const { hotel_id, department_id, type, title, message, batch_id } = data
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO notifications (id, hotel_id, department_id, type, title, message, batch_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, hotel_id, department_id, type || 'expiry', title, message, batch_id)
  
  return { id, hotel_id, department_id, type, title, message, batch_id }
}

export function getNotifications(hotelId, filters = {}) {
  let query = 'SELECT * FROM notifications WHERE hotel_id = ?'
  const params = [hotelId]
  
  if (filters.departmentId) {
    query += ' AND (department_id = ? OR department_id IS NULL)'
    params.push(filters.departmentId)
  }
  
  if (filters.isRead !== undefined) {
    query += ' AND is_read = ?'
    params.push(filters.isRead ? 1 : 0)
  }
  
  if (filters.type) {
    query += ' AND type = ?'
    params.push(filters.type)
  }
  
  query += ' ORDER BY created_at DESC'
  
  if (filters.limit) {
    query += ' LIMIT ?'
    params.push(filters.limit)
  }
  
  return db.prepare(query).all(...params)
}

export function markNotificationRead(id) {
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)
  return result.changes > 0
}

export function markAllNotificationsRead(hotelId, departmentId = null) {
  let query = 'UPDATE notifications SET is_read = 1 WHERE hotel_id = ?'
  const params = [hotelId]
  
  if (departmentId) {
    query += ' AND (department_id = ? OR department_id IS NULL)'
    params.push(departmentId)
  }
  
  const result = db.prepare(query).run(...params)
  return result.changes
}

export function getUnreadNotificationCount(hotelId, departmentId = null) {
  let query = 'SELECT COUNT(*) as count FROM notifications WHERE hotel_id = ? AND is_read = 0'
  const params = [hotelId]
  
  if (departmentId) {
    query += ' AND (department_id = ? OR department_id IS NULL)'
    params.push(departmentId)
  }
  
  return db.prepare(query).get(...params).count
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getSetting(hotelId, key) {
  const row = db.prepare('SELECT value FROM settings WHERE hotel_id = ? AND key = ?').get(hotelId, key)
  return row ? row.value : null
}

export function setSetting(hotelId, key, value) {
  const exists = db.prepare('SELECT id FROM settings WHERE hotel_id = ? AND key = ?').get(hotelId, key)
  
  if (exists) {
    db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE hotel_id = ? AND key = ?')
      .run(value, hotelId, key)
  } else {
    db.prepare('INSERT INTO settings (id, hotel_id, key, value) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), hotelId, key, value)
  }
}

export function getAllSettings(hotelId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE hotel_id = ?').all(hotelId)
  const settings = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY TEMPLATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getDeliveryTemplates(hotelId, departmentId = null) {
  let query = 'SELECT * FROM delivery_templates WHERE hotel_id = ?'
  const params = [hotelId]
  
  if (departmentId) {
    query += ' AND (department_id = ? OR department_id IS NULL)'
    params.push(departmentId)
  }
  
  query += ' ORDER BY name ASC'
  
  const templates = db.prepare(query).all(...params)
  return templates.map(t => ({
    ...t,
    items: JSON.parse(t.items || '[]')
  }))
}

export function createDeliveryTemplate(template) {
  const { hotel_id, department_id, name, items, created_by } = template
  const id = uuidv4()
  
  db.prepare(`
    INSERT INTO delivery_templates (id, hotel_id, department_id, name, items, created_by) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, hotel_id, department_id, name, JSON.stringify(items), created_by)
  
  return { id, hotel_id, department_id, name, items }
}

export function updateDeliveryTemplate(id, updates) {
  const fields = []
  const values = []
  
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.items !== undefined) { fields.push('items = ?'); values.push(JSON.stringify(updates.items)) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = db.prepare(`UPDATE delivery_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return result.changes > 0
}

export function deleteDeliveryTemplate(id) {
  const result = db.prepare('DELETE FROM delivery_templates WHERE id = ?').run(id)
  return result.changes > 0
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAuditLogs(hotelId, filters = {}) {
  let query = 'SELECT * FROM audit_logs WHERE hotel_id = ?'
  const params = [hotelId]
  
  if (filters.userId) {
    query += ' AND user_id = ?'
    params.push(filters.userId)
  }
  
  if (filters.action) {
    query += ' AND action = ?'
    params.push(filters.action)
  }
  
  if (filters.entityType) {
    query += ' AND entity_type = ?'
    params.push(filters.entityType)
  }
  
  if (filters.startDate) {
    query += ' AND DATE(created_at) >= ?'
    params.push(filters.startDate)
  }
  
  if (filters.endDate) {
    query += ' AND DATE(created_at) <= ?'
    params.push(filters.endDate)
  }
  
  query += ' ORDER BY created_at DESC'
  
  if (filters.limit) {
    query += ' LIMIT ?'
    params.push(filters.limit)
  }
  
  if (filters.offset) {
    query += ' OFFSET ?'
    params.push(filters.offset)
  }
  
  const logs = db.prepare(query).all(...params)
  return logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null
  }))
}

// ═══════════════════════════════════════════════════════════════
// PILOT REPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getPilotSummary(hotelId) {
  const totalBatches = db.prepare('SELECT COUNT(*) as count FROM batches WHERE hotel_id = ?').get(hotelId).count
  const activeBatches = db.prepare('SELECT COUNT(*) as count FROM batches WHERE hotel_id = ? AND status = \'active\'').get(hotelId).count
  const collectedBatches = db.prepare('SELECT COUNT(*) as count FROM batches WHERE hotel_id = ? AND status = \'collected\'').get(hotelId).count
  
  const totalWriteOffs = db.prepare('SELECT COUNT(*) as count FROM write_offs WHERE hotel_id = ?').get(hotelId).count
  const writeOffQuantity = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM write_offs WHERE hotel_id = ?').get(hotelId).total
  
  const writeOffsByReason = db.prepare(`
    SELECT reason, COUNT(*) as count, SUM(quantity) as quantity
    FROM write_offs WHERE hotel_id = ?
    GROUP BY reason
  `).all(hotelId)
  
  const notificationsSent = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE hotel_id = ?').get(hotelId).count
  
  return {
    batches: {
      total: totalBatches,
      active: activeBatches,
      collected: collectedBatches
    },
    writeOffs: {
      total: totalWriteOffs,
      quantity: writeOffQuantity,
      byReason: writeOffsByReason
    },
    notifications: {
      total: notificationsSent
    }
  }
}

// All functions are exported inline with 'export function'
// db is exported as 'export let db'
