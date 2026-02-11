/**
 * Scheduled Exports Controller
 * API endpoints for managing scheduled export configurations
 */

import express from 'express'
import { validate, CreateScheduledExportSchema, UpdateScheduledExportSchema } from './scheduled-exports.schemas.js'
import { query } from '../../db/postgres.js'
import { logError, logInfo } from '../../utils/logger.js'
import { authMiddleware, hotelIsolation, allowRoles } from '../../middleware/auth.js'

const router = express.Router()

/** Кэш имени колонки времени в БД (send_time или "time") — на случай старой схемы */
let timeColumnNameCache = null

async function getTimeColumnName() {
  if (timeColumnNameCache) return timeColumnNameCache
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'scheduled_exports'
     AND column_name IN ('time', 'send_time')
     ORDER BY CASE column_name WHEN 'send_time' THEN 0 ELSE 1 END LIMIT 1`
  )
  timeColumnNameCache = r.rows[0]?.column_name || 'send_time'
  return timeColumnNameCache
}

/** Для SQL: зарезервированное слово time нужно в кавычках */
function timeColumnSql() {
  return timeColumnNameCache === 'time' ? '"time"' : 'send_time'
}

/** Маппинг строки БД для API: send_time → time для фронта */
function mapRow(row) {
  if (!row) return row
  const { send_time, ...rest } = row
  return { ...rest, time: send_time ?? row.time }
}

/**
 * Helper: Calculate next run time based on schedule configuration
 */
function calculateNextRun({ schedule_type, day_of_week, day_of_month, time, timezone }) {
  const now = new Date()
  const [hours, minutes] = time.split(':').map(Number)

  // Simple calculation - в production используйте moment-timezone
  let nextRun = new Date(now)
  nextRun.setHours(hours, minutes, 0, 0)

  if (schedule_type === 'daily') {
    // Если время уже прошло сегодня, берем завтра
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  } else if (schedule_type === 'weekly') {
    // Находим следующий нужный день недели
    const currentDay = nextRun.getDay()
    let daysToAdd = (day_of_week - currentDay + 7) % 7
    if (daysToAdd === 0 && nextRun <= now) {
      daysToAdd = 7
    }
    nextRun.setDate(nextRun.getDate() + daysToAdd)
  } else if (schedule_type === 'monthly') {
    // Устанавливаем день месяца
    nextRun.setDate(day_of_month)
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1)
    }
    // Если день месяца больше чем дней в месяце, берем последний день
    const lastDay = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()
    if (day_of_month > lastDay) {
      nextRun.setDate(lastDay)
    }
  }

  return nextRun
}

// effectiveHotelId removed — use req.hotelId from hotelIsolation middleware instead

/**
 * GET /api/scheduled-exports
 * Get all scheduled exports for the user's hotel
 */
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const user = req.user
    const { department_id } = req.query
    const hotelId = req.hotelId

    if (!hotelId && user.role === 'SUPER_ADMIN') {
      return res.json([])
    }
    if (!hotelId) {
      return res.status(400).json({ error: 'Hotel context required' })
    }

    let queryText = `
      SELECT
        se.*,
        d.name as department_name,
        u.name as created_by_name
      FROM scheduled_exports se
      LEFT JOIN departments d ON se.department_id = d.id
      LEFT JOIN users u ON se.created_by = u.id
      WHERE se.hotel_id = $1
    `
    const queryParams = [hotelId]

    // Фильтр по отделу
    if (department_id) {
      queryText += ` AND se.department_id = $${queryParams.length + 1}`
      queryParams.push(department_id)
    } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      // Обычные пользователи видят только свой отдел
      queryText += ` AND se.department_id = $${queryParams.length + 1}`
      queryParams.push(user.department_id)
    }

    queryText += ` ORDER BY se.created_at DESC`

    const result = await query(queryText, queryParams)

    res.json(result.rows.map(mapRow))
  } catch (error) {
    logError('ScheduledExports', 'Failed to fetch scheduled exports', error)
    res.status(500).json({ error: 'Failed to fetch scheduled exports' })
  }
})

/**
 * GET /api/scheduled-exports/:id
 * Get a single scheduled export by ID
 */
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const hotelId = req.hotelId

    const result = await query(
      `SELECT
        se.*,
        d.name as department_name,
        d.email as department_email,
        d.telegram_chat_id as department_telegram_chat_id,
        u.name as created_by_name
      FROM scheduled_exports se
      LEFT JOIN departments d ON se.department_id = d.id
      LEFT JOIN users u ON se.created_by = u.id
      WHERE se.id = $1${hotelId ? ' AND se.hotel_id = $2' : ''}`,
      hotelId ? [id, hotelId] : [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled export not found' })
    }

    const schedule = result.rows[0]
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'HOTEL_ADMIN' &&
      schedule.department_id !== user.department_id
    ) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(mapRow(schedule))
  } catch (error) {
    logError('ScheduledExports', 'Failed to fetch scheduled export', error)
    res.status(500).json({ error: 'Failed to fetch scheduled export' })
  }
})

/**
 * POST /api/scheduled-exports
 * Create a new scheduled export
 */
router.post('/', authMiddleware, hotelIsolation, allowRoles(['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']), async (req, res) => {
  try {
    const user = req.user

    const validation = validate(CreateScheduledExportSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
    }

    const {
      department_id,
      schedule_type,
      day_of_week,
      day_of_month,
      time,
      timezone,
      export_types,
      export_formats,
      filters,
      delivery_method,
      email_override,
      telegram_chat_id_override
    } = validation.data

    // Проверка прав: менеджер может создавать только для своего отдела
    if (user.role === 'MANAGER' && department_id !== user.department_id) {
      return res.status(403).json({ error: 'You can only create schedules for your department' })
    }

    // Проверка существования отдела (user.hotel_id может быть null у SUPER_ADMIN)
    const deptResult = await query(
      user.hotel_id
        ? `SELECT id, hotel_id, email, telegram_chat_id FROM departments WHERE id = $1 AND hotel_id = $2 AND is_active = TRUE`
        : `SELECT id, hotel_id, email, telegram_chat_id FROM departments WHERE id = $1 AND is_active = TRUE`,
      user.hotel_id ? [department_id, user.hotel_id] : [department_id]
    )

    if (deptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' })
    }

    const department = deptResult.rows[0]
    const hotelId = req.hotelId ?? department.hotel_id

    // Проверка наличия email/telegram в зависимости от delivery_method
    if (delivery_method === 'email' || delivery_method === 'both') {
      if (!email_override && !department.email) {
        return res.status(400).json({
          success: false,
          error: 'EMAIL_NOT_CONFIGURED',
          message: `Department email not configured. Please configure email in department settings or provide email_override.`
        })
      }
    }

    if (delivery_method === 'telegram' || delivery_method === 'both') {
      if (!telegram_chat_id_override && !department.telegram_chat_id) {
        return res.status(400).json({
          success: false,
          error: 'TELEGRAM_NOT_CONFIGURED',
          message: `Department Telegram chat not configured. Please configure Telegram in department settings or provide telegram_chat_id_override.`
        })
      }
    }

    // Вычисление next_run_at
    const next_run_at = calculateNextRun({
      schedule_type,
      day_of_week,
      day_of_month,
      time,
      timezone
    })

    // Имя колонки времени в БД (send_time или "time")
    await getTimeColumnName()
    const timeCol = timeColumnSql()

    // Создание
    const result = await query(
      `INSERT INTO scheduled_exports (
        hotel_id, department_id, schedule_type, day_of_week, day_of_month,
        ${timeCol}, timezone, export_types, export_formats, filters,
        delivery_method, email_override, telegram_chat_id_override,
        created_by, next_run_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        hotelId,
        department_id,
        schedule_type,
        day_of_week,
        day_of_month,
        time,
        timezone,
        JSON.stringify(export_types),
        JSON.stringify(export_formats),
        JSON.stringify(filters),
        delivery_method,
        email_override,
        telegram_chat_id_override,
        user.id,
        next_run_at,
        true
      ]
    )

    logInfo('ScheduledExports', `Created scheduled export ${result.rows[0].id}`)

    res.status(201).json(mapRow(result.rows[0]))
  } catch (error) {
    const detail = error.code === '42703' ? ` (column: ${error.column ?? 'unknown'})` : ''
    logError('ScheduledExports', `Failed to create scheduled export${detail}`, error)
    res.status(500).json({ error: 'Failed to create scheduled export' })
  }
})

/**
 * PUT /api/scheduled-exports/:id
 * Update an existing scheduled export
 */
router.put('/:id', authMiddleware, hotelIsolation, allowRoles(['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']), async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const hotelId = req.hotelId

    const existingResult = await query(
      `SELECT * FROM scheduled_exports WHERE id = $1${hotelId ? ' AND hotel_id = $2' : ''}`,
      hotelId ? [id, hotelId] : [id]
    )

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled export not found' })
    }

    const existing = existingResult.rows[0]

    // Проверка прав
    if (user.role === 'MANAGER' && existing.department_id !== user.department_id) {
      return res.status(403).json({ error: 'You can only update schedules for your department' })
    }

    const validation = validate(UpdateScheduledExportSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Ошибка валидации', details: validation.errors })
    }

    const {
      schedule_type,
      day_of_week,
      day_of_month,
      time,
      timezone,
      export_types,
      export_formats,
      filters,
      delivery_method,
      email_override,
      telegram_chat_id_override,
      is_active
    } = validation.data

    // Используем существующие значения если новые не предоставлены
    const updatedScheduleType = schedule_type || existing.schedule_type
    const updatedDayOfWeek = day_of_week !== undefined ? day_of_week : existing.day_of_week
    const updatedDayOfMonth = day_of_month !== undefined ? day_of_month : existing.day_of_month
    const updatedTime = time ?? existing.send_time ?? existing.time
    const updatedTimezone = timezone || existing.timezone

    // Пересчитываем next_run_at если изменилось расписание
    const next_run_at =
      schedule_type || day_of_week !== undefined || day_of_month !== undefined || time || timezone
        ? calculateNextRun({
          schedule_type: updatedScheduleType,
          day_of_week: updatedDayOfWeek,
          day_of_month: updatedDayOfMonth,
          time: updatedTime,
          timezone: updatedTimezone
        })
        : existing.next_run_at

    await getTimeColumnName()
    const timeCol = timeColumnSql()

    const updateParams = [
      schedule_type,
      day_of_week !== undefined ? day_of_week : null,
      day_of_month !== undefined ? day_of_month : null,
      time,
      timezone,
      export_types ? JSON.stringify(export_types) : null,
      export_formats ? JSON.stringify(export_formats) : null,
      filters ? JSON.stringify(filters) : null,
      delivery_method,
      email_override,
      telegram_chat_id_override,
      is_active !== undefined ? is_active : null,
      next_run_at,
      id
    ]
    if (hotelId) updateParams.push(hotelId)

    const result = await query(
      `UPDATE scheduled_exports
       SET schedule_type = COALESCE($1, schedule_type),
           day_of_week = COALESCE($2, day_of_week),
           day_of_month = COALESCE($3, day_of_month),
           ${timeCol} = COALESCE($4, ${timeCol}),
           timezone = COALESCE($5, timezone),
           export_types = COALESCE($6, export_types),
           export_formats = COALESCE($7, export_formats),
           filters = COALESCE($8, filters),
           delivery_method = COALESCE($9, delivery_method),
           email_override = COALESCE($10, email_override),
           telegram_chat_id_override = COALESCE($11, telegram_chat_id_override),
           is_active = COALESCE($12, is_active),
           next_run_at = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14${hotelId ? ' AND hotel_id = $15' : ''}
       RETURNING *`,
      updateParams
    )

    logInfo('ScheduledExports', `Updated scheduled export ${id}`)

    res.json(mapRow(result.rows[0]))
  } catch (error) {
    logError('ScheduledExports', 'Failed to update scheduled export', error)
    res.status(500).json({ error: 'Failed to update scheduled export' })
  }
})

/**
 * DELETE /api/scheduled-exports/:id
 * Delete a scheduled export
 */
router.delete('/:id', authMiddleware, hotelIsolation, allowRoles(['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']), async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const hotelId = req.hotelId

    const existingResult = await query(
      `SELECT * FROM scheduled_exports WHERE id = $1${hotelId ? ' AND hotel_id = $2' : ''}`,
      hotelId ? [id, hotelId] : [id]
    )

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled export not found' })
    }

    const existing = existingResult.rows[0]

    // Проверка прав
    if (user.role === 'MANAGER' && existing.department_id !== user.department_id) {
      return res.status(403).json({ error: 'You can only delete schedules for your department' })
    }

    // Удаление
    await query(`DELETE FROM scheduled_exports WHERE id = $1`, [id])

    logInfo('ScheduledExports', `Deleted scheduled export ${id}`)

    res.json({ message: 'Scheduled export deleted successfully' })
  } catch (error) {
    logError('ScheduledExports', 'Failed to delete scheduled export', error)
    res.status(500).json({ error: 'Failed to delete scheduled export' })
  }
})

/**
 * POST /api/scheduled-exports/:id/test
 * Test a scheduled export (run it immediately)
 */
router.post('/:id/test', authMiddleware, hotelIsolation, allowRoles(['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']), async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const hotelId = req.hotelId

    const result = await query(
      `SELECT
        se.*,
        d.name as department_name,
        d.email as department_email,
        d.telegram_chat_id
      FROM scheduled_exports se
      LEFT JOIN departments d ON se.department_id = d.id
      WHERE se.id = $1${hotelId ? ' AND se.hotel_id = $2' : ''}`,
      hotelId ? [id, hotelId] : [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled export not found' })
    }

    const schedule = result.rows[0]

    // Проверка прав
    if (user.role === 'MANAGER' && schedule.department_id !== user.department_id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Запуск тестового экспорта (асинхронно)
    // В production это должно быть через ScheduledExportService
    res.json({
      message: 'Test export started',
      schedule_id: id,
      note: 'Check logs for execution results'
    })

    // TODO: Вызвать ScheduledExportService.executeScheduledExport(schedule, true)
    logInfo('ScheduledExports', `Test export triggered for schedule ${id}`)
  } catch (error) {
    logError('ScheduledExports', 'Failed to trigger test export', error)
    res.status(500).json({ error: 'Failed to trigger test export' })
  }
})

/**
 * GET /api/scheduled-exports/:id/logs
 * Get execution logs for a scheduled export
 */
router.get('/:id/logs', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const { limit = 20, offset = 0 } = req.query

    const hotelId = req.hotelId
    const scheduleResult = await query(
      `SELECT department_id FROM scheduled_exports WHERE id = $1${hotelId ? ' AND hotel_id = $2' : ''}`,
      hotelId ? [id, hotelId] : [id]
    )

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled export not found' })
    }

    const schedule = scheduleResult.rows[0]

    // Проверка прав
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'ADMIN' &&
      schedule.department_id !== user.department_id
    ) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Получаем логи
    const logsResult = await query(
      `SELECT * FROM scheduled_export_logs
       WHERE scheduled_export_id = $1
       ORDER BY run_at DESC
       LIMIT $2 OFFSET $3`,
      [id, parseInt(limit), parseInt(offset)]
    )

    // Подсчитываем общее количество
    const countResult = await query(
      `SELECT COUNT(*) as total FROM scheduled_export_logs WHERE scheduled_export_id = $1`,
      [id]
    )

    res.json({
      logs: logsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error) {
    logError('ScheduledExports', 'Failed to fetch logs', error)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

export default router
