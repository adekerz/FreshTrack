/**
 * Seed Honor Bar products
 */

import { query } from './postgres.js';

async function seedHonorBar() {
  try {
    // 1. Переименуем департамент
    await query(`UPDATE departments SET name = 'Honor Bar' WHERE id = 'd618e09c-d010-413b-98c9-ab7365da78c5'`);
    console.log('✅ Department renamed to Honor Bar');

    // 2. Получим ID категорий
    const hotelId = 'e4696fdc-8643-401a-b2c6-881ac46c5509';

    const cats = await query('SELECT id, name FROM categories');
    const catMap = {};
    cats.rows.forEach(c => {
      if (c.name === 'Безалкогольные напитки') catMap.softDrinks = c.id;
      if (c.name === 'Алкогольные напитки') catMap.alcohol = c.id;
      if (c.name === 'Еда') catMap.food = c.id;
      if (c.name === 'Другое') catMap.other = c.id;
    });
    console.log('📂 Categories:', catMap);

    // 3. Удалим старые продукты
    await query('DELETE FROM products WHERE hotel_id = $1', [hotelId]);
    console.log('🗑️ Old products cleared');

    // 4. Добавим продукты Honor Bar
    const products = [
      // Soft Drinks
      { name: 'Pepsi', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Cola Original', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Cola Zero', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Fanta', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Sprite', category_id: catMap.softDrinks, unit: 'шт' },
      { name: '7 Up', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Mirinda', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Pago Apple', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Pago Orange', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Red Bull', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'San Pellegrino Sparkling', category_id: catMap.softDrinks, unit: 'шт' },
      { name: 'Acqua Panna Still', category_id: catMap.softDrinks, unit: 'шт' },
      // Alcohol Drinks
      { name: 'Budweiser', category_id: catMap.alcohol, unit: 'шт' },
      { name: 'Corona', category_id: catMap.alcohol, unit: 'шт' },
      // Food
      { name: 'Kazakhstan Chocolate', category_id: catMap.food, unit: 'шт' },
      { name: 'Snickers', category_id: catMap.food, unit: 'шт' },
      { name: 'Mars', category_id: catMap.food, unit: 'шт' },
      { name: 'Chewing Gum', category_id: catMap.food, unit: 'шт' },
      { name: 'Ritter Sport', category_id: catMap.food, unit: 'шт' },
      { name: 'Pistachio', category_id: catMap.food, unit: 'шт' },
      { name: 'Cashew', category_id: catMap.food, unit: 'шт' },
      { name: 'Chocolate Peanuts', category_id: catMap.food, unit: 'шт' },
      { name: 'Gummy Bear', category_id: catMap.food, unit: 'шт' },
      { name: 'Potato Chips', category_id: catMap.food, unit: 'шт' },
      { name: 'Fruit Chips', category_id: catMap.food, unit: 'шт' },
      // Other
      { name: 'Feminine Pack', category_id: catMap.other, unit: 'шт' }
    ];

    for (const p of products) {
      await query(
        'INSERT INTO products (name, category_id, hotel_id, unit, default_shelf_life) VALUES ($1, $2, $3, $4, 365)',
        [p.name, p.category_id, hotelId, p.unit]
      );
    }
    console.log(`✅ Added ${products.length} products for Honor Bar`);
    
    // Проверим результат
    const count = await query('SELECT COUNT(*) FROM products WHERE hotel_id = $1', [hotelId]);
    console.log(`📊 Total products in database: ${count.rows[0].count}`);

    console.log('\n🎉 Honor Bar seed completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedHonorBar();
