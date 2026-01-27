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
import helmet from 'helmet'

// Load environment variables
dotenv.config()

// Validate required environment variables
import { validateRequiredEnv } from './utils/validateEnv.js'
validateRequiredEnv()

// Import rate limiter
import { rateLimitGeneral, rateLimitAuth, rateLimitHeavy, rateLimitPendingStatus, rateLimitWebhook, rateLimitLogin } from './middleware/rateLimiter.js'

// Import routes
import docsRouter from './routes/docs.js'

// Feature-based modules (new architecture)
import {
  authRouter,
  inventoryRouter,
  notificationsRouter as notificationsModuleRouter,
  settingsRouter as settingsModuleRouter,
  reportsRouter as reportsModuleRouter,
  hotelsController,
  departmentsController,
  collectionsController,
  fifoCollectController,
  writeOffsController,
  auditController,
  deliveryTemplatesController,
  notificationRulesController,
  customContentController,
  departmentSettingsController,
  healthController,
  importController,
  exportController,
  telegramController,
  eventsController,
  marshaCodesController,
  gdprController
} from './modules/index.js'
import { webhooksRouter } from './modules/webhooks/index.js'

// Import notification jobs
import { startNotificationJobs } from './jobs/notificationJobs.js'
import { startCleanupJobs } from './jobs/cleanupJobs.js'
import { startAuditVerificationJob } from './jobs/auditVerificationJob.js'
import { startDataRetentionJob } from './jobs/dataRetentionJob.js'

// Import database
import { initDatabase, getAllHotels } from './db/database.js'
import { query } from './db/postgres.js'

const app = express()
const PORT = process.env.PORT || 3001

// CORS - NODE_ENV + CORS_ORIGINS (comma-separated, e.g. Vercel preview URLs)
const baseOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://freshtrack.systems', 'https://www.freshtrack.systems']
    : ['http://localhost:5173']
const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowedOrigins = [...baseOrigins, ...extraOrigins]

console.log(`[CORS] Mode: ${process.env.NODE_ENV || 'development'}`)
console.log(`[CORS] Allowed origins:`, allowedOrigins)

// *.vercel.app preview deployments (e.g. fresh-track-xxx-adekerzs-projects.vercel.app)
const vercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests don't send Origin header
      if (!origin) {
        // Allow in dev
        if (process.env.NODE_ENV === 'development') {
          callback(null, true)
          return
        }
        
        // In production: allow same-origin requests (they don't send Origin)
        // We can't check Referer here (not available in CORS callback)
        // But same-origin requests are automatically allowed by browsers
        // Only reject if explicitly needed (for now, allow in production too)
        // TODO: Add middleware to check Referer for non-browser requests
        callback(null, true)
        return
      }
      
      // Origin present - check against whitelist
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else if (process.env.NODE_ENV === 'production' && vercelPreview.test(origin)) {
        callback(null, true)
      } else {
        console.log('[CORS] Rejected origin:', origin)
        callback(new Error('CORS not allowed'), false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hotel-Id', 'X-Department-Id'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After']
  })
)

// Preflight уже обрабатывается cors middleware выше
// Удаляем дублирующий app.options('*', cors()) - он использовал дефолтные настройки

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

// Security headers with Helmet
app.use(helmet({
  // Отключить CSP в development (ломает HMR)
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS
      scriptSrc: ["'self'"], // Vite bundles скрипты
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        process.env.APP_URL || 'https://freshtrack.systems'
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false, // ← ОТКЛЮЧИТЬ в dev!
  
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}))

// Request logging (development only)
import { requestLogger } from './utils/logger.js'
app.use(requestLogger)

// Rate limiting (before routes)
app.use('/api', rateLimitGeneral)

// Pending status has lighter rate limit (checked every 30s by pending users)
app.use('/api/auth/pending-status', rateLimitPendingStatus)

// API Routes - with specific rate limits
// Feature-based modules (new architecture)
// Login has stricter rate limit (5/15min) - must be before general auth rate limit
app.use('/api/auth/login', rateLimitLogin)
app.use('/api/auth', rateLimitAuth, authRouter)
app.use('/api', inventoryRouter) // handles /batches, /products, /categories

// Migrated to feature-based modules
app.use('/api/hotels', hotelsController)
app.use('/api/departments', departmentsController)
app.use('/api/collections', collectionsController)
app.use('/api/fifo-collect', fifoCollectController)
app.use('/api/write-offs', writeOffsController)
app.use('/api/audit-logs', auditController)
app.use('/api/delivery-templates', deliveryTemplatesController)
app.use('/api/notification-rules', notificationRulesController)
app.use('/api/custom-content', customContentController)
app.use('/api/department-settings', departmentSettingsController)
app.use('/api/health', healthController)
app.use('/api/import', importController)
app.use('/api/export', rateLimitHeavy, exportController)

// Feature-based modules (new architecture)
app.use('/api/notifications', notificationsModuleRouter)
app.use('/api/reports', reportsModuleRouter)
app.use('/api/settings', settingsModuleRouter)

// API Documentation (Swagger UI)
app.use('/api/docs', docsRouter)

// Fully migrated to feature-based modules
app.use('/api/telegram', telegramController)
app.use('/api/events', eventsController)
app.use('/api/marsha-codes', marshaCodesController)
app.use('/api/gdpr', gdprController)

// Webhooks (with rate limiting - 60 requests per minute)
app.use('/webhooks', rateLimitWebhook, webhooksRouter)

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
🚀 FreshTrack Server v2.0 — Modular Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Port: ${PORT}
🌐 API: http://localhost:${PORT}/api
📚 Docs: http://localhost:${PORT}/api/docs
🗄️ Database: PostgreSQL

📦 Modules (21 feature-based):
  ├─ auth, inventory, notifications, settings, reports
  ├─ hotels, departments, collections, fifo-collect
  ├─ write-offs, audit, delivery-templates
  ├─ notification-rules, custom-content, department-settings
  ├─ health, import, export, telegram, events, marsha-codes
  └─ All legacy routes migrated ✓

🔗 Key Endpoints:
  • Auth:     POST /api/auth/login, GET /api/auth/me
  • Hotels:   GET /api/hotels, GET /api/departments
  • Inventory: GET /api/products, GET /api/batches, GET /api/categories
  • Reports:  GET /api/reports/dashboard
  • SSE:      GET /api/events/stream
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

      // Start cleanup jobs (expired verification codes, etc.)
      try {
        startCleanupJobs()
      } catch (error) {
        console.error('⚠️ Failed to start cleanup jobs:', error.message)
      }

      // Start audit verification job (integrity checks)
      try {
        startAuditVerificationJob()
      } catch (error) {
        console.error('⚠️ Failed to start audit verification job:', error.message)
      }

      // Start data retention job (GDPR compliance)
      try {
        startDataRetentionJob()
      } catch (error) {
        console.error('⚠️ Failed to start data retention job:', error.message)
      }
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
