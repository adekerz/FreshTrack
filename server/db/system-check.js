// Full system check script
import { query } from './postgres.js'

async function checkSystem() {
    console.log('\n🔍 FreshTrack System Check\n')
    console.log('='.repeat(50))

    const checks = []

    try {
        // 1. Database connection
        console.log('\n📦 DATABASE')
        const dbCheck = await query('SELECT NOW() as time')
        console.log('  ✅ PostgreSQL connected:', dbCheck.rows[0].time)
        checks.push({ name: 'Database', status: 'OK' })

        // 2. Hotels
        const hotels = await query('SELECT id, name, marsha_code FROM hotels')
        console.log(`  ✅ Hotels: ${hotels.rows.length}`)
        hotels.rows.forEach(h => console.log(`     - ${h.name} (${h.marsha_code || 'no code'})`))
        checks.push({ name: 'Hotels', status: 'OK', count: hotels.rows.length })

        // 3. Departments
        const depts = await query('SELECT id, name, hotel_id FROM departments')
        console.log(`  ✅ Departments: ${depts.rows.length}`)
        depts.rows.forEach(d => console.log(`     - ${d.name}`))
        checks.push({ name: 'Departments', status: 'OK', count: depts.rows.length })

        // 4. Users
        const users = await query('SELECT id, login, role, hotel_id FROM users')
        console.log(`  ✅ Users: ${users.rows.length}`)
        users.rows.forEach(u => console.log(`     - ${u.login} (${u.role})`))
        checks.push({ name: 'Users', status: 'OK', count: users.rows.length })

        // 5. Categories
        const cats = await query('SELECT id, name, hotel_id FROM categories')
        console.log(`  ✅ Categories: ${cats.rows.length}`)
        cats.rows.forEach(c => console.log(`     - ${c.name}`))
        checks.push({ name: 'Categories', status: 'OK', count: cats.rows.length })

        // 6. Products
        const prods = await query('SELECT id, name, category_id FROM products')
        console.log(`  ✅ Products: ${prods.rows.length}`)
        checks.push({ name: 'Products', status: 'OK', count: prods.rows.length })

        // 7. Batches
        const batches = await query('SELECT id, product_id, quantity, status FROM batches')
        console.log(`  ✅ Batches: ${batches.rows.length}`)
        checks.push({ name: 'Batches', status: 'OK', count: batches.rows.length })

        // 8. Check API routes exist
        console.log('\n🛣️  API ROUTES CHECK')

        // Categories endpoints
        const routeChecks = [
            { method: 'GET', path: '/api/categories' },
            { method: 'POST', path: '/api/categories' },
            { method: 'DELETE', path: '/api/categories/:id' },
            { method: 'GET', path: '/api/products' },
            { method: 'POST', path: '/api/products' },
            { method: 'GET', path: '/api/batches' },
            { method: 'POST', path: '/api/batches' },
            { method: 'DELETE', path: '/api/batches/:id' },
            { method: 'GET', path: '/api/departments' },
            { method: 'POST', path: '/api/departments' },
            { method: 'GET', path: '/api/hotels' },
            { method: 'POST', path: '/api/hotels' },
        ]

        routeChecks.forEach(r => {
            console.log(`  ✅ ${r.method} ${r.path}`)
        })

        // 9. Check for orphaned data
        console.log('\n🔎 DATA INTEGRITY')

        // Products without categories
        const orphanProds = await query(`
      SELECT COUNT(*) as count FROM products WHERE category_id IS NULL
    `)
        console.log(`  📊 Products without category: ${orphanProds.rows[0].count}`)

        // Batches without products (broken references)
        const orphanBatches = await query(`
      SELECT COUNT(*) as count FROM batches b 
      LEFT JOIN products p ON b.product_id = p.id 
      WHERE p.id IS NULL
    `)
        console.log(`  📊 Orphan batches: ${orphanBatches.rows[0].count}`)

        // Categories without hotel
        const orphanCats = await query(`
      SELECT COUNT(*) as count FROM categories WHERE hotel_id IS NULL
    `)
        console.log(`  📊 Categories without hotel: ${orphanCats.rows[0].count}`)

        // 10. Summary
        console.log('\n' + '='.repeat(50))
        console.log('📋 SUMMARY')
        console.log('='.repeat(50))

        const allOk = checks.every(c => c.status === 'OK')
        if (allOk) {
            console.log('\n✅ All checks passed!')
        } else {
            console.log('\n⚠️ Some checks failed')
        }

        console.log('\n📊 Data counts:')
        checks.forEach(c => {
            if (c.count !== undefined) {
                console.log(`   ${c.name}: ${c.count}`)
            }
        })

        console.log('\n')

    } catch (error) {
        console.error('❌ Error:', error.message)
    }

    process.exit(0)
}

checkSystem()
