/**
 * Fix demo data dates
 */
import Database from 'better-sqlite3'

const db = new Database('./db/freshtrack.db')

// Обновляем даты на актуальные (2025 год)
db.exec(`
  UPDATE products SET expiry_date = '2025-12-12' WHERE expiry_date = '2024-12-12';
  UPDATE products SET expiry_date = '2025-12-15' WHERE expiry_date = '2024-12-15';
  UPDATE products SET expiry_date = '2025-12-20' WHERE expiry_date = '2024-12-20';
  UPDATE products SET expiry_date = '2025-12-25' WHERE expiry_date = '2024-12-25';
`)

console.log('✅ Dates updated!')

const products = db.prepare('SELECT name, expiry_date FROM products ORDER BY expiry_date').all()
products.forEach(p => console.log(p.name, p.expiry_date))
db.close()
