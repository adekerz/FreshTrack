/**
 * FreshTrack Database Backup Script
 * Creates timestamped PostgreSQL database backups
 * 
 * Usage: npm run backup
 * Environment: requires DATABASE_URL or individual DB_* variables
 */

import { exec } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKUPS_DIR = join(__dirname, '..', 'backups')
const MAX_BACKUPS = 10 // Keep last N backups

/**
 * Parse database URL or individual variables
 */
function getDatabaseConfig() {
  const url = process.env.DATABASE_URL
  
  if (url) {
    // Parse PostgreSQL URL: postgresql://user:password@host:port/database
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4],
        database: match[5]
      }
    }
  }
  
  return {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    database: process.env.DB_NAME || 'freshtrack'
  }
}

/**
 * Generate timestamped filename
 */
function getBackupFilename() {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .replace(/\.\d+Z$/, '')
  return `backup_${timestamp}.sql`
}

/**
 * Cleanup old backups, keeping only MAX_BACKUPS most recent
 */
function cleanupOldBackups() {
  if (!existsSync(BACKUPS_DIR)) return
  
  const backups = readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
    .sort()
    .reverse()
  
  // Remove older backups beyond MAX_BACKUPS
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS)
    for (const file of toDelete) {
      const filePath = join(BACKUPS_DIR, file)
      console.log(`🗑️ Removing old backup: ${file}`)
      unlinkSync(filePath)
    }
  }
}

/**
 * Create database backup using pg_dump
 */
async function createBackup() {
  const config = getDatabaseConfig()
  
  // Ensure backups directory exists
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true })
  }
  
  const filename = getBackupFilename()
  const filepath = join(BACKUPS_DIR, filename)
  
  console.log('📦 Creating database backup...')
  console.log(`   Database: ${config.database}`)
  console.log(`   Host: ${config.host}:${config.port}`)
  console.log(`   Output: ${filepath}`)
  
  // Build pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${config.host}`,
    `-p ${config.port}`,
    `-U ${config.user}`,
    `-d ${config.database}`,
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    `--file="${filepath}"`
  ].join(' ')
  
  // Set PGPASSWORD environment variable for authentication
  const env = { ...process.env, PGPASSWORD: config.password }
  
  return new Promise((resolve, reject) => {
    exec(pgDumpCmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Backup failed:', error.message)
        if (stderr) console.error('   ', stderr)
        reject(error)
        return
      }
      
      console.log(`✅ Backup created: ${filename}`)
      
      // Cleanup old backups
      cleanupOldBackups()
      
      resolve(filepath)
    })
  })
}

/**
 * Restore database from backup file
 */
async function restoreBackup(backupFile) {
  const config = getDatabaseConfig()
  
  const filepath = backupFile.includes('/') || backupFile.includes('\\')
    ? backupFile
    : join(BACKUPS_DIR, backupFile)
  
  if (!existsSync(filepath)) {
    throw new Error(`Backup file not found: ${filepath}`)
  }
  
  console.log('🔄 Restoring database from backup...')
  console.log(`   File: ${filepath}`)
  console.log(`   Database: ${config.database}`)
  
  const psqlCmd = [
    'psql',
    `-h ${config.host}`,
    `-p ${config.port}`,
    `-U ${config.user}`,
    `-d ${config.database}`,
    `-f "${filepath}"`
  ].join(' ')
  
  const env = { ...process.env, PGPASSWORD: config.password }
  
  return new Promise((resolve, reject) => {
    exec(psqlCmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Restore failed:', error.message)
        if (stderr) console.error('   ', stderr)
        reject(error)
        return
      }
      
      console.log('✅ Database restored successfully')
      resolve(true)
    })
  })
}

/**
 * List available backups
 */
function listBackups() {
  if (!existsSync(BACKUPS_DIR)) {
    console.log('📂 No backups directory found')
    return []
  }
  
  const backups = readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
    .sort()
    .reverse()
  
  if (backups.length === 0) {
    console.log('📂 No backups found')
  } else {
    console.log(`📂 Available backups (${backups.length}):`)
    backups.forEach((b, i) => {
      const timestamp = b.replace('backup_', '').replace('.sql', '')
      console.log(`   ${i + 1}. ${b}`)
    })
  }
  
  return backups
}

/**
 * Generate pre-migration backup with special naming
 */
async function preMigrationBackup(migrationName) {
  const config = getDatabaseConfig()
  
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true })
  }
  
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const safeName = migrationName.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `pre_migration_${safeName}_${timestamp}.sql`
  const filepath = join(BACKUPS_DIR, filename)
  
  console.log(`📦 Creating pre-migration backup: ${filename}`)
  
  const pgDumpCmd = [
    'pg_dump',
    `-h ${config.host}`,
    `-p ${config.port}`,
    `-U ${config.user}`,
    `-d ${config.database}`,
    '--format=plain',
    `--file="${filepath}"`
  ].join(' ')
  
  const env = { ...process.env, PGPASSWORD: config.password }
  
  return new Promise((resolve, reject) => {
    exec(pgDumpCmd, { env }, (error) => {
      if (error) {
        console.error('❌ Pre-migration backup failed:', error.message)
        reject(error)
        return
      }
      console.log(`✅ Pre-migration backup created: ${filename}`)
      resolve(filepath)
    })
  })
}

// CLI handling
const args = process.argv.slice(2)
const command = args[0] || 'create'

switch (command) {
  case 'create':
    createBackup()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
    break
    
  case 'restore':
    const backupFile = args[1]
    if (!backupFile) {
      console.log('Usage: npm run backup restore <backup_filename>')
      listBackups()
      process.exit(1)
    }
    restoreBackup(backupFile)
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
    break
    
  case 'list':
    listBackups()
    process.exit(0)
    break
    
  case 'pre-migration':
    const migrationName = args[1] || 'unknown'
    preMigrationBackup(migrationName)
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
    break
    
  default:
    console.log(`
FreshTrack Database Backup Utility

Commands:
  create              Create a new backup
  restore <file>      Restore from backup file
  list                List available backups
  pre-migration <name> Create backup before migration
    `)
    process.exit(0)
}

export { createBackup, restoreBackup, listBackups, preMigrationBackup }
