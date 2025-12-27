/**
 * FreshTrack Export API
 * Экспорт данных в Excel формате
 */

import express from 'express'
import { db } from '../db/database.js'
import { authMiddleware, hotelIsolation } from '../middleware/auth.js'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)
router.use(hotelIsolation)

// Middleware для автоматического выбора отеля для SUPER_ADMIN
const requireHotelContext = (req, res, next) => {
  if (!req.hotelId) {
    if (req.user?.role === 'SUPER_ADMIN') {
      const firstHotel = db.prepare('SELECT id FROM hotels WHERE is_active = 1 LIMIT 1').get()
      if (firstHotel) {
        req.hotelId = firstHotel.id
        return next()
      }
    }
    return res.status(400).json({ error: 'Hotel context required' })
  }
  next()
}

router.use(requireHotelContext)

/**
 * Генерация Excel XML контента с правильными стилями
 */
const generateExcelXML = (data, columns, sheetName = 'Data') => {
  const escapeXml = (str) => {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // Функция для определения стиля ячейки статуса
  const getStatusStyle = (value) => {
    if (!value) return 'cell'
    const v = String(value).toLowerCase()
    if (v.includes('просроч') || v === 'expired') return 'danger'
    if (v.includes('критич') || v === 'critical') return 'critical'
    if (v.includes('внимани') || v === 'warning') return 'warning'
    if (v.includes('норм') || v === 'good' || v === 'ok') return 'success'
    return 'cell'
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Size="11" ss:FontName="Arial" ss:Color="#2D2D2D"/>
      <Interior ss:Color="#F5F0E8" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C4A35A"/>
      </Borders>
    </Style>
    <Style ss:ID="cell">
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E4DC"/>
      </Borders>
    </Style>
    <Style ss:ID="danger">
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#C4554D" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="warning">
      <Font ss:Color="#5C4813" ss:Bold="1"/>
      <Interior ss:Color="#FEF3CD" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="critical">
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#E67E22" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="success">
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#4A7C59" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>`

  // Ширина колонок
  columns.forEach(() => {
    xml += `<Column ss:AutoFitWidth="1" ss:Width="120"/>`
  })

  // Заголовки
  xml += `<Row ss:Height="25">`
  columns.forEach((col) => {
    xml += `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`
  })
  xml += `</Row>`

  // Данные
  if (data && data.length > 0) {
    data.forEach((row) => {
      xml += `<Row ss:Height="22">`
      columns.forEach((col) => {
        const value = row[col.key]
        const isStatusColumn = col.key === 'status' || col.isStatus
        const styleId = isStatusColumn ? getStatusStyle(value) : 'cell'
        
        if (value === null || value === undefined) {
          xml += `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">-</Data></Cell>`
        } else if (typeof value === 'number') {
          xml += `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${value}</Data></Cell>`
        } else {
          xml += `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`
        }
      })
      xml += `</Row>`
    })
  }

  xml += `</Table></Worksheet></Workbook>`
  return xml
}

/**
 * GET /api/export/inventory - Экспорт инвентаря
 */
router.get('/inventory', (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const batches = db.prepare(`
      SELECT 
        COALESCE(p.name, 'Неизвестный товар') as product_name,
        COALESCE(c.name, '-') as category_name,
        COALESCE(d.name, '-') as department_name,
        b.quantity,
        COALESCE(p.unit, 'шт') as unit,
        b.expiry_date,
        b.added_at as created_at,
        CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_left,
        CASE 
          WHEN julianday(b.expiry_date) < julianday('now') THEN 'Просрочено'
          WHEN CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) = 0 THEN 'Истекает сегодня'
          WHEN julianday(b.expiry_date) - julianday('now') <= 3 THEN 'Критично'
          WHEN julianday(b.expiry_date) - julianday('now') <= 7 THEN 'Внимание'
          ELSE 'В норме'
        END as status
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON b.department_id = d.id
      WHERE b.hotel_id = ? AND b.status = 'active'
      ORDER BY b.expiry_date ASC
    `).all(hotelId)

    const columns = [
      { key: 'product_name', header: 'Товар' },
      { key: 'category_name', header: 'Категория' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'unit', header: 'Единица' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'days_left', header: 'Дней осталось' },
      { key: 'status', header: 'Статус', isStatus: true }
    ]

    const excel = generateExcelXML(batches, columns, 'Инвентарь')
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-inventory-${new Date().toISOString().split('T')[0]}.xls"`)
    res.send(excel)
    
  } catch (error) {
    console.error('Error exporting inventory:', error)
    res.status(500).json({ error: 'Failed to export inventory' })
  }
})

/**
 * GET /api/export/batches - Экспорт всех партий
 */
router.get('/batches', (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const batches = db.prepare(`
      SELECT 
        b.id,
        COALESCE(p.name, 'Неизвестный товар') as product_name,
        COALESCE(c.name, '-') as category_name,
        COALESCE(d.name, '-') as department_name,
        b.quantity,
        COALESCE(p.unit, 'шт') as unit,
        b.expiry_date,
        CASE b.status
          WHEN 'active' THEN 'Активна'
          WHEN 'collected' THEN 'Собрана'
          ELSE COALESCE(b.status, '-')
        END as status,
        b.collected_at,
        b.added_at as created_at,
        COALESCE(u.name, '-') as created_by,
        COALESCE(uc.name, '-') as collected_by_name
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON b.department_id = d.id
      LEFT JOIN users u ON b.added_by = u.id
      LEFT JOIN users uc ON b.collected_by = uc.id
      WHERE b.hotel_id = ?
      ORDER BY b.added_at DESC
    `).all(hotelId)

    const columns = [
      { key: 'id', header: 'ID' },
      { key: 'product_name', header: 'Товар' },
      { key: 'category_name', header: 'Категория' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'unit', header: 'Единица' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'status', header: 'Статус' },
      { key: 'collected_at', header: 'Дата сбора' },
      { key: 'created_at', header: 'Добавлено' },
      { key: 'created_by', header: 'Добавил' },
      { key: 'collected_by_name', header: 'Собрал' }
    ]

    const excel = generateExcelXML(batches, columns, 'Все партии')
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-batches-${new Date().toISOString().split('T')[0]}.xls"`)
    res.send(excel)
    
  } catch (error) {
    console.error('Error exporting batches:', error)
    res.status(500).json({ error: 'Failed to export batches' })
  }
})

/**
 * GET /api/export/collections - Экспорт истории сборов
 */
router.get('/collections', (req, res) => {
  try {
    const hotelId = req.hotelId
    
    // Получаем данные из write_offs (правильная таблица для истории сборов)
    const collections = db.prepare(`
      SELECT 
        wo.written_off_at as date,
        wo.product_name,
        d.name as department_name,
        wo.quantity,
        b.expiry_date,
        CASE wo.reason
          WHEN 'expired' THEN 'Просрочено'
          WHEN 'kitchen' THEN 'Использовано на кухне'
          WHEN 'disposed' THEN 'Утилизировано'
          WHEN 'staff' THEN 'Выдано персоналу'
          WHEN 'returned' THEN 'Возврат поставщику'
          ELSE COALESCE(wo.reason, '-')
        END as reason,
        wo.comment,
        u.name as collected_by
      FROM write_offs wo
      LEFT JOIN batches b ON wo.batch_id = b.id
      LEFT JOIN departments d ON wo.department_id = d.id
      LEFT JOIN users u ON wo.written_off_by = u.id
      WHERE wo.hotel_id = ?
      ORDER BY wo.written_off_at DESC
    `).all(hotelId)

    const columns = [
      { key: 'date', header: 'Дата сбора' },
      { key: 'product_name', header: 'Товар' },
      { key: 'department_name', header: 'Отдел' },
      { key: 'quantity', header: 'Количество' },
      { key: 'expiry_date', header: 'Срок годности' },
      { key: 'reason', header: 'Причина' },
      { key: 'comment', header: 'Комментарий' },
      { key: 'collected_by', header: 'Собрал' }
    ]

    const excel = generateExcelXML(collections, columns, 'История сборов')
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-collections-${new Date().toISOString().split('T')[0]}.xls"`)
    res.send(excel)
    
  } catch (error) {
    console.error('Error exporting collections:', error)
    res.status(500).json({ error: 'Failed to export collections' })
  }
})

/**
 * GET /api/export/audit - Экспорт журнала действий
 */
router.get('/audit', (req, res) => {
  try {
    const hotelId = req.hotelId
    
    const logs = db.prepare(`
      SELECT 
        created_at as timestamp,
        user_name,
        action,
        entity_type,
        entity_id,
        details,
        ip_address
      FROM audit_logs
      WHERE hotel_id = ?
      ORDER BY created_at DESC
      LIMIT 10000
    `).all(hotelId)

    const columns = [
      { key: 'timestamp', header: 'Дата и время' },
      { key: 'user_name', header: 'Пользователь' },
      { key: 'action', header: 'Действие' },
      { key: 'entity_type', header: 'Тип объекта' },
      { key: 'entity_id', header: 'ID объекта' },
      { key: 'details', header: 'Подробности' },
      { key: 'ip_address', header: 'IP адрес' }
    ]

    const excel = generateExcelXML(logs, columns, 'Журнал действий')
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel')
    res.setHeader('Content-Disposition', `attachment; filename="freshtrack-audit-${new Date().toISOString().split('T')[0]}.xls"`)
    res.send(excel)
    
  } catch (error) {
    console.error('Error exporting audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

export default router
