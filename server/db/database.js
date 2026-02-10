/**
 * FreshTrack PostgreSQL Database
 * Multi-hotel architecture for Ritz-Carlton Astana Honor Bar pilot
 * Version: 2.0.0 - PostgreSQL Migration
 */

import { query, getClient, testConnection } from './postgres.js'
import { runMigrations } from './migrate.js'
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

    // Run all pending migrations (non-fatal: log warnings but don't crash)
    const migrationResult = await runMigrations({ fatal: false })
    if (migrationResult.failed.length > 0) {
      console.warn(`   ${migrationResult.failed.length} migration(s) had issues (non-fatal)`)
    }

    // Check if pilot data exists (check by user to handle migration scenarios)
    const usersResult = await query("SELECT id FROM users WHERE login = $1", ['superadmin'])
    if (usersResult.rows.length === 0) {
      await initializePilotData()
    } else {
      console.log('   Pilot data already exists')

      // Update existing hotels to have MARSHA codes if missing
      // Only run if marsha_code column exists (migration 018)
      try {
        const marshaUpdates = [
          { pattern: '%Ritz-Carlton%Astana%', code: 'TSERZ' },
          { pattern: '%St. Regis%Astana%', code: 'TSEXR' },
          { pattern: '%St. Regis%Washington%', code: 'WASSX' },
          { pattern: '%Marriott%Astana%', code: 'TSEMC' },
          { pattern: '%Sheraton%Astana%', code: 'TSESI' },
        ]

        for (const { pattern, code } of marshaUpdates) {
          const result = await query(`
            UPDATE hotels SET marsha_code = $1 
            WHERE name ILIKE $2 AND marsha_code IS NULL
          `, [code, pattern])
          if (result.rowCount > 0) {
            console.log(`   ✅ Updated hotel with MARSHA code ${code}`)
          }
        }
      } catch (err) {
        // Column may not exist yet on first run
        if (!err.message.includes('does not exist')) {
          console.log('   Note: MARSHA codes update skipped:', err.message?.substring(0, 50))
        }
      }
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

  // 1. Create Hotel with MARSHA code for Ritz-Carlton Astana
  const hotelId = uuidv4()
  await query(`
    INSERT INTO hotels (id, name, marsha_code, city, country, timezone) 
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [hotelId, 'The Ritz-Carlton, Astana', 'TSERZ', 'Astana', 'Kazakhstan', 'Asia/Almaty'])

  // 2. Create Honor Bar Department
  const deptId = uuidv4()
  await query(`
    INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [deptId, hotelId, 'Honor Bar', 'Honor Bar', 'Honor Bar', 'minibar', '#FF8D6B', 'wine'])

  // 3. Create Users
  const superAdminId = uuidv4()
  const hotelAdminId = uuidv4()
  const staffId = uuidv4()

  // Super Admin (no hotel restriction, is_owner=true — primary owner)
  await query(`
    INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active, is_owner) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [superAdminId, 'superadmin', bcrypt.hashSync('SuperAdmin123!', 10), 'Супер Администратор', 'SUPER_ADMIN', null, null, true, true])

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

  // 6. Create Default Settings (values must be valid JSON for JSONB column)
  const defaultSettings = [
    { key: 'warning_days', value: 7 },
    { key: 'critical_days', value: 3 },
    { key: 'notification_time', value: '09:00' },
    { key: 'telegram_enabled', value: false },
    { key: 'language', value: 'ru' }
  ]

  for (const setting of defaultSettings) {
    await query(`
      INSERT INTO settings (id, hotel_id, key, value) 
      VALUES ($1, $2, $3, $4)
    `, [uuidv4(), hotelId, setting.key, JSON.stringify(setting.value)])
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

// ═══════════════════════════════════════════════════════════════
// CONTEXT-AWARE QUERY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Build WHERE clause based on user context (hotelId, departmentId)
 * Automatically applies data isolation based on user role
 * 
 * @param {Object} context - { hotelId, departmentId, role }
 * @param {string} tableAlias - Table alias (e.g., 'b' for batches)
 * @param {number} startParamIndex - Starting parameter index for SQL
 * @returns {{ where: string, params: any[], nextParamIndex: number }}
 */
export function buildContextWhere(context, tableAlias = '', startParamIndex = 1) {
  const { hotelId, departmentId, role } = context
  const prefix = tableAlias ? `${tableAlias}.` : ''
  const conditions = []
  const params = []
  let paramIndex = startParamIndex

  // SUPER_ADMIN sees everything (no hotel filter)
  // HOTEL_ADMIN and below are filtered by hotelId
  if (role !== 'SUPER_ADMIN' && hotelId) {
    conditions.push(`${prefix}hotel_id = $${paramIndex++}`)
    params.push(hotelId)
  } else if (hotelId) {
    // Even SUPER_ADMIN can filter by hotel if specified
    conditions.push(`${prefix}hotel_id = $${paramIndex++}`)
    params.push(hotelId)
  }

  // STAFF users are filtered by departmentId
  if (role === 'STAFF' && departmentId) {
    conditions.push(`${prefix}department_id = $${paramIndex++}`)
    params.push(departmentId)
  } else if (departmentId) {
    // Other roles can optionally filter by department
    conditions.push(`${prefix}department_id = $${paramIndex++}`)
    params.push(departmentId)
  }

  const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

  return { where, params, nextParamIndex: paramIndex }
}

/**
 * Check if user can access a specific resource
 * Prevents manipulation via manually passed IDs that don't belong to user's context
 * 
 * @param {Object} user - User object with role, hotel_id, department_id
 * @param {Object} resource - Resource with hotelId/hotel_id and departmentId/department_id
 * @returns {boolean} - True if user can access the resource
 */
export function canAccessResource(user, resource) {
  if (!user || !resource) return false

  const userHotelId = user.hotel_id || user.hotelId
  const userDepartmentId = user.department_id || user.departmentId
  const resourceHotelId = resource.hotel_id || resource.hotelId
  const resourceDepartmentId = resource.department_id || resource.departmentId

  // SUPER_ADMIN can access everything
  if (user.role === 'SUPER_ADMIN') return true

  // Must have hotel context
  if (!userHotelId) return false

  // Hotel must match
  if (resourceHotelId && resourceHotelId !== userHotelId) return false

  // HOTEL_ADMIN can access any resource in their hotel
  if (user.role === 'HOTEL_ADMIN') return true

  // Hotel-level resource (no department) - user in same hotel can access
  if (!resourceDepartmentId) {
    return resourceHotelId === userHotelId
  }

  // Department-level resource - user must have department and it must match
  if (!userDepartmentId) return false
  return resourceDepartmentId === userDepartmentId
}

/**
 * Log audit action with optional snapshots
 * @param {Object} data - Audit log data
 * @param {string} data.hotel_id - Hotel ID
 * @param {string} data.user_id - User ID who performed action
 * @param {string} data.user_name - User name
 * @param {string} data.action - Action type (create, update, delete, etc.)
 * @param {string} data.entity_type - Entity type (batch, product, user, etc.)
 * @param {string} data.entity_id - Entity ID
 * @param {Object} data.details - Additional details
 * @param {string} data.ip_address - IP address
 * @param {Object} data.snapshot_before - Entity state before change (for update/delete)
 * @param {Object} data.snapshot_after - Entity state after change (for create/update)
 */
export async function logAudit(data) {
  const {
    hotel_id, user_id, user_name, action, entity_type, entity_id,
    details, ip_address, snapshot_before, snapshot_after, user_agent
  } = data
  const id = uuidv4()
  const nowIso = new Date().toISOString()
  const createdAtUtc = nowIso.replace('T', ' ').replace('Z', '')
  console.log(`[AUDIT INSERT] UTC ISO: ${nowIso} → DB value: ${createdAtUtc}`)

  // Check if snapshot columns exist (graceful degradation)
  try {
    await query(`
      INSERT INTO audit_logs (
        id, hotel_id, user_id, user_name, action, entity_type, entity_id,
        details, ip_address, snapshot_before, snapshot_after, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      id,
      hotel_id || null,
      user_id || null,
      user_name || 'System',
      action,
      entity_type || null,
      entity_id || null,
      details ? JSON.stringify(details) : null,
      ip_address || null,
      snapshot_before ? JSON.stringify(snapshot_before) : null,
      snapshot_after ? JSON.stringify(snapshot_after) : null,
      createdAtUtc
    ])
  } catch (error) {
    if (error.message?.includes('snapshot_before') || error.message?.includes('snapshot_after')) {
      await query(`
        INSERT INTO audit_logs (id, hotel_id, user_id, user_name, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        id,
        hotel_id || null,
        user_id || null,
        user_name || 'System',
        action,
        entity_type || null,
        entity_id || null,
        details ? JSON.stringify(details) : null,
        ip_address || null,
        createdAtUtc
      ])
    } else {
      throw error
    }
  }

  // Автоматически создаем metadata с severity (асинхронно, без блокировки)
  enrichAuditLogMetadata({
    id,
    action,
    entity_type,
    entity_id,
    snapshot_before,
    snapshot_after,
    ip_address,
    user_agent
  }).catch(err => console.error('[AUDIT] Enrichment error:', err.message))

  return id
}

/**
 * Автоматическое обогащение audit log метаданными (severity, description)
 * Вызывается асинхронно после записи в audit_logs
 */
async function enrichAuditLogMetadata(log) {
  if (!log?.id) return

  try {
    // Проверяем есть ли уже metadata
    const existing = await query(
      'SELECT id FROM audit_logs_metadata WHERE audit_log_id = $1',
      [log.id]
    )
    if (existing.rows?.length > 0) return

    // Определяем severity
    const severity = await getSeverityForAction(log.action, log.entity_type)

    // Генерируем human-readable description
    const description = generateHumanDescription(log)
    const details = generateHumanDetails(log)

    // Парсим user-agent
    const uaData = parseUserAgentSimple(log.user_agent)

    // Вставляем metadata
    await query(
      `INSERT INTO audit_logs_metadata (
        audit_log_id, human_readable_description, human_readable_details,
        severity, user_agent, browser_name, os_name, device_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        log.id,
        description,
        details,
        severity,
        log.user_agent || null,
        uaData.browser_name,
        uaData.os_name,
        uaData.device_type
      ]
    )
  } catch (err) {
    // Игнорируем ошибки (enrichment не критичен)
    console.error('[AUDIT ENRICHMENT]', err.message)
  }
}

/**
 * Определить severity для action
 */
async function getSeverityForAction(action, entityType) {
  const normAction = (action || '').toUpperCase().replace(/-/g, '_')

  try {
    const result = await query(
      'SELECT severity FROM audit_action_severity WHERE action = $1',
      [normAction]
    )
    if (result.rows?.length > 0) return result.rows[0].severity
  } catch {
    // Таблица может не существовать
  }

  // Fallback логика
  if (normAction === 'DELETE') return 'critical'
  if (normAction === 'PASSWORD_CHANGE') return 'critical'
  if (normAction === 'ROLE_CHANGED') return 'critical'
  if (normAction === 'MFA_DISABLED') return 'critical'
  if (normAction === 'EMAIL_CHANGED') return 'important'
  if (normAction === 'MFA_ENABLED') return 'important'
  if (normAction === 'EXPORT') return 'important'
  if (normAction === 'IMPORT') return 'important'
  if (entityType?.toUpperCase() === 'USER') return 'important'
  if (normAction.includes('TOGGLE') && entityType?.toUpperCase() === 'USER') return 'important'

  return 'normal'
}

/**
 * Генерировать человекочитаемое описание
 */
function generateHumanDescription(log) {
  const action = (log.action || '').toUpperCase().replace(/-/g, '_')
  const entityType = (log.entity_type || '').toUpperCase()

  const actionMap = {
    CREATE: 'Создан',
    UPDATE: 'Обновлен',
    DELETE: 'Удален',
    LOGIN: 'Вход в систему',
    LOGOUT: 'Выход из системы',
    COLLECT: 'Выполнен сбор',
    PASSWORD_CHANGE: 'Изменен пароль',
    EMAIL_CHANGED: 'Изменен email',
    ROLE_CHANGED: 'Изменена роль',
    MFA_ENABLED: 'Включена MFA',
    MFA_DISABLED: 'Отключена MFA',
    EXPORT: 'Экспорт данных',
    IMPORT: 'Импорт данных',
    WRITE_OFF: 'Списание',
    SETTINGS_UPDATE: 'Изменены настройки',
    TOGGLE: 'Переключен статус',
    ASSIGN: 'Назначен',
    RELEASE: 'Освобожден',
    CLEAR_CACHE: 'Очищен кэш',
    RESEND_PASSWORD: 'Повторная отправка пароля'
  }

  const entityMap = {
    PRODUCT: 'продукт',
    BATCH: 'партия',
    USER: 'пользователь',
    CATEGORY: 'категория',
    DEPARTMENT: 'отдел',
    HOTEL: 'отель',
    SETTINGS: 'настройки',
    WRITE_OFF: 'списание',
    COLLECTION: 'сбор',
    MARSHA_CODE: 'MARSHA код',
    ACCOUNT: 'аккаунт',
    NOTIFICATION_RULE: 'правило уведомлений',
    TEMPLATE: 'шаблон',
    SETTINGS_CACHE: 'кэш настроек'
  }

  const actionText = actionMap[action] || action
  const entityText = entityMap[entityType] || entityType?.toLowerCase() || 'объект'

  // Извлекаем имя из snapshot
  let name = ''
  if (log.snapshot_after) {
    const snap = typeof log.snapshot_after === 'string' ? tryParseJSON(log.snapshot_after) : log.snapshot_after
    name = snap?.name || snap?.login || snap?.code || ''
  }
  if (!name && log.snapshot_before) {
    const snap = typeof log.snapshot_before === 'string' ? tryParseJSON(log.snapshot_before) : log.snapshot_before
    name = snap?.name || snap?.login || snap?.code || ''
  }

  if (name) return `${actionText} ${entityText} "${name}"`
  return `${actionText} ${entityText}`
}

/**
 * Генерировать детали изменений
 */
function generateHumanDetails(log) {
  const action = (log.action || '').toUpperCase().replace(/-/g, '_')

  if (action === 'LOGIN' || action === 'LOGOUT') {
    return log.ip_address ? `IP: ${log.ip_address}` : null
  }

  if (action === 'CREATE' && log.snapshot_after) {
    const snap = typeof log.snapshot_after === 'string' ? tryParseJSON(log.snapshot_after) : log.snapshot_after
    if (!snap) return null
    const details = []
    if (snap.name) details.push(`Название: ${snap.name}`)
    if (snap.quantity !== undefined) details.push(`Количество: ${snap.quantity}`)
    if (snap.expiry_date) details.push(`Срок: ${snap.expiry_date}`)
    return details.length > 0 ? details.join(', ') : null
  }

  if (action === 'UPDATE' && log.snapshot_before && log.snapshot_after) {
    const before = typeof log.snapshot_before === 'string' ? tryParseJSON(log.snapshot_before) : log.snapshot_before
    const after = typeof log.snapshot_after === 'string' ? tryParseJSON(log.snapshot_after) : log.snapshot_after
    if (!before || !after) return null

    const changes = []
    const skipKeys = ['id', 'created_at', 'updated_at', 'hotel_id', '_snapshot_type', '_snapshot_time']
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

    for (const key of allKeys) {
      if (skipKeys.includes(key)) continue
      const oldVal = before[key]
      const newVal = after[key]
      if (oldVal !== newVal) {
        changes.push(`${key}: ${oldVal} → ${newVal}`)
      }
    }
    return changes.length > 0 ? changes.join(', ') : 'Без изменений'
  }

  if (action === 'DELETE' && log.snapshot_before) {
    const snap = typeof log.snapshot_before === 'string' ? tryParseJSON(log.snapshot_before) : log.snapshot_before
    return snap?.name ? `Удален: ${snap.name}` : null
  }

  return null
}

/**
 * Простой парсер User-Agent (без зависимостей)
 */
function parseUserAgentSimple(ua) {
  if (!ua) return { browser_name: null, os_name: null, device_type: 'desktop' }

  let browser_name = null
  let os_name = null
  let device_type = 'desktop'

  // Browser detection
  if (ua.includes('Chrome')) browser_name = 'Chrome'
  else if (ua.includes('Firefox')) browser_name = 'Firefox'
  else if (ua.includes('Safari')) browser_name = 'Safari'
  else if (ua.includes('Edge')) browser_name = 'Edge'
  else if (ua.includes('Opera')) browser_name = 'Opera'

  // OS detection
  if (ua.includes('Windows')) os_name = 'Windows'
  else if (ua.includes('Mac OS')) os_name = 'macOS'
  else if (ua.includes('Linux')) os_name = 'Linux'
  else if (ua.includes('Android')) os_name = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os_name = 'iOS'

  // Device type
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    device_type = 'mobile'
  } else if (ua.includes('Tablet') || ua.includes('iPad')) {
    device_type = 'tablet'
  }

  return { browser_name, os_name, device_type }
}

function tryParseJSON(str) {
  if (!str) return null
  try {
    return typeof str === 'string' ? JSON.parse(str) : str
  } catch {
    return null
  }
}

/**
 * Create audit snapshot helper
 * Strips sensitive fields and normalizes for comparison
 */
export function createAuditSnapshot(entity, entityType) {
  if (!entity) return null

  // Fields to exclude from snapshots
  const sensitiveFields = ['password', 'password_hash', 'token', 'refresh_token']

  const snapshot = { ...entity }

  // Remove sensitive fields
  for (const field of sensitiveFields) {
    delete snapshot[field]
  }

  // Add metadata
  snapshot._snapshot_type = entityType
  snapshot._snapshot_time = new Date().toISOString()

  return snapshot
}

// ═══════════════════════════════════════════════════════════════
// USER FUNCTIONS (moved to modules/auth/auth.repository.js)
// ═══════════════════════════════════════════════════════════════
export {
  getUserByLogin,
  getUserById,
  getUserByLoginOrEmail,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  verifyPassword,
  updateLastLogin,
  updateUserStatus,
  createJoinRequest,
  getJoinRequestsForHotel,
  getAllPendingJoinRequests,
  getJoinRequestByUserId,
  approveJoinRequest,
  rejectJoinRequest
} from '../modules/auth/auth.repository.js'

// ═══════════════════════════════════════════════════════════════
// HOTEL FUNCTIONS (moved to modules/hotels/hotels.repository.js)
// ═══════════════════════════════════════════════════════════════
export {
  getAllHotels,
  getHotelById,
  getHotelByCode,
  createHotel,
  updateHotel,
  deleteHotel
} from '../modules/hotels/hotels.repository.js'

// ═══════════════════════════════════════════════════════════════
// DEPARTMENT FUNCTIONS (moved to modules/departments/departments.repository.js)
// ═══════════════════════════════════════════════════════════════
export {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../modules/departments/departments.repository.js'

// ═══════════════════════════════════════════════════════════════
// CATEGORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all categories for a hotel
 * Includes both hotel-specific and system-wide categories (hotel_id IS NULL)
 * 
 * @param {string|null} hotelId - Hotel ID to filter by
 * @returns {Promise<Array>} - Categories array
 */
export async function getAllCategories(hotelId = null) {
  if (hotelId) {
    // Include both hotel-specific AND system-wide (global) categories
    const result = await query(
      `SELECT * FROM categories 
       WHERE (hotel_id = $1 OR hotel_id IS NULL) 
       AND is_active = TRUE 
       ORDER BY hotel_id NULLS FIRST, sort_order ASC`,
      [hotelId]
    )
    return result.rows
  }
  // SUPER_ADMIN without hotel filter - return all active categories
  const result = await query('SELECT * FROM categories WHERE is_active = TRUE ORDER BY hotel_id NULLS FIRST, sort_order ASC')
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
    SELECT b.*, p.name as product_name, p.barcode, p.category_id as category_id, 
           c.name as category_name, c.color as category_color, d.name as department_name,
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
    SELECT b.*, p.name as product_name, p.category_id as category_id, 
           c.name as category_name, c.color as category_color, d.name as department_name, u.name as added_by_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
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

/**
 * Get active batches for a product sorted by FIFO (earliest expiry first)
 * Used for automatic FIFO collection
 */
export async function getBatchesByProductForFIFO(productId, hotelId, departmentId = null) {
  let queryText = `
    SELECT b.*, p.name as product_name, d.name as department_name, c.name as category_name, c.color as category_color
    FROM batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN departments d ON b.department_id = d.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE b.product_id = $1 AND b.hotel_id = $2 AND b.status = 'active' AND b.quantity > 0
  `
  const params = [productId, hotelId]
  let paramIndex = 3

  if (departmentId) {
    queryText += ` AND b.department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  // FIFO: Sort by expiry_date ascending (earliest first)
  queryText += ' ORDER BY b.expiry_date ASC, b.created_at ASC'

  const result = await query(queryText, params)
  return result.rows
}

export async function getExpiringBatches(hotelId, days = 7) {
  const result = await query(`
    SELECT b.*, p.name as product_name, d.name as department_name, c.name as category_name, c.color as category_color
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE b.hotel_id = $1 AND b.status = 'active' 
    AND b.expiry_date >= CURRENT_DATE AND b.expiry_date <= CURRENT_DATE + $2::INTEGER
    ORDER BY b.expiry_date ASC
  `, [hotelId, days])
  return result.rows
}

export async function getExpiredBatches(hotelId) {
  const result = await query(`
    SELECT b.*, p.name as product_name, d.name as department_name, c.name as category_name, c.color as category_color
    FROM batches b
    JOIN products p ON b.product_id = p.id
    JOIN departments d ON b.department_id = d.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE b.hotel_id = $1 AND b.status = 'active' AND b.expiry_date < CURRENT_DATE
    ORDER BY b.expiry_date ASC
  `, [hotelId])
  return result.rows
}

export async function getBatchStats(hotelId, departmentId = null) {
  // Optimized: Single query with CASE WHEN instead of 4 separate queries
  let whereClause = 'hotel_id = $1 AND status = \'active\''
  const params = [hotelId]
  let paramIndex = 2

  if (departmentId) {
    whereClause += ` AND department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired,
      COUNT(*) FILTER (WHERE expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + 3) as critical,
      COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 3 AND expiry_date <= CURRENT_DATE + 7) as warning
    FROM batches 
    WHERE ${whereClause}
  `, params)

  const { total, expired, critical, warning } = result.rows[0]
  return {
    total: parseInt(total),
    expired: parseInt(expired),
    critical: parseInt(critical),
    warning: parseInt(warning),
    good: parseInt(total) - parseInt(expired) - parseInt(critical) - parseInt(warning)
  }
}

// ═══════════════════════════════════════════════════════════════
// WRITE-OFF FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getWriteOffs(hotelId, filters = {}) {
  let queryText = `
    SELECT 
      wo.id, wo.hotel_id, wo.department_id, wo.batch_id, wo.product_id, wo.quantity, 
      wo.reason, wo.comment as notes, wo.written_off_by as user_id, wo.written_off_at as created_at,
      wo.product_name,
      u.name as user_name,
      b.expiry_date
    FROM write_offs wo
    LEFT JOIN users u ON wo.written_off_by = u.id
    LEFT JOIN batches b ON wo.batch_id = b.id
    WHERE wo.hotel_id = $1
  `
  const params = [hotelId]
  let paramIndex = 2

  if (filters.department_id) { queryText += ` AND wo.department_id = $${paramIndex++}`; params.push(filters.department_id) }
  if (filters.start_date) { queryText += ` AND DATE(wo.written_off_at) >= $${paramIndex++}`; params.push(filters.start_date) }
  if (filters.end_date) { queryText += ` AND DATE(wo.written_off_at) <= $${paramIndex++}`; params.push(filters.end_date) }
  if (filters.reason) { queryText += ` AND wo.reason = $${paramIndex++}`; params.push(filters.reason) }
  if (filters.product_id) { queryText += ` AND wo.product_id = $${paramIndex++}`; params.push(filters.product_id) }

  queryText += ' ORDER BY wo.written_off_at DESC'
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

/**
 * System default settings
 */
const SYSTEM_DEFAULT_SETTINGS = {
  warningDays: 7,
  criticalDays: 3,
  dateFormat: 'DD.MM.YYYY',
  timezone: 'Asia/Almaty',
  defaultLanguage: 'ru',
  lowStockThreshold: 10,
  enableTelegramNotifications: false,
  enableEmailNotifications: false
}

export async function getSetting(hotelId, key) {
  const result = await query('SELECT value FROM settings WHERE hotel_id = $1 AND key = $2', [hotelId, key])
  return result.rows[0]?.value || null
}

/**
 * Get setting with hierarchical resolution
 * Priority: User → Department → Hotel → System
 * @param {Object} context - { userId, departmentId, hotelId }
 * @param {string} key - Setting key
 * @returns {any} Resolved setting value
 */
export async function getHierarchicalSetting(context, key) {
  const { userId, departmentId, hotelId } = context

  // 1. User scope (highest priority)
  if (userId) {
    const userResult = await query(
      'SELECT value FROM user_settings WHERE user_id = $1 AND key = $2',
      [userId, key]
    )
    if (userResult.rows.length > 0) {
      return parseSettingValue(userResult.rows[0].value)
    }
  }

  // 2. Department scope
  if (departmentId) {
    const deptResult = await query(
      'SELECT value FROM department_settings WHERE department_id = $1 AND key = $2',
      [departmentId, key]
    )
    if (deptResult.rows.length > 0) {
      return parseSettingValue(deptResult.rows[0].value)
    }
  }

  // 3. Hotel scope
  if (hotelId) {
    const hotelResult = await query(
      'SELECT value FROM settings WHERE hotel_id = $1 AND key = $2',
      [hotelId, key]
    )
    if (hotelResult.rows.length > 0) {
      return parseSettingValue(hotelResult.rows[0].value)
    }
  }

  // 4. System scope (default values)
  return SYSTEM_DEFAULT_SETTINGS[key] ?? null
}

/**
 * Get all settings with hierarchical resolution
 * Returns merged settings with proper priority
 */
export async function getAllHierarchicalSettings(context) {
  const { userId, departmentId, hotelId } = context

  // Start with system defaults
  const settings = { ...SYSTEM_DEFAULT_SETTINGS }

  // 3. Merge hotel settings (lower priority)
  if (hotelId) {
    const hotelResult = await query('SELECT key, value FROM settings WHERE hotel_id = $1', [hotelId])
    for (const row of hotelResult.rows) {
      settings[row.key] = parseSettingValue(row.value)
    }
  }

  // 2. Merge department settings (medium priority)
  if (departmentId) {
    const deptResult = await query('SELECT key, value FROM department_settings WHERE department_id = $1', [departmentId])
    for (const row of deptResult.rows) {
      settings[row.key] = parseSettingValue(row.value)
    }
  }

  // 1. Merge user settings (highest priority)
  if (userId) {
    const userResult = await query('SELECT key, value FROM user_settings WHERE user_id = $1', [userId])
    for (const row of userResult.rows) {
      settings[row.key] = parseSettingValue(row.value)
    }
  }

  return settings
}

/**
 * Parse setting value from database (handles JSON and primitives)
 */
function parseSettingValue(value) {
  if (value === null || value === undefined) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
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
  // Validate departmentId - must be valid UUID string, not object or empty
  const validDeptId = departmentId && typeof departmentId === 'string' && departmentId.length > 0 ? departmentId : null
  if (validDeptId) { queryText += ` AND (department_id = $2 OR department_id IS NULL)`; params.push(validDeptId) }
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
  let queryText = 'SELECT * FROM audit_logs WHERE hotel_id = $1 AND archived = FALSE'
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
  return result.rows.map(parseAuditRow)
}

/**
 * Parse audit row (details, snapshots JSON)
 */
function parseAuditRow(log) {
  const parsed = { ...log }
  if (parsed.details && typeof parsed.details === 'string') {
    try { parsed.details = JSON.parse(parsed.details) } catch { }
  }
  if (parsed.snapshot_after && typeof parsed.snapshot_after === 'string') {
    try { parsed.snapshot_after = JSON.parse(parsed.snapshot_after) } catch { }
  }
  if (parsed.snapshot_before && typeof parsed.snapshot_before === 'string') {
    try { parsed.snapshot_before = JSON.parse(parsed.snapshot_before) } catch { }
  }
  return parsed
}

/**
 * Get audit logs with metadata join (human-readable, severity, etc.)
 * hotelId null = no hotel filter (SUPER_ADMIN). Filters: userId, action, entityType, startDate, endDate, limit, offset, severity, securityOnly, departmentId
 */
export async function getAuditLogsWithMetadata(hotelId, filters = {}) {
  const conditions = ['al.archived = FALSE']
  const params = []
  let paramIndex = 1

  if (hotelId != null) {
    conditions.push(`al.hotel_id = $${paramIndex++}`)
    params.push(hotelId)
  }
  if (filters.userId) {
    conditions.push(`al.user_id = $${paramIndex++}`)
    params.push(filters.userId)
  }
  if (filters.action) {
    conditions.push(`al.action = $${paramIndex++}`)
    params.push(filters.action)
  }
  if (filters.entityType) {
    conditions.push(`al.entity_type = $${paramIndex++}`)
    params.push(filters.entityType)
  }
  if (filters.startDate) {
    conditions.push(`al.created_at >= $${paramIndex++}`)
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push(`al.created_at <= $${paramIndex++}`)
    params.push(filters.endDate)
  }
  if (filters.severity) {
    conditions.push(`alm.severity = $${paramIndex++}`)
    params.push(filters.severity)
  }
  if (filters.securityOnly === 'true') {
    conditions.push(`al.action IN ('login', 'logout', 'password_change', 'email_changed', 'role_changed', 'mfa_enabled', 'mfa_disabled')`)
  }
  if (filters.departmentId) {
    conditions.push(`u.department_id = $${paramIndex++}`)
    params.push(filters.departmentId)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const requestedLimit = parseInt(filters.limit, 10) || 20
  const maxLimit = requestedLimit > 100 ? Math.min(requestedLimit, 10000) : 100
  const limit = Math.min(requestedLimit, maxLimit)
  const offset = Math.max(0, parseInt(filters.offset, 10) || 0)
  params.push(limit, offset)

  const queryText = `
    SELECT al.*,
      u.name as user_name_join, u.login as user_login_join, u.department_id as user_department_id,
      d.name as department_name,
      alm.human_readable_description, alm.human_readable_details, alm.severity,
      alm.browser_name, alm.os_name, alm.device_type, alm.group_id, alm.is_grouped, alm.group_count
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN audit_logs_metadata alm ON al.id = alm.audit_log_id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `
  const result = await query(queryText, params)
  const countParams = params.slice(0, -2)
  const countResult = await query(
    `SELECT COUNT(*) as total FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     LEFT JOIN audit_logs_metadata alm ON al.id = alm.audit_log_id
     ${whereClause}`,
    countParams
  )
  const total = parseInt(countResult.rows[0]?.total || 0, 10)
  return {
    rows: result.rows.map(row => {
      const parsed = parseAuditRow(row)
      parsed.user_name = parsed.user_name || parsed.user_name_join || parsed.user_login_join
      parsed.human_readable_description = parsed.human_readable_description ?? row.human_readable_description
      parsed.human_readable_details = parsed.human_readable_details ?? row.human_readable_details
      parsed.department_name = row.department_name

      // Fallback severity если metadata нет
      if (!parsed.severity) {
        parsed.severity = getFallbackSeverity(parsed.action, parsed.entity_type)
      }

      // Всегда отдаём created_at в UTC (ISO с Z) для однозначного отображения в timezone отеля на фронте
      const originalCreatedAt = parsed.created_at
      if (parsed.created_at instanceof Date) {
        parsed.created_at = parsed.created_at.toISOString()
      } else if (typeof parsed.created_at === 'string' && !/Z$|[-+]\d{2}:?\d{2}$/.test(parsed.created_at.trim())) {
        parsed.created_at = parsed.created_at.trim().replace(' ', 'T') + 'Z'
      }
      console.log(`[AUDIT READ] DB value: ${originalCreatedAt} → API: ${parsed.created_at}`)
      return parsed
    }),
    total
  }
}

/**
 * Fallback severity для логов без metadata
 */
function getFallbackSeverity(action, entityType) {
  const normAction = (action || '').toUpperCase().replace(/-/g, '_')

  // Critical actions
  if (['DELETE', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'ROLE_CHANGED', 'MFA_DISABLED', 'DELETE_USER', 'DELETE_HOTEL', 'GDPR_DELETE'].includes(normAction)) {
    return 'critical'
  }

  // Important actions
  if (['USER_ACTIVATED', 'USER_DEACTIVATED', 'TOGGLE', 'EXPORT', 'IMPORT', 'EMAIL_CHANGED', 'MFA_ENABLED', 'MFA_SETUP', 'LOGIN_FAILED', 'ASSIGN_MARSHA', 'RELEASE_MARSHA', 'CREATE_USER', 'APPROVE_JOIN', 'REJECT_JOIN', 'RESEND_PASSWORD'].includes(normAction)) {
    return 'important'
  }

  // User-related actions are important by default
  if (entityType?.toUpperCase() === 'USER') {
    return 'important'
  }

  return 'normal'
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

  // Check if batch_snapshot columns exist (migration 006)
  const hasSnapshotColumns = await checkColumnExists('write_offs', 'batch_snapshot')

  if (hasSnapshotColumns && data.batch_snapshot) {
    // Use new schema with batch_snapshot
    await query(`
      INSERT INTO write_offs (id, hotel_id, department_id, batch_id, product_id, product_name, quantity, reason, comment, written_off_by, batch_snapshot, expiry_date, expiry_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      id,
      data.hotel_id,
      data.department_id,
      data.batch_id,
      data.product_id,
      data.product_name || 'Unknown',
      data.quantity,
      data.reason,
      data.notes || data.comment,
      data.user_id || data.written_off_by,
      JSON.stringify(data.batch_snapshot),
      data.expiry_date,
      data.expiry_status
    ])
  } else {
    // Fallback to old schema
    await query(`
      INSERT INTO write_offs (id, hotel_id, department_id, batch_id, product_id, product_name, quantity, reason, comment, written_off_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, data.hotel_id, data.department_id, data.batch_id, data.product_id, data.product_name || 'Unknown', data.quantity, data.reason, data.notes || data.comment, data.user_id || data.written_off_by])
  }

  return { id, ...data }
}

/**
 * Helper to check if a column exists in a table
 */
async function checkColumnExists(tableName, columnName) {
  try {
    const result = await query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName])
    return result.rows.length > 0
  } catch {
    return false
  }
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
    baseWhere += ` AND w.department_id = $${paramIndex++}`
    params.push(departmentId)
  }

  // Total count
  const totalResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    WHERE ${baseWhere}
  `, params)

  // Today count
  const todayResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    WHERE ${baseWhere} AND w.written_off_at >= $${paramIndex}
  `, [...params, todayStart])

  // Week count
  const weekResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    WHERE ${baseWhere} AND w.written_off_at >= $${paramIndex}
  `, [...params, weekAgo])

  // Month count
  const monthResult = await query(`
    SELECT COUNT(*) as count FROM write_offs w
    WHERE ${baseWhere} AND w.written_off_at >= $${paramIndex}
  `, [...params, monthAgo])

  return {
    today: parseInt(totalResult.rows[0]?.count) || 0,
    week: parseInt(weekResult.rows[0]?.count) || 0,
    month: parseInt(monthResult.rows[0]?.count) || 0,
    total: parseInt(totalResult.rows[0]?.count) || 0
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

