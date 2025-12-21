/**
 * FreshTrack PostgreSQL Database
 * Multi-hotel architecture for Ritz-Carlton Astana Honor Bar pilot
 * Version: 2.0.0 - PostgreSQL Migration
 */

import { query, getClient, testConnection } from './postgres.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Initialize database - run migrations and seed data
 */
export async function initDatabase() {
  console.log('📦 Initializing FreshTrack PostgreSQL Database...')
  console.log('   Multi-hotel architecture ready')

  try {
    // Test connection first
    const connected = await testConnection()
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL')
    }

    // Run schema migration
    const schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql')
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8')
      await query(schema)
      console.log('✅ Schema migration completed')
    }

    // Check if pilot data exists
    const hotelsResult = await query("SELECT id FROM hotels WHERE code = $1", ['RC-ASTANA'])
    if (hotelsResult.rows.length === 0) {
      await initializePilotData()
    } else {
      console.log('   Pilot data already exists')
    }

    console.log('✅ Database initialized successfully')
    console.log('   Pilot: Ritz-Carlton Astana Honor Bar')
    
    return true
  } catch (error) {
    console.error('❌ Database initialization error:', error)
    throw error
  }
}

/**
 * Initialize pilot data for Ritz-Carlton Astana Honor Bar
 */
async function initializePilotData() {
  console.log('🏨 Creating pilot data for Ritz-Carlton Astana...')

  // 1. Create Hotel
  const hotelId = uuidv4()
  await query(`
    INSERT INTO hotels (id, name, code, city, country, timezone) 
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [hotelId, 'The Ritz-Carlton, Astana', 'RC-ASTANA', 'Astana', 'Kazakhstan', 'Asia/Almaty'])

  // 2. Create Honor Bar Department
  const deptId = uuidv4()
  await query(`
    INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [deptId, hotelId, 'Хонор Бар', 'Honor Bar', 'Хонор Бар', 'minibar', '#FF8D6B', 'wine'])

  // 3. Create Users
  const superAdminId = uuidv4()
  const hotelAdminId = uuidv4()
  const staffId = uuidv4()

  // Super Admin (no hotel restriction)
  await query(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [superAdminId, 'superadmin', bcrypt.hashSync('SuperAdmin123!', 10), 'Супер Администратор', 'SUPER_ADMIN', null, null, true])

  // Hotel Admin (Ritz-Carlton)
  await query(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [hotelAdminId, 'hoteladmin', bcrypt.hashSync('HotelAdmin123!', 10), 'Администратор Отеля', 'HOTEL_ADMIN', hotelId, null, true])

  // Staff (Honor Bar)
  await query(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [staffId, 'honorbar', bcrypt.hashSync('Staff123!', 10), 'Сотрудник Honor Bar', 'STAFF', hotelId, deptId, true])

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
    await query(`
      INSERT INTO categories (id, hotel_id, name, name_en, name_kk, color, icon, sort_order) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [cat.id, hotelId, cat.name, cat.name_en, cat.name_kk, cat.color, cat.icon, i])
    categoryMap[cat.name_en] = cat.id
  }

  // 5. Create Products for Honor Bar
  const products = [
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
    { name: 'Budweiser', name_en: 'Budweiser', category: 'Alcohol Drinks', unit: 'шт', shelf_life: 180 },
    { name: 'Corona', name_en: 'Corona', category: 'Alcohol Drinks', unit: 'шт', shelf_life: 180 },
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
    { name: 'Feminine Pack', name_en: 'Feminine Pack', category: 'Other', unit: 'шт', shelf_life: 1095 }
  ]

  for (const product of products) {
    const catId = categoryMap[product.category]
    await query(`
      INSERT INTO products (id, hotel_id, category_id, name, name_en, default_shelf_life, unit) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [uuidv4(), hotelId, catId, product.name, product.name_en, product.shelf_life, product.unit])
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
    await query(`
      INSERT INTO settings (id, hotel_id, key, value) 
      VALUES ($1, $2, $3, $4)
    `, [uuidv4(), hotelId, setting.key, setting.value])
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
export async function logAudit(data) {
  const { hotel_id, user_id, user_name, action, entity_type, entity_id, details, ip_address } = data
  await query(`
    INSERT INTO audit_logs (id, hotel_id, user_id, user_name, action, entity_type, entity_id, details, ip_address) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    uuidv4(), 
    hotel_id || null, 
    user_id || null, 
    user_name, 
    action, 
    entity_type || null, 
    entity_id || null,
    details ? JSON.stringify(details) : null, 
    ip_address || null
  ])
}

// ═══════════════════════════════════════════════════════════════
// USER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getUserByLogin(login) {
  const result = await query('SELECT * FROM users WHERE login = $1 AND is_active = TRUE', [login])
  return result.rows[0] || null
}

export async function getUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = TRUE', [id])
  return result.rows[0] || null
}

export async function getUserByLoginOrEmail(identifier) {
  const isEmail = identifier.includes('@')
  if (isEmail) {
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [identifier])
    return result.rows[0] || null
  }
  const result = await query('SELECT * FROM users WHERE login = $1 AND is_active = TRUE', [identifier])
  return result.rows[0] || null
}

export async function getAllUsers(hotelId = null) {
  if (hotelId) {
    const result = await query(`
      SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, created_at 
      FROM users 
      WHERE hotel_id = $1 OR hotel_id IS NULL
      ORDER BY created_at DESC
    `, [hotelId])
    return result.rows
  }
  const result = await query(`
    SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, created_at 
    FROM users 
    ORDER BY created_at DESC
  `)
  return result.rows
}

export async function createUser(user) {
  const { login, name, email, password, role, hotel_id, department_id } = user
  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  
  await query(`
    INSERT INTO users (id, login, name, email, password, role, hotel_id, department_id, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
  `, [id, login, name, email, hashedPassword, role || 'STAFF', hotel_id, department_id])
  
  return { id, login, name, email, role: role || 'STAFF', hotel_id, department_id }
}

export async function updateUser(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(updates.email) }
  if (updates.role !== undefined) { fields.push(`role = $${paramIndex++}`); values.push(updates.role) }
  if (updates.department_id !== undefined) { fields.push(`department_id = $${paramIndex++}`); values.push(updates.department_id) }
  if (updates.password !== undefined) { 
    fields.push(`password = $${paramIndex++}`)
    values.push(bcrypt.hashSync(updates.password, 10))
  }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  if (updates.telegram_chat_id !== undefined) { fields.push(`telegram_chat_id = $${paramIndex++}`); values.push(updates.telegram_chat_id) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

export async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userId])
}

// ═══════════════════════════════════════════════════════════════
// HOTEL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllHotels() {
  const result = await query('SELECT * FROM hotels WHERE is_active = TRUE ORDER BY name ASC')
  return result.rows
}

export async function getHotelById(id) {
  const result = await query('SELECT * FROM hotels WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function getHotelByCode(code) {
  const result = await query('SELECT * FROM hotels WHERE code = $1', [code])
  return result.rows[0] || null
}

export async function createHotel(hotel) {
  const { name, code, address, city, country, timezone } = hotel
  const id = uuidv4()
  
  await query(`
    INSERT INTO hotels (id, name, code, address, city, country, timezone) 
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id, name, code, address, city, country || 'Kazakhstan', timezone || 'Asia/Almaty'])
  
  return { id, name, code, address, city, country, timezone }
}

export async function updateHotel(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.address !== undefined) { fields.push(`address = $${paramIndex++}`); values.push(updates.address) }
  if (updates.city !== undefined) { fields.push(`city = $${paramIndex++}`); values.push(updates.city) }
  if (updates.country !== undefined) { fields.push(`country = $${paramIndex++}`); values.push(updates.country) }
  if (updates.timezone !== undefined) { fields.push(`timezone = $${paramIndex++}`); values.push(updates.timezone) }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE hotels SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllDepartments(hotelId = null) {
  if (hotelId) {
    const result = await query('SELECT * FROM departments WHERE hotel_id = $1 AND is_active = TRUE ORDER BY name ASC', [hotelId])
    return result.rows
  }
  const result = await query('SELECT * FROM departments WHERE is_active = TRUE ORDER BY name ASC')
  return result.rows
}

export async function getDepartmentById(id) {
  const result = await query('SELECT * FROM departments WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function createDepartment(dept) {
  const { hotel_id, name, name_en, name_kk, type, color, icon } = dept
  const id = uuidv4()
  
  await query(`
    INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, hotel_id, name, name_en, name_kk, type || 'other', color || '#FF8D6B', icon || 'package'])
  
  return { id, hotel_id, name, name_en, name_kk, type, color, icon }
}

export async function updateDepartment(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push(`name_en = $${paramIndex++}`); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push(`name_kk = $${paramIndex++}`); values.push(updates.name_kk) }
  if (updates.type !== undefined) { fields.push(`type = $${paramIndex++}`); values.push(updates.type) }
  if (updates.color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(updates.color) }
  if (updates.icon !== undefined) { fields.push(`icon = $${paramIndex++}`); values.push(updates.icon) }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteDepartment(id) {
  const result = await query('UPDATE departments SET is_active = FALSE WHERE id = $1', [id])
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllCategories(hotelId = null) {
  if (hotelId) {
    const result = await query('SELECT * FROM categories WHERE hotel_id = $1 AND is_active = TRUE ORDER BY sort_order ASC', [hotelId])
    return result.rows
  }
  const result = await query('SELECT * FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC')
  return result.rows
}

export async function getCategoryById(id) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function createCategory(cat) {
  const { hotel_id, name, name_en, name_kk, color, icon, sort_order } = cat
  const id = uuidv4()
  
  await query(`
    INSERT INTO categories (id, hotel_id, name, name_en, name_kk, color, icon, sort_order) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, hotel_id, name, name_en, name_kk, color || '#6B6560', icon, sort_order || 0])
  
  return { id, hotel_id, name, name_en, name_kk, color, icon, sort_order }
}

export async function updateCategory(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push(`name_en = $${paramIndex++}`); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push(`name_kk = $${paramIndex++}`); values.push(updates.name_kk) }
  if (updates.color !== undefined) { fields.push(`color = $${paramIndex++}`); values.push(updates.color) }
  if (updates.icon !== undefined) { fields.push(`icon = $${paramIndex++}`); values.push(updates.icon) }
  if (updates.sort_order !== undefined) { fields.push(`sort_order = $${paramIndex++}`); values.push(updates.sort_order) }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteCategory(id) {
  const result = await query('UPDATE categories SET is_active = FALSE WHERE id = $1', [id])
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllProducts(hotelId = null) {
  if (hotelId) {
    const result = await query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.hotel_id = $1 AND p.is_active = TRUE 
      ORDER BY p.name ASC
    `, [hotelId])
    return result.rows
  }
  const result = await query(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = TRUE 
    ORDER BY p.name ASC
  `)
  return result.rows
}

export async function getProductById(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function getProductByName(name, hotelId = null) {
  if (hotelId) {
    const result = await query('SELECT * FROM products WHERE name = $1 AND hotel_id = $2 AND is_active = TRUE', [name, hotelId])
    return result.rows[0] || null
  }
  const result = await query('SELECT * FROM products WHERE name = $1 AND is_active = TRUE', [name])
  return result.rows[0] || null
}

export async function createProduct(product) {
  const { hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit } = product
  const id = uuidv4()
  
  await query(`
    INSERT INTO products (id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life || 30, unit || 'pcs'])
  
  return { id, hotel_id, category_id, name, name_en, name_kk, barcode, default_shelf_life, unit }
}

export async function updateProduct(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.category_id !== undefined) { fields.push(`category_id = $${paramIndex++}`); values.push(updates.category_id) }
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.name_en !== undefined) { fields.push(`name_en = $${paramIndex++}`); values.push(updates.name_en) }
  if (updates.name_kk !== undefined) { fields.push(`name_kk = $${paramIndex++}`); values.push(updates.name_kk) }
  if (updates.barcode !== undefined) { fields.push(`barcode = $${paramIndex++}`); values.push(updates.barcode) }
  if (updates.default_shelf_life !== undefined) { fields.push(`default_shelf_life = $${paramIndex++}`); values.push(updates.default_shelf_life) }
  if (updates.unit !== undefined) { fields.push(`unit = $${paramIndex++}`); values.push(updates.unit) }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE products SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteProduct(id) {
  const result = await query('UPDATE products SET is_active = FALSE WHERE id = $1', [id])
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// BATCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAllBatches(hotelId, departmentId = null, status = null) {
  let queryText = `
    SELECT b.*, p.name as product_name, p.barcode, c.name as category_name, d.name as department_name,
           u.name as added_by_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN departments d ON b.department_id = d.id
    LEFT JOIN users u ON b.added_by = u.id
    WHERE b.hotel_id = $1
  `
  const params = [hotelId]
  let paramIndex = 2
  
  if (departmentId) {
    queryText += ` AND b.department_id = $${paramIndex++}`
    params.push(departmentId)
  }
  
  if (status) {
    queryText += ` AND b.status = $${paramIndex++}`
    params.push(status)
  }
  
  queryText += ' ORDER BY b.expiry_date ASC'
  
  const result = await query(queryText, params)
  return result.rows
}

export async function getBatchById(id) {
  const result = await query(`
    SELECT b.*, p.name as product_name, d.name as department_name, u.name as added_by_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    LEFT JOIN users u ON b.added_by = u.id
    WHERE b.id = $1
  `, [id])
  return result.rows[0] || null
}

export async function createBatch(batch) {
  const { hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by } = batch
  const id = uuidv4()
  
  // quantity может быть null для "без учёта количества"
  const batchQuantity = quantity === null || quantity === undefined ? null : quantity
  
  await query(`
    INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by, status) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
  `, [id, hotel_id, department_id, product_id, batchQuantity, expiry_date, batch_number, added_by])
  
  return { id, hotel_id, department_id, product_id, quantity: batchQuantity, expiry_date, batch_number, status: 'active' }
}

export async function updateBatch(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1
  
  if (updates.quantity !== undefined) { fields.push(`quantity = $${paramIndex++}`); values.push(updates.quantity) }
  if (updates.expiry_date !== undefined) { fields.push(`expiry_date = $${paramIndex++}`); values.push(updates.expiry_date) }
  if (updates.batch_number !== undefined) { fields.push(`batch_number = $${paramIndex++}`); values.push(updates.batch_number) }
  if (updates.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(updates.status) }
  if (updates.collected_at !== undefined) { fields.push(`collected_at = $${paramIndex++}`); values.push(updates.collected_at) }
  if (updates.collected_by !== undefined) { fields.push(`collected_by = $${paramIndex++}`); values.push(updates.collected_by) }
  
  if (fields.length === 0) return false
  
  values.push(id)
  const result = await query(`UPDATE batches SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteBatch(id) {
  const result = await query('DELETE FROM batches WHERE id = $1', [id])
  return result.rowCount > 0
}

export async function collectBatch(batchId, userId, reason = 'expired', comment = null) {
  const batch = await getBatchById(batchId)
  if (!batch) return null
  
  const product = await getProductById(batch.product_id)
  
  const writeOffId = uuidv4()
  await query(`
    INSERT INTO write_offs (id, hotel_id, department_id, batch_id, product_id, product_name, quantity, reason, comment, written_off_by) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [writeOffId, batch.hotel_id, batch.department_id, batchId, batch.product_id, 
    product?.name || batch.product_name, batch.quantity, reason, comment, userId])
  
  await query(`
    UPDATE batches SET status = 'collected', collected_at = CURRENT_TIMESTAMP, collected_by = $1 WHERE id = $2
  `, [userId, batchId])
  
  return { writeOffId, batchId }
}

export async function getExpiringBatches(hotelId, days = 7) {
  const result = await query(`
    SELECT b.*, p.name as product_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.hotel_id = $1 AND b.status = 'active' 
    AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + $2::INTEGER
    ORDER BY b.expiry_date ASC
  `, [hotelId, days])
  return result.rows
}

export async function getExpiredBatches(hotelId) {
  const result = await query(`
    SELECT b.*, p.name as product_name, d.name as department_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    WHERE b.hotel_id = $1 AND b.status = 'active' AND b.expiry_date < CURRENT_DATE
    ORDER BY b.expiry_date ASC
  `, [hotelId])
  return result.rows
}

export async function getBatchStats(hotelId, departmentId = null) {
  let whereClause = 'hotel_id = $1 AND status = \'active\''
  const params = [hotelId]
  let paramIndex = 2
  
  if (departmentId) {
    whereClause += ` AND department_id = $${paramIndex++}`
    params.push(departmentId)
  }
  
  const totalResult = await query(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause}`, params)
  const expiredResult = await query(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date < CURRENT_DATE`, params)
  const criticalResult = await query(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + 3`, params)
  const warningResult = await query(`SELECT COUNT(*) as count FROM batches WHERE ${whereClause} AND expiry_date > CURRENT_DATE + 3 AND expiry_date <= CURRENT_DATE + 7`, params)
  
  const total = parseInt(totalResult.rows[0].count)
  const expired = parseInt(expiredResult.rows[0].count)
  const critical = parseInt(criticalResult.rows[0].count)
  const warning = parseInt(warningResult.rows[0].count)
  
  return { total, expired, critical, warning, good: total - expired - critical - warning }
}

// ═══════════════════════════════════════════════════════════════
// WRITE-OFF FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getWriteOffs(hotelId, filters = {}) {
  let queryText = `
    SELECT 
      wo.id, wo.hotel_id, wo.batch_id, wo.product_id, wo.quantity, 
      wo.reason, wo.notes, wo.user_id, wo.created_at,
      p.name as product_name, p.department_id,
      u.name as user_name,
      b.expiry_date
    FROM write_offs wo
    LEFT JOIN products p ON wo.product_id = p.id
    LEFT JOIN users u ON wo.user_id = u.id
    LEFT JOIN batches b ON wo.batch_id = b.id
    WHERE wo.hotel_id = $1
  `
  const params = [hotelId]
  let paramIndex = 2
  
  if (filters.department_id) { queryText += ` AND p.department_id = $${paramIndex++}`; params.push(filters.department_id) }
  if (filters.start_date) { queryText += ` AND DATE(wo.created_at) >= $${paramIndex++}`; params.push(filters.start_date) }
  if (filters.end_date) { queryText += ` AND DATE(wo.created_at) <= $${paramIndex++}`; params.push(filters.end_date) }
  if (filters.reason) { queryText += ` AND wo.reason = $${paramIndex++}`; params.push(filters.reason) }
  if (filters.product_id) { queryText += ` AND wo.product_id = $${paramIndex++}`; params.push(filters.product_id) }
  
  queryText += ' ORDER BY wo.created_at DESC'
  if (filters.limit) { queryText += ` LIMIT $${paramIndex++}`; params.push(parseInt(filters.limit)) }
  if (filters.offset) { queryText += ` OFFSET $${paramIndex++}`; params.push(parseInt(filters.offset)) }
  
  const result = await query(queryText, params)
  return result.rows
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function createNotification(data) {
  const { hotel_id, department_id, type, title, message, batch_id } = data
  const id = uuidv4()
  await query(`INSERT INTO notifications (id, hotel_id, department_id, type, title, message, batch_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, hotel_id, department_id, type || 'expiry', title, message, batch_id])
  return { id, hotel_id, department_id, type, title, message, batch_id }
}

export async function getNotifications(hotelId, filters = {}) {
  let queryText = 'SELECT * FROM notifications WHERE hotel_id = $1'
  const params = [hotelId]
  let paramIndex = 2
  
  if (filters.departmentId) { queryText += ` AND (department_id = $${paramIndex++} OR department_id IS NULL)`; params.push(filters.departmentId) }
  if (filters.isRead !== undefined) { queryText += ` AND is_read = $${paramIndex++}`; params.push(filters.isRead) }
  if (filters.type) { queryText += ` AND type = $${paramIndex++}`; params.push(filters.type) }
  queryText += ' ORDER BY created_at DESC'
  if (filters.limit) { queryText += ` LIMIT $${paramIndex++}`; params.push(filters.limit) }
  
  const result = await query(queryText, params)
  return result.rows
}

export async function markNotificationRead(id) {
  const result = await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id])
  return result.rowCount > 0
}

export async function markAllNotificationsRead(hotelId, departmentId = null) {
  let queryText = 'UPDATE notifications SET is_read = TRUE WHERE hotel_id = $1'
  const params = [hotelId]
  if (departmentId) { queryText += ` AND (department_id = $2 OR department_id IS NULL)`; params.push(departmentId) }
  const result = await query(queryText, params)
  return result.rowCount
}

export async function getUnreadNotificationCount(hotelId, departmentId = null) {
  let queryText = 'SELECT COUNT(*) as count FROM notifications WHERE hotel_id = $1 AND is_read = FALSE'
  const params = [hotelId]
  if (departmentId) { queryText += ` AND (department_id = $2 OR department_id IS NULL)`; params.push(departmentId) }
  const result = await query(queryText, params)
  return parseInt(result.rows[0].count)
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getSetting(hotelId, key) {
  const result = await query('SELECT value FROM settings WHERE hotel_id = $1 AND key = $2', [hotelId, key])
  return result.rows[0]?.value || null
}

export async function setSetting(hotelId, key, value) {
  const exists = await query('SELECT id FROM settings WHERE hotel_id = $1 AND key = $2', [hotelId, key])
  if (exists.rows.length > 0) {
    await query('UPDATE settings SET value = $3, updated_at = CURRENT_TIMESTAMP WHERE hotel_id = $1 AND key = $2', [hotelId, key, value])
  } else {
    await query('INSERT INTO settings (id, hotel_id, key, value) VALUES ($1, $2, $3, $4)', [uuidv4(), hotelId, key, value])
  }
}

export async function getAllSettings(hotelId) {
  const result = await query('SELECT key, value FROM settings WHERE hotel_id = $1', [hotelId])
  const settings = {}
  for (const row of result.rows) { settings[row.key] = row.value }
  return settings
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY TEMPLATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getDeliveryTemplates(hotelId, departmentId = null) {
  let queryText = 'SELECT * FROM delivery_templates WHERE hotel_id = $1'
  const params = [hotelId]
  if (departmentId) { queryText += ` AND (department_id = $2 OR department_id IS NULL)`; params.push(departmentId) }
  queryText += ' ORDER BY name ASC'
  const result = await query(queryText, params)
  return result.rows.map(t => ({ ...t, items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items }))
}

export async function createDeliveryTemplate(template) {
  const { hotel_id, department_id, name, items, created_by } = template
  const id = uuidv4()
  await query(`INSERT INTO delivery_templates (id, hotel_id, department_id, name, items, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, hotel_id, department_id, name, JSON.stringify(items), created_by])
  return { id, hotel_id, department_id, name, items }
}

export async function updateDeliveryTemplate(id, updates) {
  const fields = []; const values = []; let paramIndex = 1
  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.items !== undefined) { fields.push(`items = $${paramIndex++}`); values.push(JSON.stringify(updates.items)) }
  if (fields.length === 0) return false
  values.push(id)
  const result = await query(`UPDATE delivery_templates SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteDeliveryTemplate(id) {
  const result = await query('DELETE FROM delivery_templates WHERE id = $1', [id])
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAuditLogs(hotelId, filters = {}) {
  let queryText = 'SELECT * FROM audit_logs WHERE hotel_id = $1'
  const params = [hotelId]
  let paramIndex = 2
  
  if (filters.userId) { queryText += ` AND user_id = $${paramIndex++}`; params.push(filters.userId) }
  if (filters.action) { queryText += ` AND action = $${paramIndex++}`; params.push(filters.action) }
  if (filters.entityType) { queryText += ` AND entity_type = $${paramIndex++}`; params.push(filters.entityType) }
  if (filters.startDate) { queryText += ` AND DATE(created_at) >= $${paramIndex++}`; params.push(filters.startDate) }
  if (filters.endDate) { queryText += ` AND DATE(created_at) <= $${paramIndex++}`; params.push(filters.endDate) }
  queryText += ' ORDER BY created_at DESC'
  if (filters.limit) { queryText += ` LIMIT $${paramIndex++}`; params.push(filters.limit) }
  if (filters.offset) { queryText += ` OFFSET $${paramIndex++}`; params.push(filters.offset) }
  
  const result = await query(queryText, params)
  return result.rows.map(log => ({ ...log, details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details }))
}

// ═══════════════════════════════════════════════════════════════
// PILOT REPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getPilotSummary(hotelId) {
  const totalBatches = (await query('SELECT COUNT(*) as count FROM batches WHERE hotel_id = $1', [hotelId])).rows[0].count
  const activeBatches = (await query("SELECT COUNT(*) as count FROM batches WHERE hotel_id = $1 AND status = 'active'", [hotelId])).rows[0].count
  const collectedBatches = (await query("SELECT COUNT(*) as count FROM batches WHERE hotel_id = $1 AND status = 'collected'", [hotelId])).rows[0].count
  const totalWriteOffs = (await query('SELECT COUNT(*) as count FROM write_offs WHERE hotel_id = $1', [hotelId])).rows[0].count
  const writeOffQuantity = (await query('SELECT COALESCE(SUM(quantity), 0) as total FROM write_offs WHERE hotel_id = $1', [hotelId])).rows[0].total
  const writeOffsByReason = (await query(`SELECT reason, COUNT(*) as count, SUM(quantity) as quantity FROM write_offs WHERE hotel_id = $1 GROUP BY reason`, [hotelId])).rows
  const notificationsSent = (await query('SELECT COUNT(*) as count FROM notifications WHERE hotel_id = $1', [hotelId])).rows[0].count
  
  return {
    batches: { total: parseInt(totalBatches), active: parseInt(activeBatches), collected: parseInt(collectedBatches) },
    writeOffs: { total: parseInt(totalWriteOffs), quantity: parseInt(writeOffQuantity), byReason: writeOffsByReason },
    notifications: { total: parseInt(notificationsSent) }
  }
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL WRITE-OFF FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Alias for getWriteOffs
export const getAllWriteOffs = getWriteOffs

export async function getWriteOffById(id) {
  const result = await query('SELECT * FROM write_offs WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function createWriteOff(data) {
  const id = uuidv4()
  await query(`
    INSERT INTO write_offs (id, hotel_id, batch_id, product_id, quantity, reason, notes, user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [id, data.hotel_id, data.batch_id, data.product_id, data.quantity, data.reason, data.notes, data.user_id])
  return { id, ...data }
}

export async function updateWriteOff(id, updates) {
  const fields = Object.keys(updates).filter(k => updates[k] !== undefined)
  if (fields.length === 0) return false
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => updates[f])
  const result = await query(`UPDATE write_offs SET ${setClauses} WHERE id = $1`, [id, ...values])
  return result.rowCount > 0
}

export async function deleteWriteOff(id) {
  const result = await query('DELETE FROM write_offs WHERE id = $1', [id])
  return result.rowCount > 0
}

export async function getWriteOffStats(hotelId, departmentId = null) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  let baseWhere = 'w.hotel_id = $1'
  const params = [hotelId]
  let paramIndex = 2
  
  if (departmentId) {
    baseWhere += ` AND p.department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  // Total count
  const totalResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    LEFT JOIN products p ON w.product_id = p.id
    WHERE ${baseWhere}
  `, params)
  
  // Today count
  const todayResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    LEFT JOIN products p ON w.product_id = p.id
    WHERE ${baseWhere} AND w.created_at >= $${paramIndex}
  `, [...params, todayStart])
  
  // Week count
  const weekResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    LEFT JOIN products p ON w.product_id = p.id
    WHERE ${baseWhere} AND w.created_at >= $${paramIndex}
  `, [...params, weekAgo])
  
  // Month count
  const monthResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    LEFT JOIN products p ON w.product_id = p.id
    WHERE ${baseWhere} AND w.created_at >= $${paramIndex}
  `, [...params, monthAgo])

  return {
    today: parseInt(todayResult.rows[0].count) || 0,
    week: parseInt(weekResult.rows[0].count) || 0,
    month: parseInt(monthResult.rows[0].count) || 0,
    total: parseInt(totalResult.rows[0].count) || 0
  }
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL NOTIFICATION FUNCTIONS  
// ═══════════════════════════════════════════════════════════════

// Aliases for notifications
export const getAllNotifications = getNotifications
export const getNotificationById = async (id) => {
  const result = await query('SELECT * FROM notifications WHERE id = $1', [id])
  return result.rows[0] || null
}
export const updateNotification = async (id, updates) => {
  const fields = Object.keys(updates).filter(k => updates[k] !== undefined)
  if (fields.length === 0) return false
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => updates[f])
  const result = await query(`UPDATE notifications SET ${setClauses} WHERE id = $1`, [id, ...values])
  return result.rowCount > 0
}
export const deleteNotification = async (id) => {
  const result = await query('DELETE FROM notifications WHERE id = $1', [id])
  return result.rowCount > 0
}
export const markNotificationAsRead = markNotificationRead
export const markAllNotificationsAsRead = markAllNotificationsRead
export const getUnreadNotificationsCount = getUnreadNotificationCount

// ═══════════════════════════════════════════════════════════════
// COLLECTION FUNCTIONS (Product groups/collections)
// ═══════════════════════════════════════════════════════════════

export async function getAllCollections(hotelId, filters = {}) {
  // Collections are stored as a product grouping - return empty for now
  // This can be implemented later with a collections table
  return []
}

export async function getCollectionById(id) {
  return null
}

export async function createCollection(data) {
  // Placeholder - can be implemented with collections table
  return { id: uuidv4(), ...data }
}

export async function updateCollection(id, updates) {
  return false
}

export async function deleteCollection(id) {
  return false
}

export async function getCollectionProducts(collectionId) {
  return []
}

export async function addProductToCollection(collectionId, productId) {
  return false
}

export async function removeProductFromCollection(collectionId, productId) {
  return false
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY TEMPLATE ALIASES
// ═══════════════════════════════════════════════════════════════

export const getAllDeliveryTemplates = getDeliveryTemplates
export async function getDeliveryTemplateById(id) {
  const result = await query('SELECT * FROM delivery_templates WHERE id = $1', [id])
  return result.rows[0] || null
}

// ═══════════════════════════════════════════════════════════════
// HOTEL DELETE FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function deleteHotel(id) {
  const result = await query('DELETE FROM hotels WHERE id = $1', [id])
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS ALIASES
// ═══════════════════════════════════════════════════════════════

export const getSettings = getAllSettings

export async function updateSettings(hotelId, settings) {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(hotelId, key, typeof value === 'object' ? JSON.stringify(value) : value)
  }
  return true
}

export { query }
