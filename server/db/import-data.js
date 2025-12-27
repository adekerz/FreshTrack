/**
 * FreshTrack Data Import Script
 * Imports data from SQLite backup JSON to PostgreSQL
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query, getClient } from './postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backupFile = join(__dirname, 'backup_data.json')

async function importData() {
  console.log('📥 Importing data from SQLite backup...')
  
  const client = await getClient()
  
  try {
    // Read backup file
    const backupData = JSON.parse(readFileSync(backupFile, 'utf8'))
    console.log('📄 Backup data loaded:')
    console.log(`   - Hotels: ${backupData.hotels.length}`)
    console.log(`   - Departments: ${backupData.departments.length}`)
    console.log(`   - Users: ${backupData.users.length}`)
    console.log(`   - Categories: ${backupData.categories.length}`)
    console.log(`   - Products: ${backupData.products.length}`)
    console.log(`   - Batches: ${backupData.batches.length}`)
    
    await client.query('BEGIN')
    
    // Import hotels
    for (const hotel of backupData.hotels) {
      await client.query(`
        INSERT INTO hotels (id, name, code, description, address, phone, email, timezone, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [hotel.id, hotel.name, hotel.code, hotel.description, hotel.address, hotel.phone, hotel.email, hotel.timezone || 'Asia/Almaty', hotel.is_active !== 0, hotel.created_at])
    }
    console.log(`✅ Hotels imported: ${backupData.hotels.length}`)
    
    // Import departments
    for (const dept of backupData.departments) {
      await client.query(`
        INSERT INTO departments (id, hotel_id, name, code, description, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [dept.id, dept.hotel_id, dept.name, dept.code, dept.description, dept.is_active !== 0, dept.created_at])
    }
    console.log(`✅ Departments imported: ${backupData.departments.length}`)
    
    // Import users (password already hashed in backup)
    for (const user of backupData.users) {
      await client.query(`
        INSERT INTO users (id, hotel_id, department_id, login, name, email, password, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [user.id, user.hotel_id, user.department_id, user.login, user.name, user.email, user.password, user.role, user.is_active !== 0, user.created_at])
    }
    console.log(`✅ Users imported: ${backupData.users.length}`)
    
    // Import categories
    for (const cat of backupData.categories) {
      await client.query(`
        INSERT INTO categories (id, hotel_id, department_id, name, description, color, icon, parent_id, sort_order, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [cat.id, cat.hotel_id, cat.department_id, cat.name, cat.description, cat.color, cat.icon, cat.parent_id, cat.sort_order || 0, cat.is_active !== 0, cat.created_at])
    }
    console.log(`✅ Categories imported: ${backupData.categories.length}`)
    
    // Import products
    for (const prod of backupData.products) {
      await client.query(`
        INSERT INTO products (id, hotel_id, department_id, category_id, name, description, sku, barcode, unit, min_quantity, max_quantity, reorder_point, storage_location, storage_conditions, default_expiry_days, notes, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO NOTHING
      `, [
        prod.id, prod.hotel_id, prod.department_id, prod.category_id, prod.name, prod.description,
        prod.sku, prod.barcode, prod.unit || 'шт', prod.min_quantity, prod.max_quantity,
        prod.reorder_point, prod.storage_location, prod.storage_conditions,
        prod.default_expiry_days, prod.notes, prod.is_active !== 0, prod.created_at
      ])
    }
    console.log(`✅ Products imported: ${backupData.products.length}`)
    
    // Import batches
    for (const batch of backupData.batches) {
      await client.query(`
        INSERT INTO batches (id, product_id, quantity, production_date, expiry_date, batch_code, supplier, notes, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        batch.id, batch.product_id, batch.quantity, batch.production_date,
        batch.expiry_date, batch.batch_code, batch.supplier, batch.notes,
        batch.status || 'active', batch.created_at
      ])
    }
    console.log(`✅ Batches imported: ${backupData.batches.length}`)
    
    // Import write-offs
    if (backupData.write_offs) {
      for (const wo of backupData.write_offs) {
        await client.query(`
          INSERT INTO write_offs (id, hotel_id, batch_id, product_id, quantity, reason, notes, user_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [wo.id, wo.hotel_id, wo.batch_id, wo.product_id, wo.quantity, wo.reason, wo.notes, wo.user_id, wo.created_at])
      }
      console.log(`✅ Write-offs imported: ${backupData.write_offs.length}`)
    }
    
    // Import settings
    if (backupData.settings) {
      for (const setting of backupData.settings) {
        await client.query(`
          INSERT INTO settings (id, hotel_id, key, value, category, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [setting.id, setting.hotel_id, setting.key, setting.value, setting.category, setting.created_at])
      }
      console.log(`✅ Settings imported: ${backupData.settings.length}`)
    }
    
    await client.query('COMMIT')
    console.log('\n✅ All data imported successfully!')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Import failed:', error)
    throw error
  } finally {
    client.release()
  }
}

// Run import
importData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
