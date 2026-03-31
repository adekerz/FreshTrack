/**
 * Demo seed script for director presentations
 * Creates a full hotel with realistic mock data:
 * - 1 hotel (Grand Hotel Kazakhstan)
 * - 4 departments
 * - 4 users (hotel admin, 2 managers, 1 staff)
 * - Products with batches across all expiry statuses
 * - Notifications, tasks
 *
 * Run: node server/db/seed-demo.js
 */

import { query, getClient } from './postgres.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const TODAY = new Date()
const daysFromNow = (d) => {
  const dt = new Date(TODAY)
  dt.setDate(dt.getDate() + d)
  return dt.toISOString().split('T')[0]
}

async function seedDemo() {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    // ─── Check if demo data exists ───────────────────────────────
    const existing = await client.query(
      'SELECT id FROM hotels WHERE marsha_code = $1',
      ['ALMGH']
    )
    if (existing.rows.length > 0) {
      console.log('⚠️  Demo hotel already exists (ALMGH). Skipping.')
      console.log(
        "   To re-create: DELETE FROM hotels WHERE marsha_code = 'ALMGH'"
      )
      await client.query('ROLLBACK')
      process.exit(0)
    }

    console.log('🏨 Creating demo hotel: Grand Hotel Kazakhstan...')

    // ─── 1. Hotel ─────────────────────────────────────────────────
    const hotelId = uuidv4()
    await client.query(
      `
      INSERT INTO hotels (id, name, marsha_code, city, country, timezone)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        hotelId,
        'Grand Hotel Kazakhstan',
        'ALMGH',
        'Almaty',
        'Kazakhstan',
        'Asia/Almaty',
      ]
    )
    console.log('✅ Hotel created')

    // ─── 2. Departments ───────────────────────────────────────────
    const depts = [
      {
        id: uuidv4(),
        name: 'Honor Bar',
        name_en: 'Honor Bar',
        name_kk: 'Honor Bar',
        type: 'minibar',
        color: '#FF8D6B',
        icon: 'wine',
      },
      {
        id: uuidv4(),
        name: 'Ресторан',
        name_en: 'Restaurant',
        name_kk: 'Мейрамхана',
        type: 'restaurant',
        color: '#4A90D9',
        icon: 'utensils',
      },
      {
        id: uuidv4(),
        name: 'Бар',
        name_en: 'Bar',
        name_kk: 'Бар',
        type: 'bar',
        color: '#722F37',
        icon: 'cocktail',
      },
      {
        id: uuidv4(),
        name: 'Конференц-зал',
        name_en: 'Conference Hall',
        name_kk: 'Конференц зал',
        type: 'other',
        color: '#6B7280',
        icon: 'building',
      },
    ]
    for (const d of depts) {
      await client.query(
        `
        INSERT INTO departments (id, hotel_id, name, name_en, name_kk, type, color, icon)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [d.id, hotelId, d.name, d.name_en, d.name_kk, d.type, d.color, d.icon]
      )
    }
    const [honorBarDept, restaurantDept, barDept] = depts
    console.log('✅ Departments created (4)')

    // ─── 3. Users ─────────────────────────────────────────────────
    const pwHash = (pw) => bcrypt.hashSync(pw, 10)
    const demoAdminId = uuidv4()
    const demoManagerId = uuidv4()
    const demoManager2Id = uuidv4()
    const demoStaffId = uuidv4()

    await client.query(
      `
      INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        demoAdminId,
        'demo_admin',
        pwHash('Demo123!'),
        'Арман Бекенов',
        'HOTEL_ADMIN',
        hotelId,
        null,
        true,
      ]
    )

    await client.query(
      `
      INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        demoManagerId,
        'demo_manager',
        pwHash('Demo123!'),
        'Айгерим Сейткали',
        'DEPARTMENT_MANAGER',
        hotelId,
        honorBarDept.id,
        true,
      ]
    )

    await client.query(
      `
      INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        demoManager2Id,
        'demo_manager2',
        pwHash('Demo123!'),
        'Нурлан Сматов',
        'DEPARTMENT_MANAGER',
        hotelId,
        restaurantDept.id,
        true,
      ]
    )

    await client.query(
      `
      INSERT INTO users (id, login, password, name, role, hotel_id, department_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        demoStaffId,
        'demo_staff',
        pwHash('Demo123!'),
        'Диана Юсупова',
        'STAFF',
        hotelId,
        honorBarDept.id,
        true,
      ]
    )

    console.log('✅ Users created (4)')

    // ─── 4. Categories ────────────────────────────────────────────
    const categories = [
      {
        id: uuidv4(),
        name: 'Безалкогольные напитки',
        name_en: 'Soft Drinks',
        name_kk: 'Алкогольсіз сусындар',
        color: '#4A90D9',
        icon: 'cup',
      },
      {
        id: uuidv4(),
        name: 'Алкогольные напитки',
        name_en: 'Alcohol',
        name_kk: 'Алкоголь',
        color: '#722F37',
        icon: 'wine',
      },
      {
        id: uuidv4(),
        name: 'Еда',
        name_en: 'Food',
        name_kk: 'Тағам',
        color: '#8B4513',
        icon: 'cookie',
      },
      {
        id: uuidv4(),
        name: 'Другое',
        name_en: 'Other',
        name_kk: 'Басқа',
        color: '#6B7280',
        icon: 'package',
      },
    ]
    const catMap = {}
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i]
      await client.query(
        `
        INSERT INTO categories (id, hotel_id, name, name_en, name_kk, color, icon, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [c.id, hotelId, c.name, c.name_en, c.name_kk, c.color, c.icon, i]
      )
      catMap[c.name_en] = c.id
    }
    console.log('✅ Categories created (4)')

    // ─── 5. Products ──────────────────────────────────────────────
    const productsData = [
      // Soft Drinks
      {
        name: 'Pepsi Cola',
        name_en: 'Pepsi Cola',
        cat: 'Soft Drinks',
        shelf: 180,
      },
      {
        name: 'Coca-Cola Original',
        name_en: 'Coca-Cola Original',
        cat: 'Soft Drinks',
        shelf: 180,
      },
      {
        name: 'Coca-Cola Zero',
        name_en: 'Coca-Cola Zero',
        cat: 'Soft Drinks',
        shelf: 180,
      },
      { name: 'Sprite', name_en: 'Sprite', cat: 'Soft Drinks', shelf: 180 },
      {
        name: 'Fanta Orange',
        name_en: 'Fanta Orange',
        cat: 'Soft Drinks',
        shelf: 180,
      },
      {
        name: 'Red Bull Energy',
        name_en: 'Red Bull Energy',
        cat: 'Soft Drinks',
        shelf: 365,
      },
      {
        name: 'San Pellegrino',
        name_en: 'San Pellegrino',
        cat: 'Soft Drinks',
        shelf: 730,
      },
      {
        name: 'Acqua Panna',
        name_en: 'Acqua Panna',
        cat: 'Soft Drinks',
        shelf: 730,
      },
      {
        name: 'Pago Apple Juice',
        name_en: 'Pago Apple Juice',
        cat: 'Soft Drinks',
        shelf: 365,
      },
      {
        name: 'Pago Orange Juice',
        name_en: 'Pago Orange Juice',
        cat: 'Soft Drinks',
        shelf: 365,
      },
      // Alcohol
      {
        name: 'Budweiser Beer',
        name_en: 'Budweiser Beer',
        cat: 'Alcohol',
        shelf: 180,
      },
      {
        name: 'Corona Extra',
        name_en: 'Corona Extra',
        cat: 'Alcohol',
        shelf: 180,
      },
      { name: 'Heineken', name_en: 'Heineken', cat: 'Alcohol', shelf: 180 },
      {
        name: 'Absolut Vodka Mini',
        name_en: 'Absolut Vodka Mini',
        cat: 'Alcohol',
        shelf: 1095,
      },
      {
        name: 'Jack Daniels Mini',
        name_en: 'Jack Daniels Mini',
        cat: 'Alcohol',
        shelf: 1095,
      },
      {
        name: 'Baileys Mini',
        name_en: 'Baileys Mini',
        cat: 'Alcohol',
        shelf: 365,
      },
      // Food
      { name: 'Snickers', name_en: 'Snickers', cat: 'Food', shelf: 365 },
      { name: 'Mars', name_en: 'Mars', cat: 'Food', shelf: 365 },
      { name: 'Twix', name_en: 'Twix', cat: 'Food', shelf: 365 },
      {
        name: 'Ritter Sport Milk',
        name_en: 'Ritter Sport Milk',
        cat: 'Food',
        shelf: 365,
      },
      {
        name: 'Pringles Original',
        name_en: 'Pringles Original',
        cat: 'Food',
        shelf: 90,
      },
      { name: 'Mixed Nuts', name_en: 'Mixed Nuts', cat: 'Food', shelf: 180 },
      { name: 'Gummy Bears', name_en: 'Gummy Bears', cat: 'Food', shelf: 365 },
      { name: "Lay's Chips", name_en: "Lay's Chips", cat: 'Food', shelf: 90 },
      // Other
      {
        name: 'Feminine Hygiene Kit',
        name_en: 'Feminine Hygiene Kit',
        cat: 'Other',
        shelf: 1095,
      },
      {
        name: 'Condoms (3 pcs)',
        name_en: 'Condoms (3 pcs)',
        cat: 'Other',
        shelf: 1095,
      },
    ]

    const productIds = {}
    for (const p of productsData) {
      const id = uuidv4()
      await client.query(
        `
        INSERT INTO products (id, hotel_id, category_id, name, name_en, default_shelf_life, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [id, hotelId, catMap[p.cat], p.name, p.name_en, p.shelf, 'шт']
      )
      productIds[p.name_en] = id
    }
    console.log('✅ Products created (26)')

    // ─── 6. Batches (Honor Bar) ───────────────────────────────────
    // Mix of all statuses: expired, critical, warning, good
    const honorBarBatches = [
      // EXPIRED (overdue)
      {
        prod: 'Pringles Original',
        qty: 3,
        expiry: daysFromNow(-5),
        label: 'LOT-2025-001',
      },
      {
        prod: "Lay's Chips",
        qty: 2,
        expiry: daysFromNow(-2),
        label: 'LOT-2025-002',
      },
      {
        prod: 'Gummy Bears',
        qty: 4,
        expiry: daysFromNow(-1),
        label: 'LOT-2025-003',
      },
      // CRITICAL (1-3 days)
      {
        prod: 'Budweiser Beer',
        qty: 6,
        expiry: daysFromNow(1),
        label: 'LOT-2026-001',
      },
      {
        prod: 'Corona Extra',
        qty: 4,
        expiry: daysFromNow(2),
        label: 'LOT-2026-002',
      },
      {
        prod: 'Pago Apple Juice',
        qty: 5,
        expiry: daysFromNow(3),
        label: 'LOT-2026-003',
      },
      // WARNING (4-7 days)
      {
        prod: 'Pepsi Cola',
        qty: 12,
        expiry: daysFromNow(4),
        label: 'LOT-2026-004',
      },
      {
        prod: 'Fanta Orange',
        qty: 8,
        expiry: daysFromNow(5),
        label: 'LOT-2026-005',
      },
      { prod: 'Mars', qty: 10, expiry: daysFromNow(6), label: 'LOT-2026-006' },
      {
        prod: 'Pago Orange Juice',
        qty: 6,
        expiry: daysFromNow(7),
        label: 'LOT-2026-007',
      },
      // GOOD (>7 days)
      {
        prod: 'Coca-Cola Original',
        qty: 24,
        expiry: daysFromNow(30),
        label: 'LOT-2026-008',
      },
      {
        prod: 'Coca-Cola Zero',
        qty: 18,
        expiry: daysFromNow(45),
        label: 'LOT-2026-009',
      },
      {
        prod: 'Sprite',
        qty: 20,
        expiry: daysFromNow(60),
        label: 'LOT-2026-010',
      },
      {
        prod: 'Red Bull Energy',
        qty: 15,
        expiry: daysFromNow(90),
        label: 'LOT-2026-011',
      },
      {
        prod: 'San Pellegrino',
        qty: 30,
        expiry: daysFromNow(120),
        label: 'LOT-2026-012',
      },
      {
        prod: 'Acqua Panna',
        qty: 24,
        expiry: daysFromNow(150),
        label: 'LOT-2026-013',
      },
      {
        prod: 'Snickers',
        qty: 20,
        expiry: daysFromNow(60),
        label: 'LOT-2026-014',
      },
      { prod: 'Twix', qty: 18, expiry: daysFromNow(90), label: 'LOT-2026-015' },
      {
        prod: 'Ritter Sport Milk',
        qty: 12,
        expiry: daysFromNow(120),
        label: 'LOT-2026-016',
      },
      {
        prod: 'Mixed Nuts',
        qty: 10,
        expiry: daysFromNow(60),
        label: 'LOT-2026-017',
      },
      {
        prod: 'Heineken',
        qty: 8,
        expiry: daysFromNow(90),
        label: 'LOT-2026-018',
      },
      {
        prod: 'Absolut Vodka Mini',
        qty: 6,
        expiry: daysFromNow(365),
        label: 'LOT-2026-019',
      },
      {
        prod: 'Jack Daniels Mini',
        qty: 6,
        expiry: daysFromNow(365),
        label: 'LOT-2026-020',
      },
      {
        prod: 'Baileys Mini',
        qty: 4,
        expiry: daysFromNow(120),
        label: 'LOT-2026-021',
      },
      {
        prod: 'Feminine Hygiene Kit',
        qty: 5,
        expiry: daysFromNow(365),
        label: 'LOT-2026-022',
      },
      {
        prod: 'Condoms (3 pcs)',
        qty: 10,
        expiry: daysFromNow(730),
        label: 'LOT-2026-023',
      },
    ]

    for (const b of honorBarBatches) {
      const pid = productIds[b.prod]
      if (!pid) {
        console.warn(`  ⚠️ Product not found: ${b.prod}`)
        continue
      }
      await client.query(
        `
        INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          uuidv4(),
          hotelId,
          honorBarDept.id,
          pid,
          b.qty,
          b.expiry,
          b.label,
          demoStaffId,
        ]
      )
    }
    console.log('✅ Honor Bar batches created (26)')

    // ─── 7. Batches (Restaurant) ──────────────────────────────────
    const restaurantBatches = [
      {
        prod: 'Coca-Cola Original',
        qty: 48,
        expiry: daysFromNow(20),
        label: 'REST-001',
      },
      {
        prod: 'Pepsi Cola',
        qty: 36,
        expiry: daysFromNow(15),
        label: 'REST-002',
      },
      {
        prod: 'San Pellegrino',
        qty: 60,
        expiry: daysFromNow(180),
        label: 'REST-003',
      },
      {
        prod: 'Pringles Original',
        qty: 24,
        expiry: daysFromNow(2),
        label: 'REST-004',
      }, // critical
      {
        prod: 'Mixed Nuts',
        qty: 20,
        expiry: daysFromNow(-3),
        label: 'REST-005',
      }, // expired
    ]
    for (const b of restaurantBatches) {
      const pid = productIds[b.prod]
      if (!pid) continue
      await client.query(
        `
        INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          uuidv4(),
          hotelId,
          restaurantDept.id,
          pid,
          b.qty,
          b.expiry,
          b.label,
          demoManager2Id,
        ]
      )
    }
    console.log('✅ Restaurant batches created (5)')

    // ─── 8. Batches (Bar) ─────────────────────────────────────────
    const barBatches = [
      { prod: 'Heineken', qty: 24, expiry: daysFromNow(60), label: 'BAR-001' },
      {
        prod: 'Corona Extra',
        qty: 18,
        expiry: daysFromNow(3),
        label: 'BAR-002',
      }, // critical
      {
        prod: 'Absolut Vodka Mini',
        qty: 12,
        expiry: daysFromNow(365),
        label: 'BAR-003',
      },
      {
        prod: 'Baileys Mini',
        qty: 6,
        expiry: daysFromNow(6),
        label: 'BAR-004',
      }, // warning
    ]
    for (const b of barBatches) {
      const pid = productIds[b.prod]
      if (!pid) continue
      await client.query(
        `
        INSERT INTO batches (id, hotel_id, department_id, product_id, quantity, expiry_date, batch_number, added_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          uuidv4(),
          hotelId,
          barDept.id,
          pid,
          b.qty,
          b.expiry,
          b.label,
          demoAdminId,
        ]
      )
    }
    console.log('✅ Bar batches created (4)')

    // ─── 9. Settings ─────────────────────────────────────────────
    const settings = [
      { key: 'warning_days', value: 7 },
      { key: 'critical_days', value: 3 },
      { key: 'notification_time', value: '09:00' },
      { key: 'telegram_enabled', value: false },
      { key: 'language', value: 'ru' },
    ]
    for (const s of settings) {
      await client.query(
        `
        INSERT INTO settings (id, hotel_id, key, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (hotel_id, key) DO NOTHING
      `,
        [uuidv4(), hotelId, s.key, JSON.stringify(s.value)]
      )
    }
    console.log('✅ Settings created')

    // ─── 10. Task board + tasks ───────────────────────────────────
    // Check if task_boards table exists
    const hasTaskBoards = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_name = 'task_boards'
    `)

    if (hasTaskBoards.rows.length > 0) {
      const boardId = uuidv4()
      await client.query(
        `
        INSERT INTO task_boards (id, hotel_id, department_id, name, description, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          boardId,
          hotelId,
          honorBarDept.id,
          'Honor Bar — задачи',
          'Операционные задачи отдела',
          demoManagerId,
        ]
      )

      // Buckets
      const buckets = [
        {
          id: uuidv4(),
          name: 'К выполнению',
          color: '#6B7280',
          pos: 0,
          is_default: true,
        },
        { id: uuidv4(), name: 'В работе', color: '#4A90D9', pos: 1 },
        {
          id: uuidv4(),
          name: 'Готово',
          color: '#22C55E',
          pos: 2,
          is_completed: true,
        },
      ]
      for (const bk of buckets) {
        await client.query(
          `
          INSERT INTO task_buckets (id, board_id, name, color, position, is_default, is_completed_bucket)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            bk.id,
            boardId,
            bk.name,
            bk.color,
            bk.pos,
            bk.is_default || false,
            bk.is_completed || false,
          ]
        )
      }

      const [todoBucket, inProgressBucket, doneBucket] = buckets

      // Tasks
      const tasks = [
        {
          bucket: todoBucket.id,
          title: 'Списать просроченные чипсы Pringles',
          desc: '3 упаковки с истёкшим сроком годности (LOT-2025-001)',
          priority: 'high',
          assignee: demoStaffId,
        },
        {
          bucket: todoBucket.id,
          title: "Проверить партию Lay's и Gummy Bears",
          desc: 'Истёк срок годности, необходимо списание',
          priority: 'high',
          assignee: demoStaffId,
        },
        {
          bucket: todoBucket.id,
          title: 'Пополнить запасы Pepsi Cola',
          desc: 'Текущий запас: 12 шт, истекает через 4 дня',
          priority: 'medium',
          assignee: null,
        },
        {
          bucket: inProgressBucket.id,
          title: 'Провести инвентаризацию Honor Bar',
          desc: 'Ежемесячная проверка всех позиций',
          priority: 'medium',
          assignee: demoManagerId,
        },
        {
          bucket: inProgressBucket.id,
          title: 'Обновить ценники на алкогольные позиции',
          desc: 'Новые цены с 1 апреля',
          priority: 'low',
          assignee: demoStaffId,
        },
        {
          bucket: doneBucket.id,
          title: 'Приёмка товара от поставщика',
          desc: 'Получено 80 позиций, всё соответствует заказу',
          priority: 'medium',
          assignee: demoManagerId,
        },
        {
          bucket: doneBucket.id,
          title: 'Обучение нового сотрудника',
          desc: 'Диана Юсупова прошла обучение по системе FreshTrack',
          priority: 'low',
          assignee: demoManagerId,
        },
      ]
      for (let i = 0; i < tasks.length; i++) {
        const tk = tasks[i]
        await client.query(
          `
          INSERT INTO tasks (id, board_id, bucket_id, title, description, priority, position, created_by, assigned_to)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
          [
            uuidv4(),
            boardId,
            tk.bucket,
            tk.title,
            tk.desc,
            tk.priority,
            i,
            demoManagerId,
            tk.assignee,
          ]
        )
      }
      console.log('✅ Task board + 7 tasks created')
    } else {
      console.log('⚠️  Skipping tasks (task_boards table not found)')
    }

    await client.query('COMMIT')

    console.log(
      '\n┌──────────────────────────────────────────────────────────────┐'
    )
    console.log(
      '│  🏨 DEMO: GRAND HOTEL KAZAKHSTAN (ALMGH)                     │'
    )
    console.log(
      '├──────────────────────────────────────────────────────────────┤'
    )
    console.log(
      '│  DEPARTMENTS: Honor Bar, Ресторан, Бар, Конференц-зал        │'
    )
    console.log(
      '│  PRODUCTS: 26 • BATCHES: 35 total                           │'
    )
    console.log(
      '│    🔴 Expired: 4  🟠 Critical: 5  🟡 Warning: 4  🟢 Good: 22 │'
    )
    console.log(
      '├──────────────────────────────────────────────────────────────┤'
    )
    console.log(
      '│  USERS:                                                      │'
    )
    console.log(
      '│  demo_admin    / Demo123!  (HOTEL_ADMIN)                     │'
    )
    console.log(
      '│  demo_manager  / Demo123!  (DEPARTMENT_MANAGER, Honor Bar)   │'
    )
    console.log(
      '│  demo_manager2 / Demo123!  (DEPARTMENT_MANAGER, Ресторан)    │'
    )
    console.log(
      '│  demo_staff    / Demo123!  (STAFF, Honor Bar)                │'
    )
    console.log(
      '└──────────────────────────────────────────────────────────────┘'
    )
    console.log()
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
    process.exit(1)
  } finally {
    client.release()
    process.exit(0)
  }
}

seedDemo()
