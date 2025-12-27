/**
 * FreshTrack PostgreSQL Connection
 * Connection pool for Railway PostgreSQL
 */

import pg from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const { Pool } = pg

// Railway PostgreSQL connection string (supports both internal and public URLs)
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL or DATABASE_PUBLIC_URL not set!')
  process.exit(1)
}

// Determine if running locally (connecting to remote Railway DB) or on Railway
const isLocal = !process.env.RAILWAY_ENVIRONMENT
const isLocalDB = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')

const pool = new Pool({
  connectionString,
  ssl: isLocalDB ? false : { rejectUnauthorized: false }, // SSL only for remote DBs
  max: 10, // Reduced pool size for stability
  min: 2, // Keep minimum connections alive
  idleTimeoutMillis: 60000, // Close idle connections after 60s
  connectionTimeoutMillis: 30000, // 30s timeout for new connections
  acquireTimeoutMillis: 30000, // 30s timeout to acquire connection from pool
  // Keep connections alive (important for remote connections)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
})

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL')
  // Set statement timeout for each connection
  client.query('SET statement_timeout = 30000') // 30s query timeout
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
    console.log('✅ Database connection test successful:', result.rows[0].now)
    return true
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message)
    return false
  }
}

export default pool
