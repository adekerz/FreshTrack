/**
 * FreshTrack PostgreSQL Connection
 * Supports multiple environments:
 * - DEVELOPMENT: Supabase (cloud PostgreSQL)
 * - PRODUCTION: Railway PostgreSQL (auto-configured)
 * - LOCAL: Docker PostgreSQL (localhost:5432) - optional, not used currently
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
// Development uses DATABASE_URL from .env (Supabase)
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL not set!')
  console.error('   Development: Check server/.env file (Supabase)')
  console.error('   Railway: Set DATABASE_URL in Railway dashboard')
  process.exit(1)
}

// Detect if connecting to local Docker DB (optional, not used currently)
const isLocalDB = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

// Detect if connecting to Supabase
const isSupabase = connectionString.includes('supabase.com') || connectionString.includes('pooler.supabase.com')

// ═══════════════════════════════════════════════════════════════
// CONNECTION POOL CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const pool = new Pool({
  connectionString,
  // SSL: disabled for local Docker, enabled for Supabase/Railway
  ssl: isLocalDB ? false : { rejectUnauthorized: false },
  // Pool settings optimized per environment
  max: isLocalDB ? 5 : (isSupabase ? 10 : 10),      // Supabase/Railway: 10, Docker: 5
  min: isLocalDB ? 1 : (isSupabase ? 2 : 2),         // Supabase/Railway: 2, Docker: 1
  idleTimeoutMillis: isLocalDB ? 30000 : 60000,
  connectionTimeoutMillis: isLocalDB ? 10000 : 30000,
  acquireTimeoutMillis: isLocalDB ? 10000 : 30000,
  keepAlive: !isLocalDB,        // Keep-alive for Supabase/Railway
  keepAliveInitialDelayMillis: 10000,
})

// ═══════════════════════════════════════════════════════════════
// CONNECTION EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

pool.on('connect', (client) => {
  let envLabel
  if (isRailway) {
    envLabel = '🚀 RAILWAY'
  } else if (isSupabase) {
    envLabel = '☁️ SUPABASE'
  } else if (isLocalDB) {
    envLabel = '🐳 DOCKER LOCAL'
  } else {
    envLabel = '📦 REMOTE'
  }
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
    let envLabel
    if (isRailway) {
      envLabel = '🚀 RAILWAY'
    } else if (isSupabase) {
      envLabel = '☁️ SUPABASE'
    } else if (isLocalDB) {
      envLabel = '🐳 DOCKER LOCAL'
    } else {
      envLabel = '📦 REMOTE'
    }
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
  let environment, dbHost
  if (isRailway) {
    environment = 'railway'
    dbHost = 'Railway PostgreSQL'
  } else if (isSupabase) {
    environment = 'supabase'
    dbHost = 'Supabase (cloud)'
  } else if (isLocalDB) {
    environment = 'local'
    dbHost = 'localhost:5432 (Docker)'
  } else {
    environment = 'remote'
    dbHost = 'Remote PostgreSQL'
  }
  
  return {
    environment,
    isLocal: isLocalDB,
    isSupabase,
    nodeEnv,
    dbHost
  }
}

export default pool
