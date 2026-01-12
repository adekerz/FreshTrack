import { query } from './db/postgres.js';

async function checkBatches() {
    try {
        const hotels = await query('SELECT id FROM hotels LIMIT 1');
        if (hotels.rows.length === 0) {
            console.log('No hotels found');
            return;
        }
        const hotelId = hotels.rows[0].id;
        console.log('HotelId:', hotelId);

        const batches = await query(`
      SELECT b.id, b.status, b.quantity, p.name as product_name
      FROM batches b 
      JOIN products p ON b.product_id = p.id 
      WHERE b.hotel_id = $1
    `, [hotelId]);

        console.log('Batches found:', batches.rows.length);
        batches.rows.forEach(b => console.log(`  - ${b.product_name} (qty: ${b.quantity}, status: ${b.status})`));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkBatches();