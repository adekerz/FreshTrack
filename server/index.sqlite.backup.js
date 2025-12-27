/**
 * FreshTrack Server - Pilot Project
 * Honor Bar, Ritz-Carlton Astana
 * 
 * Multi-hotel architecture with role-based access control
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cron from 'node-cron'

// Загружаем переменные окружения
dotenv.config()

// Импорт роутов
import authRouter from './routes/auth.js'
import hotelsRouter from './routes/hotels.js'
import departmentsRouter from './routes/departments.js'
import categoriesRouter from './routes/categories.js'
import productsRouter from './routes/products.js'
import batchesRouter from './routes/batches.js'
import notificationsRouter from './routes/notifications.js'
import reportsRouter from './routes/reports.js'
import collectionsRouter from './routes/collections.js'
import auditLogsRouter from './routes/audit.js'
import settingsRouter from './routes/settings.js'
import deliveryTemplatesRouter from './routes/delivery-templates.js'
import customContentRouter from './routes/custom-content.js'
import notificationRulesRouter from './routes/notification-rules.js'
import departmentSettingsRouter from './routes/department-settings.js'
import importRouter from './routes/import.js'
import exportRouter from './routes/export.js'

// Импорт базы данных
import { db, initDatabase, getAllHotels } from './db/database.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}))
app.use(express.json())

// Логирование запросов
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
})

// API Routes
app.use('/api/auth', authRouter)
app.use('/api/hotels', hotelsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/products', productsRouter)
app.use('/api/batches', batchesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/collections', collectionsRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/notification-rules', notificationRulesRouter)
app.use('/api/department-settings', departmentSettingsRouter)
app.use('/api/custom-content', customContentRouter)
app.use('/api/delivery-templates', deliveryTemplatesRouter)
app.use('/api/import', importRouter)
app.use('/api/export', exportRouter)

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hotels = getAllHotels()
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'FreshTrack Pilot API',
    version: '2.0.0-pilot',
    hotels_count: hotels.length,
    pilot_hotel: 'Honor Bar, Ritz-Carlton Astana'
  })
})

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Server Error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

/**
 * Генерация уведомлений о сроках годности для всех отелей
 * Запускается cron-задачей в 06:00
 */
function generateExpiryNotifications() {
  console.log('[CRON] Generating expiry notifications...')
  
  try {
    const hotels = getAllHotels()
    let totalCreated = 0
    
    hotels.forEach(hotel => {
      // Находим партии, срок которых истекает в ближайшие 3 дня
      const expiringBatches = db.prepare(`
        SELECT 
          b.*,
          p.name as product_name,
          d.name as department_name,
          julianday(b.expiry_date) - julianday('now', 'localtime') as days_until_expiry
        FROM batches b
        JOIN products p ON b.product_id = p.id
        JOIN departments d ON b.department_id = d.id
        WHERE b.hotel_id = ? 
          AND b.status = 'active' 
          AND b.quantity > 0
          AND julianday(b.expiry_date) - julianday('now', 'localtime') <= 3
      `).all(hotel.id)
      
      expiringBatches.forEach(batch => {
        const daysUntil = Math.floor(batch.days_until_expiry)
        let type, priority, title, message
        
        if (daysUntil < 0) {
          type = 'expired'
          priority = 'critical'
          title = 'Просрочен!'
          message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок истёк ${Math.abs(daysUntil)} дней назад`
        } else if (daysUntil === 0) {
          type = 'expiring_today'
          priority = 'high'
          title = 'Истекает сегодня!'
          message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок истекает сегодня`
        } else {
          type = 'expiring_soon'
          priority = 'medium'
          title = `Истекает через ${daysUntil} дн.`
          message = `${batch.product_name} (${batch.quantity} ${batch.unit}) - срок до ${batch.expiry_date}`
        }
        
        // Проверяем, нет ли уже такого уведомления сегодня
        const existing = db.prepare(`
          SELECT id FROM notifications 
          WHERE hotel_id = ? 
            AND batch_id = ? 
            AND type = ?
            AND DATE(created_at) = DATE('now', 'localtime')
        `).get(hotel.id, batch.id, type)
        
        if (!existing) {
          db.prepare(`
            INSERT INTO notifications (hotel_id, department_id, batch_id, type, priority, title, message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(hotel.id, batch.department_id, batch.id, type, priority, title, message)
          totalCreated++
        }
      })
      
      console.log(`[CRON] Hotel ${hotel.name}: ${expiringBatches.length} expiring batches checked`)
    })
    
    console.log(`[CRON] Total notifications created: ${totalCreated}`)
  } catch (error) {
    console.error('[CRON] Error generating notifications:', error)
  }
}

// Инициализация и запуск сервера
async function startServer() {
  try {
    // Инициализируем базу данных
    console.log('📦 Initializing database...')
    initDatabase()
    console.log('✅ Database initialized')
    
    // Показываем информацию о пилотных данных
    const hotels = getAllHotels()
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get()
    const departments = db.prepare('SELECT COUNT(*) as count FROM departments').get()
    const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get()
    
    console.log(`📊 Pilot data: ${hotels.length} hotels, ${departments.count} departments, ${users.count} users, ${categories.count} categories`)

    // Настраиваем cron-задачу для генерации уведомлений в 06:00
    cron.schedule('0 6 * * *', () => {
      generateExpiryNotifications()
    }, {
      timezone: 'Asia/Almaty' // Часовой пояс Астаны
    })
    console.log('⏰ Cron scheduler started (06:00 Asia/Almaty)')

    // Запускаем сервер
    app.listen(PORT, () => {
      console.log(`
🚀 FreshTrack Pilot Server is running!
📍 Port: ${PORT}
🌐 API: http://localhost:${PORT}/api
🏨 Pilot: Honor Bar, Ritz-Carlton Astana

Test users:
  - superadmin / SuperAdmin123! (SUPER_ADMIN)
  - hoteladmin / HotelAdmin123! (HOTEL_ADMIN)
  - honorbar   / Staff123!      (STAFF)

Available endpoints:
  - GET    /api/health
  - POST   /api/auth/login
  - GET    /api/auth/me
  - GET    /api/hotels (SUPER_ADMIN only)
  - GET    /api/departments
  - GET    /api/categories
  - GET    /api/products
  - GET    /api/batches
  - POST   /api/batches/:id/collect
  - GET    /api/notifications
  - GET    /api/notifications/summary
  - GET    /api/reports/pilot-summary
  - GET    /api/reports/daily
      `)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
