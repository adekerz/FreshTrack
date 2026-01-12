import { query } from './db/database.js'

const result = await query('SELECT id, name, warning_days, critical_days, enabled, hotel_id FROM notification_rules')
console.log('Notification Rules:', JSON.stringify(result.rows, null, 2))
process.exit(0)
