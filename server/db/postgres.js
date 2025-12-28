/**
 * FreshTrack PostgreSQL Connection
 * Supports dual environments:
 * - LOCAL: Docker PostgreSQL (localhost:5432)
 * - PRODUCTION: Railway PostgreSQL (auto-configured)
 */

import pg from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const { Pool } = pg

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// ═══════════════════════════════════════════════════════════════

const isRailway = !!process.env.RAILWAY_ENVIRONMENT
const nodeEnv = process.env.NODE_ENV || 'development'

// Railway sets DATABASE_URL automatically in production
// Locally we use DATABASE_URL from .env (Docker PostgreSQL)
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL not set!')
  console.error('   Local: Check server/.env file')
  console.error('   Railway: Set DATABASE_URL in Railway dashboard')
  process.exit(1)
}

// Detect if connecting to local Docker DB
const isLocalDB = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

// ═══════════════════════════════════════════════════════════════
// CONNECTION POOL CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const pool = new Pool({
  connectionString,
  // SSL: disabled for local Docker, enabled for Railway
  ssl: isLocalDB ? false : { rejectUnauthorized: false },
  // Pool settings optimized per environment
  max: isLocalDB ? 5 : 10,      // Smaller pool for local dev
  min: isLocalDB ? 1 : 2,       // Fewer min connections locally
  idleTimeoutMillis: isLocalDB ? 30000 : 60000,
  connectionTimeoutMillis: isLocalDB ? 10000 : 30000,
  acquireTimeoutMillis: isLocalDB ? 10000 : 30000,
  keepAlive: !isLocalDB,        // Keep-alive only for remote
  keepAliveInitialDelayMillis: 10000,
})

// ═══════════════════════════════════════════════════════════════
// CONNECTION EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

pool.on('connect', (client) => {
  const envLabel = isRailway ? '🚀 RAILWAY' : '🐳 DOCKER LOCAL'
  console.log(`✅ Connected to PostgreSQL [${envLabel}]`)
  client.query('SET statement_timeout = 30000')
})

pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL pool error:', err.message)
  // Don't exit on connection errors - pool will handle reconnection
})

pool.on('remove', () => {
  console.log('🔄 PostgreSQL connection removed from pool')
})

/**
 * Execute a query with parameters and automatic retry
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @param {number} retries - Number of retries
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params, retries = 2) => {
  try {
    return await pool.query(text, params)
  } catch (error) {
    if (retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message.includes('Connection terminated'))) {
      console.log(`🔄 Retrying query (${retries} attempts left)...`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
      return query(text, params, retries - 1)
    }
    throw error
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = () => pool.connect()

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const result = await query('SELECT NOW()')
    const envLabel = isRailway ? '🚀 RAILWAY' : '🐳 DOCKER LOCAL'
    console.log(`✅ Database connection test [${envLabel}]:`, result.rows[0].now)
    return true
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message)
    return false
  }
}

/**
 * Get current environment info
 */
export function getEnvironmentInfo() {
  return {
    environment: isRailway ? 'railway' : 'local',
    isLocal: isLocalDB,
    nodeEnv,
    dbHost: isLocalDB ? 'localhost:5432 (Docker)' : 'Railway PostgreSQL'
  }
}

export default pool
