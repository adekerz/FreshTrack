/**
 * FreshTrack Server - PostgreSQL Version
 * Multi-hotel inventory management system
 */

// IMPORTANT: Import Sentry instrumentation FIRST
import './instrument.js'
import * as Sentry from '@sentry/node'

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Import rate limiter
import { rateLimitGeneral, rateLimitAuth, rateLimitHeavy } from './middleware/rateLimiter.js'

// Import routes
import authRouter from './routes/auth.js'
import hotelsRouter from './routes/hotels.js'
import departmentsRouter from './routes/departments.js'
import categoriesRouter from './routes/categories.js'
import productsRouter from './routes/products.js'
import batchesRouter from './routes/batches.js'
import notificationsRouter from './routes/notifications.js'
import reportsRouter from './routes/reports.js'
import collectionsRouter from './routes/collections.js'
import fifoCollectRouter from './routes/fifo-collect.js'
import auditRouter from './routes/audit.js'
import settingsRouter from './routes/settings.js'
import deliveryTemplatesRouter from './routes/delivery-templates.js'
import writeOffsRouter from './routes/write-offs.js'
import importRouter from './routes/import.js'
import exportRouter from './routes/export.js'
import healthRouter from './routes/health.js'
import notificationRulesRouter from './routes/notification-rules.js'
import customContentRouter from './routes/custom-content.js'
import departmentSettingsRouter from './routes/department-settings.js'
import telegramRouter from './routes/telegram.js'
import eventsRouter from './routes/events.js'

// Import notification jobs
import { startNotificationJobs } from './jobs/notificationJobs.js'

// Import database
import { initDatabase, getAllHotels } from './db/database.js'
import { query } from './db/postgres.js'

const app = express()
const PORT = process.env.PORT || 3001

// CORS - Restrict origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000']

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true)
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true)
    }
    
    // In production, check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    console.warn('[CORS] Blocked origin:', origin)
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400,
}))

// Handle preflight requests
app.options('*', cors())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve static files for uploads (logos, etc.)
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Trust proxy for Railway/Vercel
app.set('trust proxy', 1)

// Request logging (development only)
import { requestLogger } from './utils/logger.js'
app.use(requestLogger)

// Rate limiting (before routes)
app.use('/api', rateLimitGeneral)

// API Routes - with specific rate limits
app.use('/api/auth', rateLimitAuth, authRouter)
app.use('/api/hotels', hotelsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/products', productsRouter)
app.use('/api/batches', batchesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/collections', collectionsRouter)
app.use('/api/fifo-collect', fifoCollectRouter)
app.use('/api/audit-logs', auditRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/delivery-templates', deliveryTemplatesRouter)
app.use('/api/write-offs', writeOffsRouter)
app.use('/api/import', importRouter)
app.use('/api/export', rateLimitHeavy, exportRouter)
app.use('/api/health', healthRouter)
app.use('/api/notification-rules', notificationRulesRouter)
app.use('/api/custom-content', customContentRouter)
app.use('/api/department-settings', departmentSettingsRouter)
app.use('/api/telegram', telegramRouter)
app.use('/api/events', eventsRouter)

// Root health check
app.get('/', async (req, res) => {
  try {
    const dbCheck = await query('SELECT NOW() as time')
    res.json({ 
      status: 'ok',
      service: 'FreshTrack API',
      version: '2.0.0',
      database: 'connected',
      timestamp: dbCheck.rows[0]?.time
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      service: 'FreshTrack API',
      database: 'disconnected',
      error: error.message
    })
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Sentry error handler (must be before other error handlers)
Sentry.setupExpressErrorHandler(app)

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err)
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    sentryId: res.sentry
  })
})

// Start server
async function startServer() {
  try {
    console.log('📦 Connecting to PostgreSQL database...')
    
    // Test database connection
    const dbTest = await query('SELECT NOW() as time')
    console.log('✅ Database connected:', dbTest.rows[0]?.time)
    
    // Initialize database schema (creates tables if not exist)
    await initDatabase()
    console.log('✅ Database schema initialized')
    
    // Show stats
    const hotels = await getAllHotels()
    const usersResult = await query('SELECT COUNT(*) as count FROM users')
    const productsResult = await query('SELECT COUNT(*) as count FROM products')
    
    console.log(`📊 Data: ${hotels.length} hotels, ${usersResult.rows[0]?.count || 0} users, ${productsResult.rows[0]?.count || 0} products`)

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
🚀 FreshTrack Server is running!
📍 Port: ${PORT}
🌐 API: http://localhost:${PORT}/api
🗄️ Database: PostgreSQL

Available endpoints:
  - GET  /api/health
  - POST /api/auth/login
  - GET  /api/auth/me
  - GET  /api/hotels
  - GET  /api/departments
  - GET  /api/categories  
  - GET  /api/products
  - GET  /api/batches
  - GET  /api/notifications
  - GET  /api/reports/dashboard
  - GET  /api/notification-rules
      `)
      
      // Start notification jobs (Phase 5)
      try {
        startNotificationJobs({
          enableExpiryCheck: true,
          enableQueueProcess: true,
          enableTelegramPolling: process.env.TELEGRAM_POLLING === 'true'
        })
      } catch (error) {
        console.error('⚠️ Failed to start notification jobs:', error.message)
      }
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
