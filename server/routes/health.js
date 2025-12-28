/**
 * FreshTrack Health Check API - PostgreSQL Async Version
 */

import express from 'express'
import { query, getEnvironmentInfo } from '../db/postgres.js'
import { initDatabase } from '../db/database.js'
import { simpleRateLimit, logError } from '../utils/logger.js'

const router = express.Router()

// GET /api/health - Basic health check (rate limited, no DB query for DoS protection)
router.get('/', simpleRateLimit, (req, res) => {
  const envInfo = getEnvironmentInfo()
  res.json({
    success: true,
    status: 'healthy',
    version: process.env.npm_package_version || '2.0.0',
    environment: envInfo.environment,
    dbHost: envInfo.dbHost,
    timestamp: new Date().toISOString()
  })
})

// GET /api/health/detailed - Detailed health with DB check (rate limited)
router.get('/detailed', simpleRateLimit, async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await query('SELECT NOW() as time')
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      server_time: dbCheck.rows[0]?.time,
      version: process.env.npm_package_version || '2.0.0'
    })
  } catch (error) {
    logError('HealthCheck', error)
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    })
  }
})

// GET /api/health/db-status - Check database data status
router.get('/db-status', async (req, res) => {
  try {
    const hotelsResult = await query('SELECT COUNT(*) as count FROM hotels')
    const deptsResult = await query('SELECT COUNT(*) as count FROM departments')
    const usersResult = await query('SELECT COUNT(*) as count FROM users')
    const productsResult = await query('SELECT COUNT(*) as count FROM products')
    const categoriesResult = await query('SELECT COUNT(*) as count FROM categories')
    const batchesResult = await query('SELECT COUNT(*) as count FROM batches')
    
    res.json({
      success: true,
      counts: {
        hotels: parseInt(hotelsResult.rows[0]?.count || 0),
        departments: parseInt(deptsResult.rows[0]?.count || 0),
        users: parseInt(usersResult.rows[0]?.count || 0),
        products: parseInt(productsResult.rows[0]?.count || 0),
        categories: parseInt(categoriesResult.rows[0]?.count || 0),
        batches: parseInt(batchesResult.rows[0]?.count || 0)
      },
      needsInit: parseInt(hotelsResult.rows[0]?.count || 0) === 0
    })
  } catch (error) {
    logError('HealthCheck', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/health/init-db - Initialize database with pilot data
// ⚠️ SECURITY: Only available in development mode or with valid INIT_SECRET
router.post('/init-db', async (req, res) => {
  // Block in production unless INIT_SECRET is explicitly set and matches
  const initSecret = process.env.INIT_SECRET
  const { secret } = req.body
  
  // In production: require INIT_SECRET env var to be set and matched
  if (process.env.NODE_ENV === 'production') {
    if (!initSecret) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }
    if (secret !== initSecret) {
      return res.status(403).json({ success: false, error: 'Invalid secret key' })
    }
  } else {
    // In development: require INIT_SECRET env var or skip secret check
    if (initSecret && secret !== initSecret) {
      return res.status(403).json({ success: false, error: 'Invalid secret key' })
    }
    // If no INIT_SECRET set in dev, allow without secret for convenience
  }
  
  try {
    await initDatabase()
    res.json({ success: true, message: 'Database initialized successfully' })
  } catch (error) {
    logError('HealthCheck', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
