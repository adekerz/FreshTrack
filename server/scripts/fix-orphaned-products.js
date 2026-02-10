// Скрипт для исправления orphaned products в Railway БД
import pg from 'pg'
const { Client } = pg

const connectionString = 'postgresql://postgres:AXhqksMysqzAJqCCOrhgwKtKIntqSrTk@turntable.proxy.rlwy.net:11180/railway'

async function fixOrphanedProducts() {
    const client = new Client({ connectionString })

    try {
        await client.connect()
        console.log('✅ Connected to Railway PostgreSQL')

        // 1. Найти все потерянные product_id
        console.log('\n📊 Step 1: Finding orphaned products...')
        const orphanedQuery = `
      SELECT DISTINCT 
        b.product_id,
        b.hotel_id,
        b.department_id,
        COUNT(b.id) as batches_count
      FROM batches b
      WHERE NOT EXISTS (
        SELECT 1 FROM products p WHERE p.id = b.product_id
      )
      GROUP BY b.product_id, b.hotel_id, b.department_id
    `
        const orphaned = await client.query(orphanedQuery)

        console.log(`Found ${orphaned.rows.length} orphaned product IDs:`)
        orphaned.rows.forEach(row => {
            console.log(`  - ${row.product_id} (${row.batches_count} batches)`)
        })

        if (orphaned.rows.length === 0) {
            console.log('\n✅ No orphaned products found! Database is clean.')
            return
        }

        // 2. Получить первую категорию для отеля
        console.log('\n📊 Step 2: Getting default category...')
        const categoryQuery = `
      SELECT id FROM categories 
      WHERE hotel_id = $1 
      LIMIT 1
    `
        const categoryResult = await client.query(categoryQuery, [orphaned.rows[0].hotel_id])
        const defaultCategoryId = categoryResult.rows[0]?.id

        if (!defaultCategoryId) {
            console.error('❌ No category found for hotel!')
            return
        }

        console.log(`Using category: ${defaultCategoryId}`)

        // 3. Создать недостающие продукты
        console.log('\n📊 Step 3: Creating missing products...')

        for (const orphan of orphaned.rows) {
            const productName = `Recovered Product ${orphan.product_id.substring(0, 8)}`

            const insertQuery = `
        INSERT INTO products (
          id, hotel_id, department_id, category_id, 
          name, name_en, unit, is_active, 
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $5, 'шт', true, 
          NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `

            await client.query(insertQuery, [
                orphan.product_id,
                orphan.hotel_id,
                orphan.department_id,
                defaultCategoryId,
                productName
            ])

            console.log(`  ✓ Created: ${productName}`)
        }

        // 4. Проверка результата
        console.log('\n📊 Step 4: Verifying results...')
        const verifyQuery = `
      SELECT COUNT(*) as count
      FROM batches b
      WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id)
    `
        const verify = await client.query(verifyQuery)

        if (verify.rows[0].count === '0') {
            console.log('\n✅ SUCCESS! All batches now have valid product references!')
        } else {
            console.log(`\n⚠️ WARNING: Still ${verify.rows[0].count} orphaned batches remaining`)
        }

        // 5. Проверить конкретные проблемные ID
        console.log('\n📊 Step 5: Checking specific IDs...')
        const checkIds = [
            'e29f626d-be5a-4258-97bf-91ce18ca618d',
            'd46d416e-7d01-4865-8423-e01a74034a88'
        ]

        for (const id of checkIds) {
            const checkQuery = `
        SELECT 
          EXISTS(SELECT 1 FROM products WHERE id = $1) as in_products,
          EXISTS(SELECT 1 FROM batches WHERE product_id = $1) as in_batches,
          (SELECT COUNT(*) FROM batches WHERE product_id = $1 AND status = 'active') as active_batches
      `
            const result = await client.query(checkQuery, [id])
            const { in_products, in_batches, active_batches } = result.rows[0]

            console.log(`\n  ID: ${id}`)
            console.log(`    In products table: ${in_products}`)
            console.log(`    In batches table: ${in_batches}`)
            console.log(`    Active batches: ${active_batches}`)
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message)
        throw error
    } finally {
        await client.end()
        console.log('\n📡 Disconnected from database')
    }
}

// Запуск
fixOrphanedProducts()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n💥 Migration failed:', error)
        process.exit(1)
    })
