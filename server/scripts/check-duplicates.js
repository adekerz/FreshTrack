
import pool, { query } from '../db/postgres.js';

async function checkDuplicates() {
    try {
        console.log('Checking for duplicate products...');

        // Find duplicates by name and hotel
        const duplicates = await query(`
      SELECT p.name, p.hotel_id, count(*) as count, array_agg(p.id) as ids
      FROM products p
      GROUP BY p.name, p.hotel_id
      HAVING count(*) > 1
    `);

        console.log(`Found ${duplicates.rows.length} sets of duplicates.`);

        for (const row of duplicates.rows) {
            console.log(`\nDuplicate Product: ${row.name} (Hotel: ${row.hotel_id})`);

            for (const id of row.ids) {
                // Get details and batch count for each duplicate
                const prodDetails = await query(`
          SELECT p.*, c.name as category_name, d.name as department_name,
                 (SELECT count(*) FROM batches b WHERE b.product_id = p.id AND b.status = 'active') as active_batches
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN departments d ON p.department_id = d.id
          WHERE p.id = $1
        `, [id]);

                const p = prodDetails.rows[0];
                console.log(`  - ID: ${p.id}`);
                console.log(`    Category: ${p.category_name}, Dept: ${p.department_name}`);
                console.log(`    Active Batches: ${p.active_batches}`);
                console.log(`    Created At: ${p.created_at}`);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkDuplicates();
