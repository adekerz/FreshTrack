# Централизованная система экспорта

> Обновлено: 3 февраля 2026

## Обзор

Система объединяет **мгновенный экспорт** (кнопки на страницах) и **запланированные отправки** (cron → email/Telegram) с единым движком Excel/PDF/CSV и единым дизайном отчётов.

## Типы экспорта

| Тип | Endpoint / источник | Форматы | Где в UI |
|-----|---------------------|---------|----------|
| inventory | `GET /api/export/inventory` | excel, csv, pdf* | Инвентарь, Настройки → Импорт/Экспорт |
| batches | `GET /api/export/batches` | excel, csv, pdf* | Настройки → Импорт/Экспорт |
| products | `GET /api/export/products` | excel, csv, pdf* | Настройки → Импорт/Экспорт |
| categories | `GET /api/export/categories` | excel, csv, pdf* | Настройки → Импорт/Экспорт |
| departments | `GET /api/export/departments` | excel, csv, pdf* | Настройки → Импорт/Экспорт |
| collections | `GET /api/export/collections` | excel, csv, pdf* | История сборов, Настройки |
| audit | `GET /api/audit-logs/export/excel` / `.../pdf` | excel, pdf | Журнал действий |

\* PDF для мгновенного экспорта генерируется на клиенте (печать в PDF). Для запланированных отчётов PDF формируется на сервере (если выбран в расписании).

## Backend

- **ExportService** (`server/services/ExportService.js`) — `toCSV`, `toXLSX`, `toJSON`, `sendExport`. Стили Excel: заголовок FreshTrack, шапка таблицы #2D2D2D, чередование строк, статус-цвета для партий.
- **ScheduledExportService** (`server/services/ScheduledExportService.js`) — node-cron каждую минуту, выборка `scheduled_exports` по `next_run_at`, генерация файлов через ExportService, отправка через EmailService/TelegramService, запись в `scheduled_export_logs`.
- **Модуль** `server/modules/scheduled-exports/` — CRUD расписаний, тест-запуск, логи. Используется `effectiveHotelId(req)` для SUPER_ADMIN.
- **Модуль** `server/modules/export/` — маршруты разового экспорта по типам (inventory, batches, products, categories, departments, collections); audit экспорт в модуле audit.

## Frontend

- **useExport** (`src/hooks/useExport.js`) — выбор формата, вызов API или клиентский PDF/Excel.
- **ExportButton** (`src/components/ExportButton.jsx`) — кнопка с выпадающим списком форматов, привязка к конфигу из `src/config/exportConfig.js`.
- **ScheduledExportsManager** + **ScheduleCreateModal** / **ScheduleEditModal** — настройка расписаний, подстановка email/Telegram отдела и связанных чатов из `GET /api/settings/telegram/chats`.
- **Доменный слой** `src/domain/export/` — адаптеры (Inventory, Collections, Audit), `FilterSerializer` для фильтров и метаданных.

## Безопасность

- Разовые экспорты: `authMiddleware`, `hotelIsolation`, `requirePermission(EXPORT, READ)`, при необходимости `requireMFA` и `rateLimitExportWithAlert`.
- Запланированные: `requirePermission('scheduled_exports','manage')`, `requireMFA` на мутации, rate limit на тест-запуск.
- Все ответы фильтруются по `hotel_id`; для SUPER_ADMIN передаётся `hotel_id` в query.

## Связанные документы

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) — статус и чеклисты.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — блок «Scheduled Exports Pipeline».
- [RESEND_WEBHOOKS_AND_EMAIL.md](./RESEND_WEBHOOKS_AND_EMAIL.md) — email и вложения.
