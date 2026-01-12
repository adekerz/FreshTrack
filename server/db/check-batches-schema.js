/**
 * Проверка схемы таблицы batches
 */
import { query } from './postgres.js'

async function checkSchema() {
    try {
        const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'batches' 
      ORDER BY ordinal_position
    `)

        console.log('Batches table schema:')
        console.table(result.rows)

    } catch (error) {
        console.error('Error:', error.message)
    } finally {
        process.exit(0)
    }
}

checkSchema()
