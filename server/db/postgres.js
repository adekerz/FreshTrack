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

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})

// Connection event handlers
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err)
})

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params)

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
