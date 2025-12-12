/**
 * FreshTrack Server - Главный файл
 * Ritz-Carlton Inventory Management System
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

// Импорт роутов
import productsRouter from './routes/products.js'
import authRouter from './routes/auth.js'
import notificationsRouter from './routes/notifications.js'
import collectionsRouter from './routes/collections.js'
import batchesRouter from './routes/batches.js'
import settingsRouter from './routes/settings.js'
import auditLogsRouter from './routes/audit-logs.js'
import notificationRulesRouter from './routes/notification-rules.js'
import deliveryTemplatesRouter from './routes/delivery-templates.js'
import departmentSettingsRouter from './routes/department-settings.js'
import customContentRouter from './routes/custom-content.js'

// Импорт сервисов
import { initDatabase } from './db/database.js'
import { initScheduler } from './services/scheduler.js'
import { initTelegramBot } from './services/telegram.js'

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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// API Routes
app.use('/api/products', productsRouter)
app.use('/api/auth', authRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/collections', collectionsRouter)
app.use('/api/batches', batchesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api/notification-rules', notificationRulesRouter)
app.use('/api/delivery-templates', deliveryTemplatesRouter)
app.use('/api/department-settings', departmentSettingsRouter)
app.use('/api/custom-content', customContentRouter)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'FreshTrack API'
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

// Инициализация и запуск сервера
async function startServer() {
  try {
    // Инициализируем базу данных
    console.log('📦 Initializing database...')
    initDatabase()
    console.log('✅ Database initialized')

    // Инициализируем планировщик Telegram уведомлений
    console.log('⏰ Starting scheduler...')
    initScheduler()
    console.log('✅ Scheduler started')

    // Инициализируем Telegram бота с командами
    const enableTelegramPolling = process.env.TELEGRAM_POLLING === 'true'
    console.log('🤖 Initializing Telegram bot...')
    initTelegramBot(enableTelegramPolling)
    if (enableTelegramPolling) {
      console.log('✅ Telegram bot started with commands support')
    } else {
      console.log('✅ Telegram bot started (notifications only)')
      console.log('   Set TELEGRAM_POLLING=true to enable bot commands')
    }

    // Запускаем сервер
    app.listen(PORT, () => {
      console.log(`
🚀 FreshTrack Server is running!
📍 Port: ${PORT}
🌐 API: http://localhost:${PORT}/api
🏨 Ritz-Carlton Inventory Management

Available endpoints:
  - GET  /api/health
  - GET  /api/products
  - POST /api/products
  - PUT  /api/products/:id
  - DELETE /api/products/:id
  - POST /api/auth/login
  - POST /api/auth/register
  - POST /api/notifications/test
  - GET  /api/notifications/send-daily
      `)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
