/**
 * FreshTrack Import API
 * Импорт данных из Excel/CSV файлов
 */

import express from 'express'
import { db, logAudit } from '../db/database.js'
import { authMiddleware, hotelAdminOnly, hotelIsolation } from '../middleware/auth.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)
router.use(hotelAdminOnly)
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

// Настройка multer для загрузки файлов
const uploadsDir = path.join(process.cwd(), 'uploads', 'temp')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
      'application/csv'
    ]
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'))
    }
  }
})

/**
 * POST /api/import/batches - Импорт партий из Excel/CSV
 */
router.post('/batches', upload.single('file'), async (req, res) => {
  let filePath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }
    
    filePath = req.file.path
    
    // Динамический импорт xlsx (если установлен)
    let xlsx
    try {
      xlsx = (await import('xlsx')).default
    } catch (e) {
      // Если xlsx не установлен, пробуем простой CSV парсинг
      if (req.file.originalname.endsWith('.csv')) {
        return await handleCsvImport(filePath, req, res)
      }
      return res.status(500).json({ 
        success: false, 
        error: 'Excel support not installed. Use CSV format or install xlsx package.'
      })
    }
    
    // Читаем Excel файл
    const workbook = xlsx.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(sheet)
    
    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, error: 'File is empty or invalid format' })
    }
    
    
    let imported = 0
    const errors = []
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      try {
        // Ожидаемые колонки: name, category, quantity, expiry_date
        const name = row.name || row.Name || row.Название || row.product_name
        const category = row.category || row.Category || row.Категория || 'other'
        const quantity = parseInt(row.quantity || row.Quantity || row.Количество || 1)
        const expiryDate = row.expiry_date || row.ExpiryDate || row.expiry || row['Срок годности']
        
        if (!name) {
          errors.push(`Строка ${i + 2}: отсутствует название товара`)
          continue
        }
        
        if (!expiryDate) {
          errors.push(`Строка ${i + 2}: отсутствует срок годности`)
          continue
        }
        
        // Парсим дату
        let parsedDate = expiryDate
        if (typeof expiryDate === 'number') {
          // Excel serial date
          const date = new Date((expiryDate - 25569) * 86400 * 1000)
          parsedDate = date.toISOString().split('T')[0]
        } else if (typeof expiryDate === 'string') {
          // Пробуем разные форматы
          if (expiryDate.includes('/')) {
            const parts = expiryDate.split('/')
            if (parts.length === 3) {
              // MM/DD/YYYY или DD/MM/YYYY
              parsedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
            }
          } else if (expiryDate.includes('.')) {
            const parts = expiryDate.split('.')
            if (parts.length === 3) {
              // DD.MM.YYYY
              parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            }
          }
        }
        
        // Добавляем в базу
        db.prepare(`
          INSERT INTO products (name, category, department, quantity, expiry_date, created_by)
          VALUES (?, ?, 'honor-bar', ?, ?, ?)
        `).run(name, category, quantity, parsedDate, req.user.id)
        
        imported++
      } catch (err) {
        errors.push(`Строка ${i + 2}: ${err.message}`)
      }
    }
    
    // Логируем импорт
    logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'import',
      entity_type: 'batch',
      entity_id: null,
      details: { imported, errors: errors.length, filename: req.file.originalname },
      ip_address: req.ip
    })
    
    res.json({ 
      success: true, 
      message: `Импортировано ${imported} записей`,
      imported, 
      errors: errors.slice(0, 10) // Показываем только первые 10 ошибок
    })
    
  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ success: false, error: error.message })
  } finally {
    // Удаляем временный файл
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch (e) {
        console.error('Error deleting temp file:', e)
      }
    }
  }
})

// Обработка CSV без внешних библиотек
async function handleCsvImport(filePath, req, res) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return res.status(400).json({ success: false, error: 'CSV file is empty' })
    }
    
    // Первая строка - заголовки
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIdx = headers.findIndex(h => ['name', 'название', 'product_name'].includes(h))
    const categoryIdx = headers.findIndex(h => ['category', 'категория'].includes(h))
    const quantityIdx = headers.findIndex(h => ['quantity', 'количество'].includes(h))
    const expiryIdx = headers.findIndex(h => ['expiry_date', 'expiry', 'срок годности'].includes(h))
    
    if (nameIdx === -1 || expiryIdx === -1) {
      return res.status(400).json({ 
        success: false, 
        error: 'CSV must contain columns: name, expiry_date' 
      })
    }
    
    
    let imported = 0
    const errors = []
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        
        const name = values[nameIdx]
        const category = categoryIdx !== -1 ? values[categoryIdx] : 'other'
        const quantity = quantityIdx !== -1 ? parseInt(values[quantityIdx]) || 1 : 1
        const expiryDate = values[expiryIdx]
        
        if (!name || !expiryDate) continue
        
        db.prepare(`
          INSERT INTO products (name, category, department, quantity, expiry_date, created_by)
          VALUES (?, ?, 'honor-bar', ?, ?, ?)
        `).run(name, category, quantity, expiryDate, req.user.id)
        
        imported++
      } catch (err) {
        errors.push(`Строка ${i + 1}: ${err.message}`)
      }
    }
    
    res.json({ success: true, imported, errors: errors.slice(0, 10) })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export default router
