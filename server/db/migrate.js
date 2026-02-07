/**
 * FreshTrack Database Migration Script
 * Runs SQL migrations in order with rollback support
 * Supports checksum verification and non-fatal startup mode
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { query, getClient } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

/**
 * Compute SHA-256 checksum of migration SQL content
 */
function computeChecksum(sql) {
  return createHash('sha256').update(sql).digest('hex')
}

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
 * Ensure _migrations table exists with checksum column
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64)
    )
  `)
  // Add checksum column if missing (backward compat with old table)
  await client.query(`
    ALTER TABLE _migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64)
  `)
}

/**
 * Get migration status
 */
async function getMigrationStatus(client) {
  const appliedResult = await client.query(
    'SELECT name, applied_at, checksum FROM _migrations ORDER BY id'
  )
  const appliedMigrations = new Map(
    appliedResult.rows.map(r => [r.name, { applied_at: r.applied_at, checksum: r.checksum }])
  )

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort()

  return { appliedMigrations, files }
}

/**
 * Detect if database was initialized by legacy initDatabase() but _migrations is empty
 */
async function detectLegacyDatabase(client, files) {
  const migrationCount = await client.query('SELECT COUNT(*) as count FROM _migrations')
  if (parseInt(migrationCount.rows[0].count) > 0) return false

  // Check if core tables exist (created by legacy migrations)
  const tablesExist = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables WHERE table_name = 'users'
    ) as has_users
  `)

  return tablesExist.rows[0].has_users
}

/**
 * Backfill _migrations table for legacy databases
 */
async function backfillLegacyMigrations(client, files) {
  console.log('   Detected legacy database. Marking existing migrations as applied...')

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = readFileSync(filePath, 'utf8')
    const checksum = computeChecksum(sql)

    await client.query(
      'INSERT INTO _migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [file, checksum]
    )
  }

  console.log(`   Marked ${files.length} existing migrations as applied`)
}

/**
 * Show current migration status
 */
async function showStatus() {
  console.log('Migration Status\n')

  const client = await getClient()

  try {
    await ensureMigrationsTable(client)

    const { appliedMigrations, files } = await getMigrationStatus(client)

    console.log('Migration                                    Status      Checksum   Applied At')
    console.log('-'.repeat(90))

    for (const file of files) {
      const info = appliedMigrations.get(file)
      const status = info ? 'Applied' : 'Pending'
      const date = info ? new Date(info.applied_at).toLocaleString() : '-'

      // Verify checksum if applied
      let checksumStatus = ''
      if (info && info.checksum) {
        const filePath = join(migrationsDir, file)
        const sql = readFileSync(filePath, 'utf8')
        const currentChecksum = computeChecksum(sql)
        checksumStatus = currentChecksum === info.checksum ? 'OK' : 'CHANGED!'
      } else if (info) {
        checksumStatus = 'N/A'
      }

      console.log(`${file.padEnd(44)} ${status.padEnd(12)} ${checksumStatus.padEnd(10)} ${date}`)
    }

    // Check for orphaned migrations (in DB but file deleted)
    const orphaned = [...appliedMigrations.keys()].filter(name => !files.includes(name))
    if (orphaned.length > 0) {
      console.log('\nWARNING: Orphaned migrations (in DB but file missing):')
      orphaned.forEach(name => console.log(`   - ${name}`))
    }

    console.log()

  } finally {
    client.release()
  }
}

/**
 * Run pending migrations
 * @param {object} options
 * @param {boolean} options.fatal - If true (CLI mode), throw on error. If false (startup mode), log and continue.
 * @returns {{ applied: number, skipped: number, failed: Array<{file: string, error: string}> }}
 */
async function runMigrations({ fatal = true } = {}) {
  console.log('Running database migrations...\n')

  const client = await getClient()
  const result = { applied: 0, skipped: 0, failed: [] }

  try {
    await ensureMigrationsTable(client)

    const { appliedMigrations, files } = await getMigrationStatus(client)

    // Detect and backfill legacy database
    const isLegacy = await detectLegacyDatabase(client, files)
    if (isLegacy) {
      await backfillLegacyMigrations(client, files)
      result.skipped = files.length
      console.log('\n   Database is up to date (legacy backfill)')
      return result
    }

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        result.skipped++
        continue
      }

      console.log(`   Applying ${file}...`)

      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      const checksum = computeChecksum(sql)

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO _migrations (name, checksum) VALUES ($1, $2)',
          [file, checksum]
        )
        await client.query('COMMIT')
        console.log(`   Applied ${file}`)
        result.applied++
      } catch (err) {
        await client.query('ROLLBACK')
        const errorMsg = err.message

        if (fatal) {
          console.error(`   Failed to apply ${file}: ${errorMsg}`)
          throw err
        } else {
          // Non-fatal mode: log warning and continue
          console.warn(`   WARNING: Failed to apply ${file}: ${errorMsg} (non-fatal, continuing)`)
          result.failed.push({ file, error: errorMsg })
        }
      }
    }

    if (result.applied === 0 && result.failed.length === 0) {
      console.log('   Database is up to date!')
    } else if (result.applied > 0) {
      console.log(`   Applied ${result.applied} migration(s)`)
    }

    if (result.failed.length > 0) {
      console.warn(`   WARNING: ${result.failed.length} migration(s) failed`)
    }

    return result

  } finally {
    client.release()
  }
}

/**
 * Rollback migrations
 */
async function rollbackMigrations(steps, target) {
  console.log('Rolling back migrations...\n')

  const client = await getClient()

  try {
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = '_migrations'
      )
    `)

    if (!tableExists.rows[0].exists) {
      console.log('No migrations have been applied yet.')
      return
    }

    const appliedResult = await client.query(
      'SELECT id, name FROM _migrations ORDER BY id DESC'
    )

    if (appliedResult.rows.length === 0) {
      console.log('No migrations to rollback.')
      return
    }

    let migrationsToRollback = []

    if (target) {
      for (const row of appliedResult.rows) {
        if (row.name === target) break
        migrationsToRollback.push(row)
      }

      if (migrationsToRollback.length === 0) {
        console.log(`Target migration "${target}" is the current state or not found.`)
        return
      }
    } else {
      migrationsToRollback = appliedResult.rows.slice(0, steps)
    }

    for (const migration of migrationsToRollback) {
      const downFile = migration.name.replace('.sql', '.down.sql')
      const downPath = join(migrationsDir, downFile)

      if (!existsSync(downPath)) {
        console.log(`   No rollback file for ${migration.name}`)
        console.log(`   Expected: ${downFile}`)
        console.log(`   Skipping rollback for this migration.\n`)
        continue
      }

      console.log(`   Rolling back ${migration.name}...`)

      const sql = readFileSync(downPath, 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('DELETE FROM _migrations WHERE id = $1', [migration.id])
        await client.query('COMMIT')
        console.log(`   Rolled back ${migration.name}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`   Failed to rollback ${migration.name}: ${err.message}`)
        throw err
      }
    }

    console.log('\n   Rollback completed!')

  } finally {
    client.release()
  }
}

// Main execution (CLI mode)
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

  await runMigrations({ fatal: true })
}

// Only run CLI when executed directly (not when imported)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('migrate.js') ||
  process.argv[1].endsWith('migrate')
)

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}

export { runMigrations, rollbackMigrations, showStatus }
