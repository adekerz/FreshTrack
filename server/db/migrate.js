/**
 * FreshTrack Database Migration Script
 * Runs SQL migrations in order with rollback support
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query, getClient } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    rollback: args.includes('--rollback') || args.includes('-r'),
    steps: parseInt(args.find(a => a.startsWith('--steps='))?.split('=')[1] || '1'),
    target: args.find(a => a.startsWith('--target='))?.split('=')[1],
    status: args.includes('--status') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h')
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
FreshTrack Database Migration Tool

Usage: node db/migrate.js [options]

Options:
  --rollback, -r    Rollback migrations instead of applying them
  --steps=N         Number of migrations to rollback (default: 1)
  --target=NAME     Rollback to specific migration (exclusive)
  --status, -s      Show migration status
  --help, -h        Show this help message

Examples:
  node db/migrate.js              # Apply all pending migrations
  node db/migrate.js --status     # Show migration status
  node db/migrate.js --rollback   # Rollback last migration
  node db/migrate.js --rollback --steps=3   # Rollback last 3 migrations
  node db/migrate.js --rollback --target=002_relax_department_constraints.sql
  `)
}

/**
 * Get migration status
 */
async function getMigrationStatus(client) {
  // Get already applied migrations
  const appliedResult = await client.query(
    'SELECT name, applied_at FROM _migrations ORDER BY id'
  )
  const appliedMigrations = new Map(
    appliedResult.rows.map(r => [r.name, r.applied_at])
  )
  
  // Get migration files
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
  
  return { appliedMigrations, files }
}

/**
 * Show current migration status
 */
async function showStatus() {
  console.log('📊 Migration Status\n')
  
  const client = await getClient()
  
  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    const { appliedMigrations, files } = await getMigrationStatus(client)
    
    console.log('Migration                                    Status      Applied At')
    console.log('─'.repeat(75))
    
    for (const file of files) {
      const appliedAt = appliedMigrations.get(file)
      const status = appliedAt ? '✅ Applied' : '⏳ Pending'
      const date = appliedAt ? new Date(appliedAt).toLocaleString() : '-'
      console.log(`${file.padEnd(44)} ${status.padEnd(12)} ${date}`)
    }
    
    // Check for orphaned migrations (in DB but file deleted)
    const orphaned = [...appliedMigrations.keys()].filter(name => !files.includes(name))
    if (orphaned.length > 0) {
      console.log('\n⚠️  Orphaned migrations (in DB but file missing):')
      orphaned.forEach(name => console.log(`   - ${name}`))
    }
    
    console.log()
    
  } finally {
    client.release()
  }
}

/**
 * Run pending migrations
 */
async function runMigrations() {
  console.log('🔄 Running database migrations...\n')
  
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
    
    const { appliedMigrations, files } = await getMigrationStatus(client)
    
    let applied = 0
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`)
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
        applied++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`❌ Failed to apply ${file}:`, err.message)
        throw err
      }
    }
    
    if (applied === 0) {
      console.log('\n✅ Database is up to date!')
    } else {
      console.log(`\n✅ Applied ${applied} migration(s)`)
    }
    
  } finally {
    client.release()
  }
}

/**
 * Rollback migrations
 */
async function rollbackMigrations(steps, target) {
  console.log('🔄 Rolling back migrations...\n')
  
  const client = await getClient()
  
  try {
    // Check migrations table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_migrations'
      )
    `)
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ No migrations have been applied yet.')
      return
    }
    
    // Get applied migrations in reverse order
    const appliedResult = await client.query(
      'SELECT id, name FROM _migrations ORDER BY id DESC'
    )
    
    if (appliedResult.rows.length === 0) {
      console.log('❌ No migrations to rollback.')
      return
    }
    
    // Determine which migrations to rollback
    let migrationsToRollback = []
    
    if (target) {
      // Rollback until we reach the target (exclusive)
      for (const row of appliedResult.rows) {
        if (row.name === target) break
        migrationsToRollback.push(row)
      }
      
      if (migrationsToRollback.length === 0) {
        console.log(`❌ Target migration "${target}" is the current state or not found.`)
        return
      }
    } else {
      // Rollback specified number of steps
      migrationsToRollback = appliedResult.rows.slice(0, steps)
    }
    
    // Execute rollbacks
    for (const migration of migrationsToRollback) {
      const downFile = migration.name.replace('.sql', '.down.sql')
      const downPath = join(migrationsDir, downFile)
      
      if (!existsSync(downPath)) {
        console.log(`⚠️  No rollback file for ${migration.name}`)
        console.log(`   Expected: ${downFile}`)
        console.log(`   Skipping rollback for this migration.`)
        console.log(`   To rollback manually, create ${downFile} with the reverse SQL.\n`)
        continue
      }
      
      console.log(`📄 Rolling back ${migration.name}...`)
      
      const sql = readFileSync(downPath, 'utf8')
      
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('DELETE FROM _migrations WHERE id = $1', [migration.id])
        await client.query('COMMIT')
        console.log(`✅ Rolled back ${migration.name}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`❌ Failed to rollback ${migration.name}:`, err.message)
        throw err
      }
    }
    
    console.log('\n✅ Rollback completed!')
    
  } finally {
    client.release()
  }
}

// Main execution
async function main() {
  const args = parseArgs()
  
  if (args.help) {
    showHelp()
    return
  }
  
  if (args.status) {
    await showStatus()
    return
  }
  
  if (args.rollback) {
    await rollbackMigrations(args.steps, args.target)
    return
  }
  
  await runMigrations()
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })

export { runMigrations, rollbackMigrations, showStatus }
