/**
 * Check database data
 */

import { query } from './postgres.js';

async function check() {
  try {
    const hotelId = 'e4696fdc-8643-401a-b2c6-881ac46c5509';

    // Проверим продукты
    const products = await query('SELECT id, name, category_id FROM products WHERE hotel_id = $1', [hotelId]);
    console.log('Products in DB:', products.rows.length);
    console.log('Sample:', products.rows.slice(0, 3));

    // Проверим категории
    const cats = await query('SELECT id, name, hotel_id FROM categories');
    console.log('\nCategories:');
    cats.rows.forEach(c => console.log(`  - ${c.name} (hotel_id: ${c.hotel_id})`));

    // Проверим связь
    const check = await query(`
      SELECT p.id, p.name, c.name as category 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      WHERE p.hotel_id = $1 
      LIMIT 5
    `, [hotelId]);
    console.log('\nProducts with categories:', check.rows);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
