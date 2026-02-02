# Централизованная система экспорта с запланированными отправками

## ✅ ЧТО УЖЕ РЕАЛИЗОВАНО

### 1. Frontend Domain Layer (src/domain/export/)
Созданы адаптеры для нормализации данных перед экспортом:

- **BaseAdapter.js** - базовый класс с утилитами форматирования
- **InventoryAdapter.js** - адаптер для инвентаря
- **CollectionsAdapter.js** - адаптер для сборов/списаний
- **AuditAdapter.js** - адаптер для журнала аудита

### 2. FilterSerializer (src/domain/export/FilterSerializer.js)
Обработка и сериализация фильтров:
- Преобразование фильтров в query params
- Генерация человекочитаемых описаний фильтров
- Валидация и санитизация фильтров
- Защита от XSS и инъекций

### 3. Улучшенные утилиты экспорта (src/utils/exportEnhanced.js)
Новые функции экспорта с поддержкой метаданных:
- `exportToExcel()` - экспорт в Excel с отображением фильтров
- `exportToPDF()` - экспорт в PDF с метаданными

### 4. Backend - Миграция БД (server/db/migrations/054_scheduled_exports.sql)
Созданы таблицы:
- **scheduled_exports** - конфигурации запланированных экспортов
- **scheduled_export_logs** - история выполнения

## 🚧 ЧТО НУЖНО ДОДЕЛАТЬ

### 1. Backend API Endpoints

Создайте модуль `server/modules/scheduled-exports/`:

**server/modules/scheduled-exports/scheduled-exports.controller.js**:
```javascript
import express from 'express'
import { authenticate, authorize } from '../auth/auth.middleware.js'
import { query } from '../../db/postgres.js'
import { logError } from '../../utils/logger.js'

const router = express.Router()

// GET /api/scheduled-exports - список всех расписаний
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user

    let queryText = `
      SELECT se.*,
             d.name as department_name,
             u.name as created_by_name
      FROM scheduled_exports se
      LEFT JOIN departments d ON se.department_id = d.id
      LEFT JOIN users u ON se.created_by = u.id
      WHERE se.hotel_id = $1
    `
    const queryParams = [user.hotel_id]

    // Фильтр по отделу для обычных пользователей
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      queryText += ` AND se.department_id = $2`
      queryParams.push(user.department_id)
    }

    queryText += ` ORDER BY se.created_at DESC`

    const result = await query(queryText, queryParams)
    res.json(result.rows)
  } catch (error) {
    logError('ScheduledExports', error)
    res.status(500).json({ error: 'Failed to fetch scheduled exports' })
  }
})

// POST /api/scheduled-exports - создать новое расписание
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const user = req.user
    const {
      department_id,
      schedule_type,
      day_of_week,
      day_of_month,
      time,
      timezone = 'Asia/Almaty',
      export_types,
      export_formats = ['excel'],
      filters = {},
      delivery_method,
      email_override,
      telegram_chat_id_override
    } = req.body

    // Валидация
    if (!schedule_type || !time || !export_types || !delivery_method) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Вычисление next_run_at (используйте вашу логику)
    const next_run_at = calculateNextRun({
      schedule_type,
      day_of_week,
      day_of_month,
      time,
      timezone
    })

    const result = await query(
      `INSERT INTO scheduled_exports (
        hotel_id, department_id, schedule_type, day_of_week, day_of_month,
        time, timezone, export_types, export_formats, filters,
        delivery_method, email_override, telegram_chat_id_override,
        created_by, next_run_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        user.hotel_id, department_id, schedule_type, day_of_week, day_of_month,
        time, timezone, JSON.stringify(export_types), JSON.stringify(export_formats),
        JSON.stringify(filters), delivery_method, email_override,
        telegram_chat_id_override, user.id, next_run_at
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    logError('ScheduledExports', error)
    res.status(500).json({ error: 'Failed to create scheduled export' })
  }
})

// PUT /api/scheduled-exports/:id - обновить расписание
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  // Реализация аналогична POST, но с UPDATE query
})

// DELETE /api/scheduled-exports/:id - удалить расписание
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  // Реализация удаления
})

// POST /api/scheduled-exports/:id/test - тестовый запуск
router.post('/:id/test', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  // Запуск экспорта вручную для тестирования
})

// GET /api/scheduled-exports/:id/logs - получить логи
router.get('/:id/logs', authenticate, async (req, res) => {
  // Получение истории выполнения
})

function calculateNextRun({ schedule_type, day_of_week, day_of_month, time, timezone }) {
  // Используйте moment-timezone или date-fns-tz
  // Возвращает Date следующего запуска
}

export default router
```

**server/modules/scheduled-exports/index.js**:
```javascript
export { default as scheduledExportsController } from './scheduled-exports.controller.js'
```

Добавьте в **server/modules/index.js**:
```javascript
export { scheduledExportsController } from './scheduled-exports/index.js'
```

Добавьте в **server/index.js**:
```javascript
import { scheduledExportsController } from './modules/index.js'
// ...
app.use('/api/scheduled-exports', scheduledExportsController)
```

### 2. ScheduledExportService с Cron Jobs

Создайте **server/services/ScheduledExportService.js**:
```javascript
import cron from 'node-cron'
import { query } from '../db/postgres.js'
import { ExportService } from './ExportService.js'
import { sendEmail } from './EmailService.js'
import { TelegramService } from './TelegramService.js'
import { logInfo, logError } from '../utils/logger.js'

class ScheduledExportService {
  constructor() {
    this.jobs = new Map()
  }

  async initialize() {
    logInfo('ScheduledExportService', 'Initializing...')

    // Запуск проверки каждую минуту
    cron.schedule('* * * * *', () => this.checkDueExports())
  }

  async checkDueExports() {
    const now = new Date()

    const result = await query(
      `SELECT se.*, d.name as department_name, d.email as department_email,
              d.telegram_chat_id, h.name as hotel_name
       FROM scheduled_exports se
       LEFT JOIN departments d ON se.department_id = d.id
       LEFT JOIN hotels h ON se.hotel_id = h.id
       WHERE se.is_active = true AND se.next_run_at <= $1`,
      [now]
    )

    for (const schedule of result.rows) {
      await this.executeScheduledExport(schedule)
    }
  }

  async executeScheduledExport(schedule) {
    const startTime = Date.now()
    const logEntry = {
      scheduled_export_id: schedule.id,
      run_at: new Date(),
      status: 'running'
    }

    try {
      const exports = []

      // Генерируем каждый запрошенный отчет
      for (const exportType of schedule.export_types) {
        for (const format of schedule.export_formats) {
          try {
            // Используйте ExportService для генерации
            const data = await this.fetchExportData(exportType, schedule)
            const buffer = await ExportService.toXLSX(data, exportType)

            exports.push({
              type: exportType,
              format,
              buffer,
              filename: `${exportType}_${Date.now()}.xlsx`
            })
          } catch (error) {
            logError('ScheduledExportService', `Failed to generate ${exportType}`, error)
          }
        }
      }

      // Отправка Email
      if (schedule.delivery_method === 'email' || schedule.delivery_method === 'both') {
        const emailTo = schedule.email_override || schedule.department_email
        await this.sendEmailWithAttachments(emailTo, exports, schedule)
      }

      // Отправка Telegram
      if (schedule.delivery_method === 'telegram' || schedule.delivery_method === 'both') {
        const chatId = schedule.telegram_chat_id_override || schedule.telegram_chat_id
        await TelegramService.sendExports(chatId, exports, schedule)
      }

      // Обновляем статус
      await this.updateScheduleStatus(schedule.id, 'success')

    } catch (error) {
      logError('ScheduledExportService', `Execution failed for schedule ${schedule.id}`, error)
      await this.updateScheduleStatus(schedule.id, 'failed', error.message)
    }
  }

  async updateScheduleStatus(scheduleId, status, error = null) {
    const nextRun = this.calculateNextRun(schedule)
    await query(
      `UPDATE scheduled_exports
       SET last_run_at = $1, last_run_status = $2, last_run_error = $3, next_run_at = $4
       WHERE id = $5`,
      [new Date(), status, error, nextRun, scheduleId]
    )
  }
}

export default new ScheduledExportService()
```

Инициализируйте сервис в **server/index.js**:
```javascript
import ScheduledExportService from './services/ScheduledExportService.js'

// После инициализации БД
await ScheduledExportService.initialize()
```

### 3. UI Компоненты

Создайте **src/components/ScheduledExports/ScheduledExportsManager.jsx**:
```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../services/api'

export function ScheduledExportsManager() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    const data = await apiFetch('/scheduled-exports')
    setSchedules(data)
  }

  return (
    <div className="scheduled-exports">
      <h2>Запланированные экспорты</h2>

      <button onClick={() => setShowCreateModal(true)}>
        Создать расписание
      </button>

      <table>
        <thead>
          <tr>
            <th>Отдел</th>
            <th>Тип расписания</th>
            <th>Время</th>
            <th>Отчеты</th>
            <th>Доставка</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map(schedule => (
            <tr key={schedule.id}>
              <td>{schedule.department_name}</td>
              <td>{schedule.schedule_type}</td>
              <td>{schedule.time}</td>
              <td>{schedule.export_types.join(', ')}</td>
              <td>{schedule.delivery_method}</td>
              <td>{schedule.is_active ? 'Активно' : 'Отключено'}</td>
              <td>
                <button onClick={() => testSchedule(schedule.id)}>
                  Тест
                </button>
                <button onClick={() => editSchedule(schedule)}>
                  Редактировать
                </button>
                <button onClick={() => deleteSchedule(schedule.id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showCreateModal && (
        <ScheduleCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadSchedules}
        />
      )}
    </div>
  )
}
```

### 4. Интеграция в Settings

Добавьте вкладку "Запланированные экспорты" в настройки:

**src/pages/SettingsPage.jsx**:
```jsx
import { ScheduledExportsManager } from '../components/ScheduledExports/ScheduledExportsManager'

// В списке вкладок добавьте:
{
  id: 'scheduled-exports',
  label: 'Запланированные экспорты',
  icon: <CalendarIcon />,
  component: <ScheduledExportsManager />
}
```

## 📝 СЛЕДУЮЩИЕ ШАГИ

1. **Запустите миграцию**:
   ```bash
   cd server
   npm run migrate
   ```

2. **Создайте API endpoints** по шаблону выше

3. **Реализуйте ScheduledExportService**

4. **Создайте UI компоненты**

5. **Протестируйте**:
   - Создание расписания
   - Тестовый запуск
   - Фактическая отправка по расписанию
   - Просмотр логов

## 🔧 ЗАВИСИМОСТИ

Убедитесь что установлены:
```bash
npm install node-cron moment-timezone
```

## 📚 ДОКУМЕНТАЦИЯ

### FilterSerializer API

```javascript
import { FilterSerializer } from '../domain/export/FilterSerializer'

// Преобразование в query params
const params = FilterSerializer.toQueryParams({
  status: 'critical',
  startDate: new Date(),
  department: 'Kitchen'
})

// Человекочитаемое описание
const info = FilterSerializer.toHumanReadable(filters, translations)
// { count: 3, description: "Статус: Критично, Дата начала: 02.02.2026", filters: {...} }
```

### Adapters API

```javascript
import { InventoryAdapter } from '../domain/export/adapters'

const adapter = new InventoryAdapter(translations)
const normalized = adapter.normalize(rawData)
adapter.validate(normalized)
```

## 🎯 РЕЗУЛЬТАТ

После завершения у вас будет:
- ✅ Централизованная система экспорта
- ✅ Отображение фильтров в отчетах
- ✅ Запланированные отправки на email и Telegram
- ✅ История выполнения и логирование
- ✅ UI для управления расписаниями

Удачи! 🚀
