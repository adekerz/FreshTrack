# 🏗️ Архитектура FreshTrack v2.0

## ✅ Статус миграции — ПОЛНОСТЬЮ ЗАВЕРШЕНО 🎉

**Дата завершения:** 3 января 2026  
**Версия:** 2.0.0 — Modular Architecture

---

## 📊 Итоги миграции

### Было (Legacy)
- 24 отдельных route файла в `server/routes/`
- Смешанная логика в роутах
- Дублирование кода валидации
- Отсутствие изоляции модулей

### Стало (Modular)
- 21 feature-based модуль в `server/modules/`
- Чёткое разделение: schemas → controller → index
- Centralized Zod validation
- Полная изоляция модулей

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
│   ├── export/                 # Экспорт данных
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

## 🔗 API Endpoints (21 модуль)

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

## 📋 Checklist выполнения

### Backend Migration ✅
- [x] Создана структура modules/
- [x] Мигрированы все 21 модуль
- [x] Удалены 23 legacy route файла
- [x] Обновлён server/index.js
- [x] Zod validation во всех модулях
- [x] Audit logging сохранён

### Cleanup ✅
- [x] Удалены SQLite файлы (.db)
- [x] Удалены legacy routes
- [x] Удалена папка {src/
- [x] .gitignore настроен

### Documentation ✅
- [x] ARCHITECTURE_MIGRATION.md обновлён
- [x] README.md обновлён
- [x] Startup сообщение обновлено

---

## 🚀 Запуск

```bash
# Development
cd server && npm run dev

# Output:
# 🚀 FreshTrack Server v2.0 — Modular Architecture
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📍 Port: 3001
# 🌐 API: http://localhost:3001/api
# 📚 Docs: http://localhost:3001/api/docs
# 📦 Modules (21 feature-based): All legacy routes migrated ✓
```
