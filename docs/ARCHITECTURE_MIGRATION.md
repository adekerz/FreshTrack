# 🏗️ Эволюция архитектуры FreshTrack (v3.1)

## ✅ Статус — ЗАВЕРШЕНО (v3.1 «Centralized Exports»)

| Версия | Дата | Ключевые изменения |
| --- | --- | --- |
| v2.0.0 | 03 янв 2026 | Переезд на feature-based `server/modules/*` |
| v3.0.0 | 21 янв 2026 | React Query + offline persistence |
| v3.1.0 | 03 фев 2026 | Scheduled exports, Telegram detection, Excel/PDF overhaul |

---

## 📊 Итоги v3.1

### Новые возможности
- `server/modules/scheduled-exports/` — REST API + Zod схемы с hotel isolation.
- `server/services/ScheduledExportService.js` — cron-планировщик с audit логами и ретраями.
- `server/services/ExportService.js` — единый движок XLSX/PDF/CSV (ExcelJS + PDFKit) с корпоративным дизайном.
- `server/services/EmailService.js` — вложения для Resend/SMTP; fallback на Telegram.
- `src/components/ScheduledExports/*` — UI (+ `TelegramSetupGuide.jsx`) с автодетектом чатов.
- `src/hooks/useAuditSSE.js` + `/api/events/stream` — SSE оповещения об экспортных событиях.
- `docs/README.md` — единый индекс документации.

### Что устранили
- Legacy CSS `ScheduledExports.css` → Tailwind.
- Дубли offline документации → консолидация в `OFFLINE_SYNC.md` (идёт в рамках cleanup).

---

## 📁 Структура сервера

```
server/
├── modules/                    # 21 Feature-based модуль
│   ├── auth/                   # Аутентификация
│   │   ├── auth.schemas.js     # Zod валидация
│   │   ├── auth.service.js     # Бизнес-логика
│   │   ├── auth.controller.js  # HTTP обработчики
│   │   └── index.js            # Public API
│   │
│   ├── inventory/              # Продукты, батчи, категории
│   │   ├── inventory.schemas.js
│   │   ├── inventory.controller.js
│   │   └── index.js
│   │
│   ├── hotels/                 # Управление отелями
│   │   ├── hotels.schemas.js
│   │   ├── hotels.controller.js
│   │   └── index.js
│   │
│   ├── departments/            # Отделы
│   ├── collections/            # Сборы
│   ├── fifo-collect/           # FIFO сбор
│   ├── write-offs/             # Списания
│   ├── audit/                  # Аудит логи
│   ├── delivery-templates/     # Шаблоны поставок
│   ├── notification-rules/     # Правила уведомлений
│   ├── notifications/          # Уведомления
│   ├── custom-content/         # Брендинг
│   ├── department-settings/    # Настройки отделов
│   ├── settings/               # Глобальные настройки
│   ├── reports/                # Отчёты
│   ├── health/                 # Health checks
│   ├── import/                 # Импорт данных
│   ├── export/                 # Разовый экспорт
│   ├── scheduled-exports/      # Расписания + cron (NEW)
│   ├── telegram/               # Telegram интеграция
│   ├── events/                 # SSE события
│   ├── marsha-codes/           # MARSHA коды
│   └── index.js                # Barrel export всех модулей
│
├── services/                   # Shared сервисы
│   ├── AuditService.js
│   ├── CollectionService.js
│   ├── NotificationEngine.js
│   ├── TelegramService.js
│   └── ...
│
├── middleware/                 # Middleware
│   ├── auth.js                 # JWT + permissions
│   ├── permissions.js          # RBAC
│   └── rateLimiter.js
│
├── db/                         # База данных
│   ├── postgres.js             # PostgreSQL connection
│   ├── database.js             # Schema + queries
│   └── migrations/             # SQL миграции
│
├── routes/                     # Только docs
│   └── docs.js                 # Swagger UI
│
└── index.js                    # Entry point
```

---

## 🔗 API Endpoints (24 модуля)

| Модуль | Endpoint | Описание |
|--------|----------|----------|
| auth | `/api/auth/*` | Login, register, me, refresh |
| inventory | `/api/batches/*`, `/api/products/*`, `/api/categories/*` | CRUD продуктов |
| hotels | `/api/hotels/*` | Управление отелями |
| departments | `/api/departments/*` | Отделы |
| collections | `/api/collections/*` | Сборы продуктов |
| fifo-collect | `/api/fifo-collect/*` | FIFO сбор |
| write-offs | `/api/write-offs/*` | Списания |
| audit | `/api/audit-logs/*` | Логи аудита |
| delivery-templates | `/api/delivery-templates/*` | Шаблоны поставок |
| notification-rules | `/api/notification-rules/*` | Правила уведомлений |
| notifications | `/api/notifications/*` | Уведомления |
| custom-content | `/api/custom-content/*` | Брендинг контент |
| department-settings | `/api/department-settings/*` | Настройки отделов |
| settings | `/api/settings/*` | Глобальные настройки |
| reports | `/api/reports/*` | Отчёты и статистика |
| health | `/api/health/*` | Health checks |
| import | `/api/import/*` | Импорт данных |
| export | `/api/export/*` | Экспорт (Excel, CSV) |
| scheduled-exports | `/api/scheduled-exports/*` | CRUD + тесты расписаний |
| telegram | `/api/telegram/*` | Telegram бот |
| events | `/api/events/*` | SSE real-time |
| marsha-codes | `/api/marsha-codes/*` | MARSHA коды |

---

## 🧩 Структура модуля

```javascript
// modules/hotels/hotels.schemas.js
import { z } from 'zod'

export const CreateHotelSchema = z.object({
  name: z.string().min(2).max(255),
  marshaCode: z.string().length(5).optional()
})

export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { 
      isValid: false, 
      errors: result.error.issues.map(i => i.message) 
    }
  }
  return { isValid: true, data: result.data }
}
```

```javascript
// modules/hotels/hotels.controller.js
import express from 'express'
import { authMiddleware, requirePermission } from '../../middleware/auth.js'
import { CreateHotelSchema, validate } from './hotels.schemas.js'

const router = express.Router()

router.post('/', authMiddleware, requirePermission('hotels', 'manage'), async (req, res) => {
  const { isValid, data, errors } = validate(CreateHotelSchema, req.body)
  if (!isValid) return res.status(400).json({ error: errors[0] })
  // ... create hotel
})

export default router
```

```javascript
// modules/hotels/index.js
export { default as hotelsController } from './hotels.controller.js'
export * from './hotels.schemas.js'
```

---

## 📦 Команды

```bash
# Development
npm run dev           # Frontend (Vite)
npm run dev:server    # Backend (Node.js)

# Build
npm run build         # Production build

# Testing
npm test              # Vitest watch
npm run test:run      # Single run
npm run test:coverage # Coverage report
npm run test:server   # Server tests only

# Linting
npm run lint          # ESLint
npm run typecheck     # TypeScript

# Database
npm run db:migrate    # Run migrations
npm run db:backup     # Backup to JSON
```

---

## 🔐 Безопасность

### Middleware Stack
```
Request → rateLimiter → authMiddleware → hotelIsolation → departmentIsolation → requirePermission → Handler
```

### Permission Check
```javascript
// Каждый endpoint с мутацией
router.post('/', 
  authMiddleware,           // JWT verify
  hotelIsolation,           // Filter by hotel_id
  requirePermission('resource', 'action'),  // RBAC check
  handler
)
```

### Audit Logging
```javascript
await logAudit({
  userId: req.user.id,
  action: 'CREATE',
  resource: 'Product',
  resourceId: product.id,
  details: { name: product.name },
  ipAddress: req.ip
})
```

---

## 📋 Checklist v3.1

### Backend
- [x] Зарегистрирован `scheduled-exports` модуль.
- [x] Cron сервис запускается при старте (`ScheduledExportService.init()`).
- [x] `ExportService` обновлён (ExcelJS стили, PDFKit, attachments).
- [x] `EmailService` и `TelegramService` обновлены под вложения и graceful fallback.
- [x] `/api/settings/telegram/chats` возвращает hotel/department scope для UI подсказок.
- [x] Все эндпоинты используют `effectiveHotelId` (SUPER_ADMIN выбирает hotel в query).

### Frontend
- [x] `ScheduledExportsManager`, `ScheduleCreateModal`, `ScheduleEditModal` реализованы.
- [x] `TelegramSetupGuide` добавлен для onboarding.
- [x] `ExportButton` поддерживает 7 отчётов, PDF/CSV/Excel (реюз `useExport`).
- [x] i18n ключи `export.*`, `scheduledExports.*`, `common.*` добавлены (ru/en).

### Документация
- [x] `docs/README.md` — индекс и action plan.
- [x] ARCHITECTURE.md описывает offline+SSE+scheduled exports.
- [ ] Offline документы объединены (идёт в рамках cleanup todo).

---

## 🚀 Быстрая проверка

```bash
cd server && npm run dev

# Ожидаемый вывод:
# ✅ Scheduled exports service started (cron=1m)
# ✅ SSE stream ready at /api/events/stream
# ✅ ExcelJS theme loaded
#
# curl http://localhost:3001/api/scheduled-exports?hotel_id=<uuid>
# → 200 OK + фильтрация по hotel_id
```
