# 📊 Статус централизованной системы экспорта (v3.1)

> Обновлено: 3 февраля 2026 — все части фичи (backend, frontend, cron, docs) **в проде**.

## ✅ Сводка

| Слой | Статус | Детали |
| --- | --- | --- |
| Backend | ✅ | `scheduled-exports` модуль, cron `ScheduledExportService`, Excel/PDF движок, Email/Telegram отправка |
| Frontend | ✅ | React UI + адаптеры экспортов, i18n, permission-гейты, SSE уведомления |
| Database | ✅ | `054_scheduled_exports.sql` (+ зависимые миграции), audit логирование |
| Docs & QA | ✅ | Этот документ + `EXPORT_SYSTEM_IMPLEMENTATION.md`, QA чеклисты обновлены |

## 🔧 Компоненты

### Frontend
- `src/components/ScheduledExports/ScheduledExportsManager.jsx` — список расписаний, поиск, фильтры, логи.
- `ScheduleCreateModal.jsx` / `ScheduleEditModal.jsx` — создание/редактирование c автоподстановкой email/Telegram и timezone.
- `TelegramSetupGuide.jsx` — быстрый гайд по привязке Telegram.
- `ExportButton.jsx` + `useExport.js` — мгновенные выгрузки (Excel/PDF/CSV) для 7 типов отчётов: inventory, batches, categories, departments, collections, audit, marsha codes.
- `src/domain/export/adapters/*` + `FilterSerializer.js` — доменный слой нормализации данных.
- Стили: Tailwind, skeleton, error/empty states, i18n (`scheduledExports.*`, `export.*`, `common.*`).

### Backend
- `server/modules/scheduled-exports/` — REST API, Zod схемы, `effectiveHotelId` для SUPER_ADMIN.
- `server/services/ScheduledExportService.js` — node-cron (ежеминутно), ретраи, `scheduled_export_logs`.
- `server/services/ExportService.js` — ExcelJS (брендовые таблицы), PDFKit шаблон, CSV.
- `server/services/EmailService.js` — вложения (Resend/SMTP), Telegram fallback.
- `server/modules/settings/settings.controller.js` — `GET /settings/telegram/chats`.
- SSE (`/api/events/stream`) транслирует `SCHEDULED_EXPORT_*` события в React Query.

### API Surface
```
GET    /api/scheduled-exports
POST   /api/scheduled-exports
GET    /api/scheduled-exports/:id
PUT    /api/scheduled-exports/:id
DELETE /api/scheduled-exports/:id
POST   /api/scheduled-exports/:id/test
GET    /api/scheduled-exports/:id/logs
GET    /api/settings/telegram/chats
```
Все мутации требуют `requireMFA` + `requirePermission('scheduled_exports','manage')` + `rateLimitExportWithAlert`.

## 🚀 Как запустить/протестировать локально

```bash
# 1. Backend deps
cd server && npm install

# 2. Применить миграции (PostgreSQL 16)
npm run migrate

# 3. Запустить dev сервер
npm run dev
# → в логах: "✅ Scheduled exports service started (cron=1m)"

# 4. Запустить фронт
cd .. && npm run dev
```

### Проверка API

```bash
# Список расписаний
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/scheduled-exports?hotel_id=<uuid>"

# Создание
curl -X POST http://localhost:3001/api/scheduled-exports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "uuid",
    "schedule_type": "weekly",
    "day_of_week": 1,
    "time": "06:00",
    "timezone": "Asia/Almaty",
    "export_types": ["inventory","collections"],
    "export_formats": ["excel","pdf"],
    "delivery_method": "email",
    "email_override": "ops@example.com"
  }'

# Тестовый запуск
curl -X POST http://localhost:3001/api/scheduled-exports/<id>/test \
  -H "Authorization: Bearer $TOKEN"
```

## 🧪 QA чеклист

- [x] Создание/редактирование/удаление расписания (UI + API).
- [x] Автодетект Telegram: override → department field → linked chat fallback.
- [x] Вложения: письмо содержит Excel (.xlsx) + PDF (если выбраны) + CSV (если включён).
- [x] SSE: после выполнения приходит `SCHEDULED_EXPORT_COMPLETED` → UI обновляет список.
- [x] i18n: нет `Translation not found` для `export.*`/`scheduledExports.*`.
- [x] SUPER_ADMIN с `hotel_id=null` обязан выбрать hotel через query → API фильтрует по `effectiveHotelId`.
- [x] rate limit: 429 при >10 экспортов/час → UI показывает toast.

## 🐛 Troubleshooting

| Симптом | Причина | Решение |
| --- | --- | --- |
| `У отдела не настроен Telegram` | UI не получил `telegram_chat_id` и нет linked chats | Свяжите чат через `/settings/notifications` или введите `telegram_chat_id_override`. |
| Письмо без вложений | SMTP/Resend не принимает бинарные данные | Проверьте `.env` (`RESEND_API_KEY` или SMTP creds) + убедитесь, что `EmailService` пишет `attachments`. |
| Cron не запускается | `ScheduledExportService` не инициализировался | Проверьте логи server, убедитесь что `process.env.DISABLE_SCHEDULED_EXPORTS !== 'true'`. |
| SUPER_ADMIN не видит расписаний | Не передан `hotel_id` в query | UI (или curl) должен добавить `?hotel_id=<uuid>`; backend использует helper `effectiveHotelId`. |

## 📚 Доп. материалы

- [EXPORT_SYSTEM_IMPLEMENTATION.md](./EXPORT_SYSTEM_IMPLEMENTATION.md) — детальное описание фичи.
- [RESEND_WEBHOOKS_AND_EMAIL.md](./RESEND_WEBHOOKS_AND_EMAIL.md) — отправка email/Telegram.
- [ARCHITECTURE_MIGRATION.md](./ARCHITECTURE_MIGRATION.md) — эволюция серверной части.
- [docs/README.md](./README.md) — индекс документации.

Фича официально закрыта ✔️
