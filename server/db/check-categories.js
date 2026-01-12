// Check and fix categories table structure
import { query } from './postgres.js'

async function checkAndFix() {
  try {
    // Get current columns
    const cols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
      ORDER BY ordinal_position
    `)
    
    console.log('Current columns:', cols.rows.map(x => x.column_name).join(', '))
    
    const existingCols = cols.rows.map(x => x.column_name)
    
    // Check and add missing columns
    const missingCols = []
    
    if (!existingCols.includes('description')) {
      missingCols.push(`ADD COLUMN description TEXT`)
    }
    if (!existingCols.includes('color')) {
      missingCols.push(`ADD COLUMN color VARCHAR(7)`)
    }
    if (!existingCols.includes('icon')) {
      missingCols.push(`ADD COLUMN icon VARCHAR(50)`)
    }
    if (!existingCols.includes('parent_id')) {
      missingCols.push(`ADD COLUMN parent_id INTEGER`)
    }
    if (!existingCols.includes('sort_order')) {
      missingCols.push(`ADD COLUMN sort_order INTEGER DEFAULT 0`)
    }
    
    if (missingCols.length > 0) {
      console.log('\nAdding missing columns...')
      for (const col of missingCols) {
        console.log('  -', col)
        await query(`ALTER TABLE categories ${col}`)
      }
      console.log('\n✅ Columns added successfully!')
    } else {
      console.log('\n✅ All columns exist, no changes needed')
    }
    
    // Verify
    const verify = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
      ORDER BY ordinal_position
    `)
    console.log('\nFinal columns:', verify.rows.map(x => x.column_name).join(', '))
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkAndFix()
