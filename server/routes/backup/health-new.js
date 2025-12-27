/**
 * FreshTrack Health Check API - PostgreSQL Async Version
 */

import express from 'express'
import { query } from '../db/postgres.js'

const router = express.Router()

// GET /api/health
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await query('SELECT NOW() as time')
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      server_time: dbCheck.rows[0]?.time,
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    })
  }
})

export default router
