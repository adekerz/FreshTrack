/**
 * FreshTrack Custom Content API
 * CMS-lite для редактирования текстов и загрузки логотипа
 */

import express from 'express'
import { db } from '../db/database.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { authMiddleware, hotelAdminOnly } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Применяем authMiddleware ко всем маршрутам
router.use(authMiddleware)

// Настройка хранилища для загрузки файлов
const uploadsDir = path.join(__dirname, '../../public/uploads')

// Создаём папку uploads если её нет
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`
    cb(null, filename)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'))
    }
  }
})

let tableInitialized = false

// Ленивая инициализация таблиц
const ensureTable = () => {
  if (tableInitialized) return
  
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_texts (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
      )
    `)
    
    // Добавляем начальные тексты если их нет
    const count = db.prepare('SELECT COUNT(*) as count FROM custom_texts').get()
    if (count.count === 0) {
      const defaults = [
        ['app_name', 'FreshTrack'],
        ['app_tagline', 'Совершенство управления'],
        ['dashboard_title', 'Панель управления'],
        ['welcome_message', 'Добро пожаловать в FreshTrack'],
        ['company_name', 'Моя компания'],
        ['logo_url', '/default-logo.svg']
      ]
      
      const insertStmt = db.prepare('INSERT INTO custom_texts (key, value) VALUES (?, ?)')
      defaults.forEach(([key, value]) => insertStmt.run(key, value))
    }
    
    tableInitialized = true
    console.log('Таблица custom_texts готова')
  } catch (error) {
    console.log('Ошибка создания таблицы custom_texts:', error.message)
  }
}

// Middleware для инициализации таблиц
router.use((req, res, next) => {
  ensureTable()
  next()
})

/**
 * GET /api/custom-content - Получить все тексты
 */
router.get('/', (req, res) => {
  try {
    const texts = db.prepare(`
      SELECT key, value, updated_at as updatedAt
      FROM custom_texts
    `).all()
    
    // Преобразуем в объект
    const content = {}
    texts.forEach(t => {
      content[t.key] = t.value
    })
    
    res.json({ success: true, content })
  } catch (error) {
    console.error('Error fetching custom content:', error)
    res.status(500).json({ error: 'Failed to fetch content' })
  }
})

/**
 * GET /api/custom-content/:key - Получить конкретный текст
 */
router.get('/:key', (req, res) => {
  try {
    const { key } = req.params
    
    const text = db.prepare('SELECT value FROM custom_texts WHERE key = ?').get(key)
    
    res.json({ 
      success: true, 
      key, 
      value: text?.value || null 
    })
  } catch (error) {
    console.error('Error fetching custom content:', error)
    res.status(500).json({ error: 'Failed to fetch content' })
  }
})

/**
 * PUT /api/custom-content/:key - Обновить текст
 */
router.put('/:key', (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    const updatedBy = req.user?.id || null
    
    const existing = db.prepare('SELECT * FROM custom_texts WHERE key = ?').get(key)
    
    if (existing) {
      db.prepare(`
        UPDATE custom_texts 
        SET value = ?, updated_at = datetime('now'), updated_by = ?
        WHERE key = ?
      `).run(value, updatedBy, key)
    } else {
      db.prepare(`
        INSERT INTO custom_texts (key, value, updated_by)
        VALUES (?, ?, ?)
      `).run(key, value, updatedBy)
    }
    
    res.json({ success: true, message: 'Content updated' })
  } catch (error) {
    console.error('Error updating custom content:', error)
    res.status(500).json({ error: 'Failed to update content' })
  }
})

/**
 * PUT /api/custom-content - Обновить несколько текстов
 */
router.put('/', (req, res) => {
  try {
    const { content } = req.body
    const updatedBy = req.user?.id || null
    
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'Content object is required' })
    }
    
    const upsertStmt = db.prepare(`
      INSERT INTO custom_texts (key, value, updated_by)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `)
    
    Object.entries(content).forEach(([key, value]) => {
      upsertStmt.run(key, value, updatedBy)
    })
    
    res.json({ success: true, message: 'Content updated' })
  } catch (error) {
    console.error('Error updating custom content:', error)
    res.status(500).json({ error: 'Failed to update content' })
  }
})

/**
 * POST /api/custom-content/upload-logo - Загрузить логотип
 */
router.post('/upload-logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const logoUrl = `/uploads/${req.file.filename}`
    const updatedBy = req.user?.id || null
    
    // Получаем старый логотип для удаления
    const oldLogo = db.prepare('SELECT value FROM custom_texts WHERE key = ?').get('logo_url')
    
    // Обновляем URL логотипа в БД
    db.prepare(`
      INSERT INTO custom_texts (key, value, updated_by)
      VALUES ('logo_url', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `).run(logoUrl, updatedBy)
    
    // Удаляем старый файл если он не дефолтный
    if (oldLogo?.value && oldLogo.value.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '../../public', oldLogo.value)
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }
    
    res.json({ 
      success: true, 
      logoUrl,
      message: 'Logo uploaded successfully' 
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    res.status(500).json({ error: 'Failed to upload logo' })
  }
})

/**
 * DELETE /api/custom-content/logo - Удалить логотип (вернуть дефолтный)
 */
router.delete('/logo', (req, res) => {
  try {
    const updatedBy = req.user?.id || null
    
    // Получаем текущий логотип для удаления файла
    const currentLogo = db.prepare('SELECT value FROM custom_texts WHERE key = ?').get('logo_url')
    
    // Устанавливаем дефолтный логотип
    db.prepare(`
      UPDATE custom_texts 
      SET value = '/default-logo.svg', updated_at = datetime('now'), updated_by = ?
      WHERE key = 'logo_url'
    `).run(updatedBy)
    
    // Удаляем файл если он не дефолтный
    if (currentLogo?.value && currentLogo.value.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../public', currentLogo.value)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    
    res.json({ 
      success: true, 
      logoUrl: '/default-logo.svg',
      message: 'Logo reset to default' 
    })
  } catch (error) {
    console.error('Error deleting logo:', error)
    res.status(500).json({ error: 'Failed to delete logo' })
  }
})

export default router
