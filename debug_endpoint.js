// =============================================
// ВРЕМЕННЫЙ DEBUG ENDPOINT ДЛЯ ДИАГНОСТИКИ
// Добавьте в server/index.js или создайте отдельный файл
// =============================================

const express = require('express')
const { query } = require('./config/database')

// Добавьте этот роут ВРЕМЕННО для диагностики
app.get('/api/debug/products-check', async (req, res) => {
    try {
        const { hotel_id } = req.query

        if (!hotel_id) {
            return res.status(400).json({ error: 'hotel_id required' })
        }

        // 1. Все продукты из таблицы products
        const productsResult = await query(`
      SELECT id, name, department_id 
      FROM products 
      WHERE hotel_id = $1
      ORDER BY name
    `, [hotel_id])

        // 2. Все уникальные product_id из таблицы batches
        const batchProductsResult = await query(`
      SELECT DISTINCT b.product_id, 
             COUNT(b.id) as batches_count,
             MAX(p.name) as product_name
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      WHERE b.hotel_id = $1
      GROUP BY b.product_id
      ORDER BY product_name
    `, [hotel_id])

        // 3. Потерянные партии (product_id не существует в products)
        const orphanedBatches = await query(`
      SELECT b.id, b.product_id, b.quantity, b.status
      FROM batches b
      WHERE b.hotel_id = $1
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id)
    `, [hotel_id])

        // 4. Проверка конкретных ID
        const checkIds = [
            'e29f626d-be5a-4258-97bf-91ce18ca618d',
            'd46d416e-7d01-4865-8423-e01a74034a88'
        ]

        const idChecks = await Promise.all(checkIds.map(async (id) => {
            const inProducts = await query('SELECT COUNT(*) as count FROM products WHERE id = $1', [id])
            const inBatches = await query('SELECT COUNT(*) as count FROM batches WHERE product_id = $1', [id])

            return {
                id,
                existsInProducts: inProducts.rows[0].count > 0,
                existsInBatches: inBatches.rows[0].count > 0
            }
        }))

        res.json({
            success: true,
            data: {
                productsInProductsTable: productsResult.rows.length,
                uniqueProductsInBatches: batchProductsResult.rows.length,
                orphanedBatches: orphanedBatches.rows.length,
                products: productsResult.rows.slice(0, 10), // Первые 10
                batchProducts: batchProductsResult.rows.slice(0, 10),
                orphaned: orphanedBatches.rows,
                idChecks
            }
        })

    } catch (error) {
        console.error('Debug endpoint error:', error)
        res.status(500).json({ error: error.message })
    }
})

// ИСПОЛЬЗОВАНИЕ:
// GET /api/debug/products-check?hotel_id=149761ea-ca0a-4dad-818a-2d97886e2523
