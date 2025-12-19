/**
 * FreshTrack Database Migration Script
 * Runs SQL migrations in order
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query, getClient } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

async function runMigrations() {
  console.log('🔄 Running database migrations...')
  
  const client = await getClient()
  
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Get already applied migrations
    const appliedResult = await client.query('SELECT name FROM _migrations ORDER BY id')
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.name))
    
    // Get migration files
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
    
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`⏭️ Skipping ${file} (already applied)`)
        continue
      }
      
      console.log(`📄 Applying ${file}...`)
      
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`✅ Applied ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`❌ Failed to apply ${file}:`, err.message)
        throw err
      }
    }
    
    console.log('✅ All migrations completed!')
    
  } finally {
    client.release()
  }
}

// Run if called directly
runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })

export { runMigrations }
