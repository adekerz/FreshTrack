// Check products table structure
import { query } from './postgres.js'

async function check() {
    try {
        const cols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `)

        console.log('Products columns:', cols.rows.map(x => x.column_name).join(', '))

        const existingCols = cols.rows.map(x => x.column_name)

        // Add missing columns
        const columnsToAdd = [
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
            { name: 'description', type: 'TEXT' },
            { name: 'storage_type', type: 'VARCHAR(50)' },
            { name: 'min_stock', type: 'INTEGER DEFAULT 0' },
            { name: 'image_url', type: 'TEXT' }
        ]

        for (const col of columnsToAdd) {
            if (!existingCols.includes(col.name)) {
                console.log(`Adding ${col.name} column...`)
                await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`)
            }
        }

        // Final check
        const finalCols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `)
        console.log('Final columns:', finalCols.rows.map(x => x.column_name).join(', '))

        console.log('✅ Done')
        process.exit(0)
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

check()
