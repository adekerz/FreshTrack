// Cleanup script for St. Regis Astana products
// Run with: node cleanup-stregis.js
// For production: Set DATABASE_URL environment variable to production database

import { query } from './db/postgres.js'

async function cleanup() {
  try {
    console.log('🔍 Looking for St. Regis Astana...\n')
    
    // Find hotel
    const hotels = await query("SELECT id, name FROM hotels WHERE name ILIKE '%regis%'")
    
    if (hotels.rows.length === 0) {
      console.log('❌ Hotel not found')
      process.exit(1)
    }
    
    const hotel = hotels.rows[0]
    console.log(`Found hotel: ${hotel.name} (${hotel.id})\n`)
    
    // Count products before
    const countBefore = await query('SELECT COUNT(*) as count FROM products WHERE hotel_id = $1', [hotel.id])
    console.log('Products before cleanup:', countBefore.rows[0].count)
    
    // Count batches before
    const batchesBefore = await query('SELECT COUNT(*) as count FROM batches WHERE hotel_id = $1', [hotel.id])
    console.log('Batches before cleanup:', batchesBefore.rows[0].count)
    
    if (countBefore.rows[0].count === '0' && batchesBefore.rows[0].count === '0') {
      console.log('\n⚠️ No products or batches to delete')
      process.exit(0)
    }
    
    // Delete batches first (foreign key constraint)
    const deletedBatches = await query('DELETE FROM batches WHERE hotel_id = $1 RETURNING id', [hotel.id])
    console.log('Deleted batches:', deletedBatches.rowCount)
    
    // Delete products
    const deletedProducts = await query('DELETE FROM products WHERE hotel_id = $1 RETURNING id', [hotel.id])
    console.log('Deleted products:', deletedProducts.rowCount)
    
    console.log(`\n✅ Cleanup complete for ${hotel.name}`)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

cleanup()
