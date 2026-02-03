# FreshTrack Architecture

## Версия: 3.1.0

## Дата обновления: 3 февраля 2026

---

## 🏗️ Фундаментальные принципы

### 1. Backend — единственный источник истины

Frontend **НЕ ДОЛЖЕН**:

- Вычислять статусы (expired, critical, warning)
- Определять цвета на основе данных
- Принимать решения о доступе на основе ролей
- Дублировать бизнес-логику

Frontend **ДОЛЖЕН**:

- Отображать данные как есть
- Использовать `statusColor`, `statusText` с бэкенда
- Проверять доступ через `capabilities` объект
- Показывать ошибку если данных нет

### 2. Идентификация отелей

> 📖 Полная документация: [HOTEL_IDENTIFICATION.md](./HOTEL_IDENTIFICATION.md)

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOTEL IDENTIFICATION                          │
├────────────────┬──────────────┬──────────────────────────────────┤
│ Field          │ Type         │ Purpose                          │
├────────────────┼──────────────┼──────────────────────────────────┤
│ hotel_id (id)  │ UUID         │ PRIMARY KEY - единственный       │
│                │              │ идентификатор для FK, ACL,       │
│                │              │ фильтрации данных                │
├────────────────┼──────────────┼──────────────────────────────────┤
│ marsha_code    │ VARCHAR(5)   │ Внешний код Marriott (snapshot)  │
│                │ UNIQUE*      │ ТОЛЬКО auth + UI display         │
│                │              │ *unique среди is_active=true     │
├────────────────┼──────────────┼──────────────────────────────────┤
│ external_ids   │ TABLE        │ Отдельная таблица для OPERA,     │
│                │              │ SAP, PMS и других систем         │
└────────────────┴──────────────┴──────────────────────────────────┘
```

> ⚠️ `hotels.code` (6-символьный) — **УДАЛЁН** миграцией 019

#### ❌ ЗАПРЕЩЕНО использовать marsha_code для:

- Foreign keys в других таблицах
- Фильтрации данных в бизнес-запросах
- Проверок доступа (ACL/permissions)
- Бизнес-логики
- API endpoints кроме `/auth/*`

#### ✅ РАЗРЕШЕНО использовать marsha_code для:

- `GET /api/auth/validate-hotel-code`
- `POST /api/auth/register`
- Отображения в UI как "код отеля"
- Связи с Telegram (/link команда)

#### 🔒 Защита marsha_code (миграция 029)

```sql
-- ❌ Запрещено: UPDATE hotels SET marsha_code = 'XXXXX';
-- ✅ Разрешено: UPDATE hotels SET marsha_code_id = <uuid>;
-- Триггер автоматически синхронизирует marsha_code из справочника
```

---

## 🔐 Система доступа (RBAC)

### Роли

| Роль               | Уровень | Scope      | Описание                     |
| ------------------ | ------- | ---------- | ---------------------------- |
| SUPER_ADMIN        | 100     | all        | Полный доступ ко всем отелям |
| HOTEL_ADMIN        | 80      | hotel      | Администратор одного отеля   |
| DEPARTMENT_MANAGER | 50      | department | Менеджер отдела              |
| STAFF              | 10      | department | Сотрудник отдела             |

### Permissions vs Roles

```javascript
// ❌ ПЛОХО - hardcoded роли
if (user.role === 'ADMIN') {
  showSettings()
}

// ✅ ХОРОШО - проверка permissions
if (hasPermission('settings:manage')) {
  showSettings()
}

// ✅ ЛУЧШЕ - использовать capabilities с бэкенда
if (user.capabilities.canManageSettings) {
  showSettings()
}
```

### Capabilities (с backend)

Backend возвращает готовый объект `capabilities`:

```javascript
{
  user: {
    id: "uuid",
    role: "HOTEL_ADMIN",
    roleLabel: "Администратор отеля", // локализовано
    permissions: ["products:read", "settings:manage", ...],
    capabilities: {
      isAdmin: true,
      isSuperAdmin: false,
      canViewAuditLogs: true,
      canManageUsers: true,
      canManageSettings: true,
      canManageDepartments: true,
      canExport: true,
      canViewInventory: true,
      canEditInventory: true,
      canDeleteInventory: true,
      canCreateBatches: true,
      canCollectBatches: true,
      canWriteOff: true,
      canManageNotifications: true,
      canAccessAllDepartments: true,
      canAccessAllHotels: false
    }
  }
}
```

---

## 📊 Статусы и цвета

### Expiry Status (backend вычисляет)

```javascript
// Backend возвращает enriched batch:
{
  id: "uuid",
  quantity: 10,
  expiry_date: "2026-01-15",

  // Computed by ExpiryService (Single Source of Truth)
  daysLeft: 3,
  expiryStatus: "critical",      // expired|today|critical|warning|good
  statusColor: "danger",         // danger|warning|success
  statusText: "Критично: 3 дн.", // локализованный текст
  statusCssClass: "bg-orange-600 text-white",
  isExpired: false,
  isUrgent: true
}
```

### Frontend использование

```jsx
// ✅ ПРАВИЛЬНО - использовать данные с бэка
<Badge className={batch.statusCssClass}>
  {batch.statusText}
</Badge>

// ❌ НЕПРАВИЛЬНО - вычислять на фронте
<Badge className={batch.daysLeft < 3 ? 'bg-danger' : 'bg-success'}>
  {batch.daysLeft < 3 ? 'Критично' : 'В норме'}
</Badge>
```

---

## 🗂️ Структура проекта

```
FreshTrack/
├── server/                      # Backend (Node.js + Express)
│   ├── middleware/
│   │   ├── auth.js              # JWT, requirePermission()
│   │   └── permissions.js       # RBAC helpers
│   ├── modules/                 # Feature modules
│   │   ├── auth/
│   │   ├── inventory/
│   │   ├── notifications/
│   │   └── ...
│   ├── services/
│   │   ├── ExpiryService.js     # Single Source of Truth для статусов
│   │   ├── PermissionService.js # RBAC логика
│   │   └── ...
│   └── db/
│       └── migrations/
│
├── src/                         # Frontend (React + Vite)
│   ├── context/
│   │   ├── AuthContext.jsx      # hasPermission, getCapabilities
│   │   └── ...
│   ├── components/
│   │   ├── ProtectedRoute.jsx   # requiredPermission prop
│   │   └── ...
│   └── config/
│       └── navigation.js        # requiredCapability, requiredPermission
│
└── docs/
    ├── ARCHITECTURE.md          # Этот файл
    ├── API/
    └── ...
```

---

## 📡 Scheduled Exports Pipeline (v3.1)

```
┌──────────────┐   React Query    ┌─────────────────────────────┐
│ Settings UI  │ ───────────────▶ │ scheduled-exports.controller │
│ (Schedule*   │                  │ + validation (Zod)           │
└──────┬───────┘                  └──────────────┬──────────────┘
       │ hotel_id, perms enforced               │ persist metadata
       │                                        ▼
┌──────▼─────────┐     cron jobs      ┌──────────────────────────┐
│ ExportService  │◀──────────────────▶│ ScheduledExportService    │
│ (Excel/PDF/CSV)│                    │ (node-cron + rate limits) │
└──────┬─────────┘                    └───────┬──────────────────┘
       │ attachments (XLSX/PDF buffers)       │ logs to DB
       ▼                                      ▼
┌──────────────┐                    ┌──────────────────────────┐
│ EmailService │ → Resend/SMTP      │ scheduled_exports, logs  │
│ TelegramSvc  │ → Telegram Bot API │ filtered по hotel_id     │
└──────────────┘                    └──────────────────────────┘
```

- **Безопасность:** `requireMFA`, `rateLimitExportWithAlert`, `requireAllowlistedIP` (если включено), `AuditService.logAction`.
- **Связанные сервисы:** `settings/telegram/chats` (детект привязанных чатов), `EmailService` (attachments + inline отчёты).
- **UI особенности:** `ScheduleCreateModal` подсказывает связанные Telegram-чаты и валидирует email/Telegram override на фронте, но окончательная проверка всегда на backend.

---

## 🔄 Data Flow & Offline/SSE

```
┌──────────────┐     Request      ┌──────────────┐
│   Frontend   │ ────────────────>│   Backend    │
│  (React/Vite)                  │  (Express)   │
│  - React Query                 │  - auth, MFA │
│  - Offline cache               │  - hotel iso │
│  - useSSE hook │<──────────────│  - services  │
└──────────────┘   SSE updates   └──────────────┘
```

### API Request Flow

```
1. Frontend: GET /api/inventory?department_id=xxx
2. Backend:
   - authMiddleware → hotelIsolation → departmentIsolation
   - requirePermission('products','read')
   - InventoryService → ExpiryService.enrich()
3. Response: { batches: [...], permissions, capabilities }
4. useSSE + node EventEmitter отправляет события (например, SCHEDULED_EXPORT_COMPLETED),
   React Query автоматически invalidates queryKeys.*
```

### Offline stack

- `src/lib/queryPersistence.js` + `@tanstack/query-persist-client` сохраняют данные в `localStorage` (24h TTL, 5MB лимит).
- `src/hooks/useOfflineMutation.js` складывает мутации (write-offs, collections) в очередь и повторяет после `navigator.onLine`.
- `src/components/ui/OfflineIndicator.jsx` и `useOfflineMutation` отображают баннер в режиме grace period.

### SSE stream

- Endpoint: `GET /api/events/stream`
- Используется в `useAuditSSE`, `NotificationsContext`.
- Все события имеют форму `{ type, payload, hotelId }` и проходят hotel scoping до отправки.

---

## 📝 Checklist для новых фич

### Backend

- [ ] Использует `requirePermission(resource, action)`
- [ ] Использует `buildContextWhere(req.user)` для фильтрации
- [ ] Не использует hardcoded роли (кроме SUPER_ADMIN bypass)
- [ ] Возвращает computed статусы/цвета
- [ ] Логирует через `logAudit()`
- [ ] Фильтрует по hotel_id

### Frontend

- [ ] Не вычисляет статусы локально
- [ ] Использует `statusColor`, `statusText` с бэка
- [ ] Проверяет `capabilities.canXxx` вместо ролей
- [ ] Показывает `roleLabel` вместо технической роли
- [ ] Не содержит `role === 'ADMIN'` проверок
- [ ] Использует `hasPermission()` из AuthContext

---

## 🚨 Миграция с hardcoded ролей

### До (deprecated)

```jsx
// ProtectedRoute.jsx
<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}>

// Component.jsx
{user.role === 'ADMIN' && <AdminButton />}
```

### После (рекомендуется)

```jsx
// ProtectedRoute.jsx
<ProtectedRoute requiredCapability="canManageSettings">

// Component.jsx
{user.capabilities?.canManageSettings && <AdminButton />}
```

---

## 📚 Связанные документы

- [API Reference](./api/openapi.yaml)
- [Hotel Identification](./HOTEL_IDENTIFICATION.md) — hotel_id, marsha_code, external_ids
- [MARSHA Codes](./MARSHA_CODES.md) — справочник Marriott кодов
- [Audit Implementation](./AUDIT_IMPLEMENTATION_REPORT.md)
- [Mobile UX Guidelines](./MOBILE_UX.md)
- [Индекс документации](./README.md) — список всех документов
