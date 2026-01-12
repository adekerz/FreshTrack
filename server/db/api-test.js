// API Endpoints functional test
import { query } from './postgres.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const API_URL = 'http://localhost:3001/api'
const JWT_SECRET = process.env.JWT_SECRET || 'freshtrack-secret-key-2024'

async function testAPI() {
    console.log('\n🧪 API Functional Tests\n')
    console.log('='.repeat(50))

    try {
        // Get a valid token first
        const user = await query(`
      SELECT id, role, hotel_id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1
    `)

        if (user.rows.length === 0) {
            console.log('❌ No SUPER_ADMIN user found')
            process.exit(1)
        }

        const token = jwt.sign(
            { userId: user.rows[0].id, role: user.rows[0].role },
            JWT_SECRET,
            { expiresIn: '1h' }
        )

        const hotelId = 'e4696fdc-8643-401a-b2c6-881ac46c5509'

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }

        console.log('\n📡 Testing API Endpoints...\n')

        // Test 1: GET /api/health
        console.log('1️⃣ Health Check')
        let res = await fetch(`${API_URL}/health`)
        let data = await res.json()
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/health - ${res.status}`)

        // Test 2: GET /api/categories
        console.log('\n2️⃣ Categories')
        res = await fetch(`${API_URL}/categories?hotel_id=${hotelId}`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/categories - ${res.status}`)
        if (res.ok) {
            data = await res.json()
            console.log(`      Found: ${data.length || data.categories?.length || 0} categories`)
        }

        // Test 3: POST /api/categories
        const testCatName = `Test_${Date.now()}`
        res = await fetch(`${API_URL}/categories?hotel_id=${hotelId}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: testCatName, color: '#FF0000' })
        })
        console.log(`   ${res.ok ? '✅' : '❌'} POST /api/categories - ${res.status}`)
        let newCatId = null
        if (res.ok) {
            data = await res.json()
            newCatId = data.id
            console.log(`      Created: ${data.name} (${data.id})`)
        } else {
            const err = await res.json()
            console.log(`      Error: ${err.error}`)
        }

        // Test 4: DELETE /api/categories/:id
        if (newCatId) {
            res = await fetch(`${API_URL}/categories/${newCatId}?hotel_id=${hotelId}`, {
                method: 'DELETE',
                headers
            })
            console.log(`   ${res.ok ? '✅' : '❌'} DELETE /api/categories/${newCatId} - ${res.status}`)
        }

        // Test 5: GET /api/products
        console.log('\n3️⃣ Products')
        res = await fetch(`${API_URL}/products?hotel_id=${hotelId}`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/products - ${res.status}`)
        if (res.ok) {
            data = await res.json()
            console.log(`      Found: ${data.items?.length || data.products?.length || 0} products`)
        }

        // Test 6: GET /api/batches
        console.log('\n4️⃣ Batches')
        res = await fetch(`${API_URL}/batches?hotel_id=${hotelId}`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/batches - ${res.status}`)
        if (res.ok) {
            data = await res.json()
            console.log(`      Found: ${data.items?.length || data.length || 0} batches`)
        }

        // Test 7: GET /api/departments
        console.log('\n5️⃣ Departments')
        res = await fetch(`${API_URL}/departments?hotel_id=${hotelId}`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/departments - ${res.status}`)
        if (res.ok) {
            data = await res.json()
            console.log(`      Found: ${data.length || 0} departments`)
        }

        // Test 8: GET /api/hotels
        console.log('\n6️⃣ Hotels')
        res = await fetch(`${API_URL}/hotels`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/hotels - ${res.status}`)
        if (res.ok) {
            data = await res.json()
            console.log(`      Found: ${data.length || 0} hotels`)
        }

        // Test 9: Auth endpoints
        console.log('\n7️⃣ Auth')
        res = await fetch(`${API_URL}/auth/me`, { headers })
        console.log(`   ${res.ok ? '✅' : '❌'} GET /api/auth/me - ${res.status}`)

        // Summary
        console.log('\n' + '='.repeat(50))
        console.log('✅ API Tests Complete!')
        console.log('='.repeat(50) + '\n')

    } catch (error) {
        console.error('❌ Test error:', error.message)
    }

    process.exit(0)
}

testAPI()
