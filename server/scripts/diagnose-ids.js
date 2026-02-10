// Диагностика конкретных ID в Railway БД
import pg from 'pg'
const { Client } = pg

const connectionString = 'postgresql://postgres:AXhqksMysqzAJqCCOrhgwKtKIntqSrTk@turntable.proxy.rlwy.net:11180/railway'

async function diagnoseProducts() {
    const client = new Client({ connectionString })

    try {
        await client.connect()
        console.log('✅ Connected to Railway PostgreSQL\n')

        const hotelId = '149761ea-ca0a-4dad-818a-2d97886e2523'
        const problemIds = [
            'e29f626d-be5a-4258-97bf-91ce18ca618d',
            'd46d416e-7d01-4865-8423-e01a74034a88'
        ]

        console.log('🔍 Checking problem IDs...\n')

        for (const productId of problemIds) {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
            console.log(`📦 Product ID: ${productId}`)
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

            // 1. Проверка в таблице products
            const productQuery = `
        SELECT id, name, department_id, category_id, is_active
        FROM products
        WHERE id = $1
      `
            const productRes = await client.query(productQuery, [productId])

            if (productRes.rows.length > 0) {
                console.log('\n✅ EXISTS in products table:')
                console.log(productRes.rows[0])
            } else {
                console.log('\n❌ NOT FOUND in products table!')
            }

            // 2. Проверка партий
            const batchesQuery = `
        SELECT 
          b.id,
          b.product_id,
          b.quantity,
          b.status,
          b.expiry_date,
          b.department_id,
          d.name as department_name
        FROM batches b
        LEFT JOIN departments d ON b.department_id = d.id
        WHERE b.product_id = $1 AND b.hotel_id = $2
        ORDER BY b.expiry_date ASC
      `
            const batchesRes = await client.query(batchesQuery, [productId, hotelId])

            console.log(`\n📊 Batches (${batchesRes.rows.length} total):`)

            if (batchesRes.rows.length === 0) {
                console.log('   ⚠️ No batches found for this product!')
            } else {
                batchesRes.rows.forEach((batch, idx) => {
                    console.log(`\n   Batch ${idx + 1}:`)
                    console.log(`     ID: ${batch.id}`)
                    console.log(`     Quantity: ${batch.quantity || 'NULL'}`)
                    console.log(`     Status: ${batch.status}`)
                    console.log(`     Expiry: ${batch.expiry_date}`)
                    console.log(`     Department: ${batch.department_name} (${batch.department_id})`)
                })
            }

            // 3. Активные партии (как в FIFO запросе)
            const activeQuery = `
        SELECT COUNT(*) as count
        FROM batches b
        WHERE b.product_id = $1 
          AND b.hotel_id = $2 
          AND b.status = 'active' 
          AND (b.quantity > 0 OR b.quantity IS NULL)
      `
            const activeRes = await client.query(activeQuery, [productId, hotelId])
            console.log(`\n⚡ Active batches (FIFO eligible): ${activeRes.rows[0].count}`)

            // 4. Проверка с фильтром по department (если NULL)
            const activeDeptQuery = `
        SELECT 
          b.id,
          b.quantity,
          b.status,
          b.department_id
        FROM batches b
        WHERE b.product_id = $1 
          AND b.hotel_id = $2 
          AND b.status = 'active' 
          AND (b.quantity > 0 OR b.quantity IS NULL)
      `
            const activeDeptRes = await client.query(activeDeptQuery, [productId, hotelId])

            if (activeDeptRes.rows.length > 0) {
                console.log('\n🔍 Active batches details:')
                activeDeptRes.rows.forEach(b => {
                    console.log(`   - Batch ${b.id.substring(0, 8)}...`)
                    console.log(`     Qty: ${b.quantity || 'NULL'}, ` +
                        `Status: ${b.status}, ` +
                        `Dept: ${b.department_id?.substring(0, 8) || 'NULL'}`)
                })
            }
        }

        // 5. Сравнение с работающим продуктом (Dirol)
        console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📊 Comparison with working product (Dirol)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        const dirolQuery = `
      SELECT 
        p.id,
        p.name,
        COUNT(b.id) as total_batches,
        SUM(CASE WHEN b.status = 'active' AND (b.quantity > 0 OR b.quantity IS NULL) THEN 1 ELSE 0 END) as active_batches
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.name ILIKE '%dirol%' AND p.hotel_id = $1
      GROUP BY p.id, p.name
    `
        const dirolRes = await client.query(dirolQuery, [hotelId])

        if (dirolRes.rows.length > 0) {
            console.log('\nDirol product:')
            console.log(dirolRes.rows[0])
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message)
        throw error
    } finally {
        await client.end()
        console.log('\n\n📡 Disconnected from database')
    }
}

diagnoseProducts()
    .then(() => {
        console.log('\n✅ Diagnosis completed!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Diagnosis failed:', error)
        process.exit(1)
    })
