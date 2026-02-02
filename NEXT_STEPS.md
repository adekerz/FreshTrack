# 🚀 Следующие шаги для завершения реализации

## ✅ ЧТО УЖЕ ГОТОВО

### Backend:
- ✅ Миграция БД ([054_scheduled_exports.sql](server/db/migrations/054_scheduled_exports.sql))
- ✅ API endpoints ([scheduled-exports.controller.js](server/modules/scheduled-exports/scheduled-exports.controller.js))
- ✅ ScheduledExportService с cron jobs ([ScheduledExportService.js](server/services/ScheduledExportService.js))
- ✅ Интеграция в server/index.js

### Frontend:
- ✅ Domain Layer адаптеры ([src/domain/export/adapters/](src/domain/export/adapters/))
- ✅ FilterSerializer ([FilterSerializer.js](src/domain/export/FilterSerializer.js))
- ✅ Улучшенные утилиты экспорта ([exportEnhanced.js](src/utils/exportEnhanced.js))

---

## 📋 ШАГИ ДЛЯ ЗАПУСКА

### 1. Установите зависимости

```bash
cd server
npm install node-cron
```

### 2. Запустите миграцию базы данных

```bash
cd server
npm run migrate
```

Или вручную:
```bash
psql -h your-host -U your-user -d your-database -f server/db/migrations/054_scheduled_exports.sql
```

### 3. Перезапустите сервер

```bash
cd server
npm run dev
```

В логах должно появиться:
```
✅ Scheduled exports service started successfully
```

### 4. Проверьте API endpoints

Откройте Postman или используйте curl:

```bash
# Получить список запланированных экспортов
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/scheduled-exports

# Создать новое расписание
curl -X POST http://localhost:3001/api/scheduled-exports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "dept-uuid",
    "schedule_type": "daily",
    "time": "06:00",
    "export_types": ["inventory"],
    "export_formats": ["excel"],
    "delivery_method": "email"
  }'
```

---

## 🎨 СОЗДАНИЕ UI КОМПОНЕНТОВ

### Шаг 1: Создайте основной компонент

Создайте файл `src/components/ScheduledExports/ScheduledExportsManager.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { apiFetch } from '../../services/api'
import { ScheduleCreateModal } from './ScheduleCreateModal'
import { ScheduleEditModal } from './ScheduleEditModal'

export function ScheduledExportsManager() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/scheduled-exports')
      setSchedules(data)
    } catch (error) {
      addToast('Ошибка загрузки расписаний', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить это расписание?')) return

    try {
      await apiFetch(`/scheduled-exports/${id}`, { method: 'DELETE' })
      addToast('Расписание удалено', 'success')
      loadSchedules()
    } catch (error) {
      addToast('Ошибка удаления', 'error')
    }
  }

  const handleTest = async (id) => {
    try {
      await apiFetch(`/scheduled-exports/${id}/test`, { method: 'POST' })
      addToast('Тестовая отправка запущена', 'success')
    } catch (error) {
      addToast('Ошибка тестовой отправки', 'error')
    }
  }

  const handleToggleActive = async (schedule) => {
    try {
      await apiFetch(`/scheduled-exports/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !schedule.is_active })
      })
      loadSchedules()
    } catch (error) {
      addToast('Ошибка обновления', 'error')
    }
  }

  return (
    <div className="scheduled-exports-manager">
      <div className="header">
        <h2>Запланированные экспорты</h2>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + Создать расписание
        </button>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <p>Нет запланированных экспортов</p>
          <button onClick={() => setShowCreateModal(true)}>Создать первое расписание</button>
        </div>
      ) : (
        <div className="schedules-list">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="schedule-card">
              <div className="schedule-header">
                <h3>{schedule.department_name}</h3>
                <span className={`status ${schedule.is_active ? 'active' : 'inactive'}`}>
                  {schedule.is_active ? 'Активно' : 'Отключено'}
                </span>
              </div>

              <div className="schedule-details">
                <div className="detail">
                  <strong>Расписание:</strong> {schedule.schedule_type} в {schedule.time}
                </div>
                <div className="detail">
                  <strong>Отчеты:</strong> {JSON.parse(schedule.export_types).join(', ')}
                </div>
                <div className="detail">
                  <strong>Формат:</strong> {JSON.parse(schedule.export_formats).join(', ')}
                </div>
                <div className="detail">
                  <strong>Доставка:</strong> {schedule.delivery_method}
                </div>
                <div className="detail">
                  <strong>Следующий запуск:</strong>{' '}
                  {new Date(schedule.next_run_at).toLocaleString('ru-RU')}
                </div>
                {schedule.last_run_at && (
                  <div className="detail">
                    <strong>Последний запуск:</strong>{' '}
                    {new Date(schedule.last_run_at).toLocaleString('ru-RU')} -{' '}
                    <span className={`status-${schedule.last_run_status}`}>
                      {schedule.last_run_status}
                    </span>
                  </div>
                )}
              </div>

              <div className="schedule-actions">
                <button onClick={() => handleTest(schedule.id)}>Тестовый запуск</button>
                <button onClick={() => setEditingSchedule(schedule)}>Редактировать</button>
                <button onClick={() => handleToggleActive(schedule)}>
                  {schedule.is_active ? 'Отключить' : 'Включить'}
                </button>
                <button onClick={() => handleDelete(schedule.id)} className="btn-danger">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <ScheduleCreateModal onClose={() => setShowCreateModal(false)} onSuccess={loadSchedules} />
      )}

      {editingSchedule && (
        <ScheduleEditModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSuccess={loadSchedules}
        />
      )}
    </div>
  )
}
```

### Шаг 2: Создайте модальное окно создания

Создайте файл `src/components/ScheduledExports/ScheduleCreateModal.jsx` (используйте форму с полями из API).

### Шаг 3: Добавьте стили

Создайте файл `src/components/ScheduledExports/ScheduledExports.css`.

### Шаг 4: Интегрируйте в Settings

В файле `src/pages/SettingsPage.jsx` добавьте новую вкладку:

```jsx
import { ScheduledExportsManager } from '../components/ScheduledExports/ScheduledExportsManager'

// В массив tabs добавьте:
{
  id: 'scheduled-exports',
  label: 'Запланированные экспорты',
  icon: <CalendarIcon />, // импортируйте иконку
  component: <ScheduledExportsManager />
}
```

---

## 🧪 ТЕСТИРОВАНИЕ

### 1. Проверьте создание расписания

1. Откройте Settings → Запланированные экспорты
2. Нажмите "Создать расписание"
3. Заполните форму
4. Проверьте что расписание появилось в списке

### 2. Проверьте тестовый запуск

1. Нажмите "Тестовый запуск" на созданном расписании
2. Проверьте почту/Telegram
3. Убедитесь что файлы приходят

### 3. Проверьте автоматический запуск

1. Создайте расписание на ближайшее время (например, через 2 минуты)
2. Дождитесь выполнения
3. Проверьте логи в БД:

```sql
SELECT * FROM scheduled_export_logs ORDER BY run_at DESC LIMIT 10;
```

---

## 🐛 TROUBLESHOOTING

### Проблема: Cron jobs не запускаются

**Решение:** Проверьте логи сервера при запуске:
```bash
npm run dev | grep "Scheduled"
```

Должно быть: `✅ Scheduled exports service started successfully`

### Проблема: Email не приходят

**Решение:** Проверьте:
1. Настройки SMTP в `.env`
2. Логи EmailService
3. Email в настройках отдела

### Проблема: Telegram не отправляется

**Решение:** Проверьте:
1. `TELEGRAM_BOT_TOKEN` в `.env`
2. `telegram_chat_id` в настройках отдела
3. Логи TelegramService

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ (опционально)

1. **Фильтры в экспортах**: Добавьте UI для настройки фильтров при создании расписания
2. **Уведомления о сбоях**: Отправляйте админу уведомление если экспорт упал
3. **История выполнения**: Добавьте UI для просмотра логов выполнения
4. **Множественные получатели**: Поддержка нескольких email адресов
5. **Шаблоны отчетов**: Возможность сохранять конфигурацию как шаблон

---

## 🎯 ФИНАЛЬНЫЙ ЧЕКЛИСТ

- [ ] Установлен node-cron
- [ ] Запущена миграция БД
- [ ] Сервер перезапущен успешно
- [ ] API endpoints работают
- [ ] UI компоненты созданы
- [ ] UI интегрирован в Settings
- [ ] Протестировано создание расписания
- [ ] Протестирован тестовый запуск
- [ ] Протестирована автоматическая отправка
- [ ] Проверены email уведомления
- [ ] Проверены Telegram уведомления

---

## 📞 ПОДДЕРЖКА

Если возникли вопросы:
1. Проверьте логи сервера: `tail -f server/logs/error.log`
2. Проверьте логи БД: `SELECT * FROM scheduled_export_logs`
3. Откройте issue в репозитории

Удачи! 🚀
