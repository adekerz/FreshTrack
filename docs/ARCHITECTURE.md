# FreshTrack Architecture

## Версия: 2.5.0
## Дата: Январь 2026

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
│ internal_code  │ VARCHAR(6)   │ Случайный код для приглашения    │
│ (code)         │ UNIQUE       │ сотрудников в отель              │
├────────────────┼──────────────┼──────────────────────────────────┤
│ marsha_code    │ VARCHAR(5)   │ Внешний код Marriott             │
│                │ NULLABLE     │ ТОЛЬКО для поиска/отображения    │
└────────────────┴──────────────┴──────────────────────────────────┘
```

#### ❌ ЗАПРЕЩЕНО использовать marsha_code для:
- Foreign keys в других таблицах
- Фильтрации данных
- Проверок доступа (ACL/permissions)
- Бизнес-логики
- URL для записи/изменения данных

#### ✅ РАЗРЕШЕНО использовать marsha_code для:
- Поиска отеля при регистрации
- Отображения в UI как "код отеля"
- Связи с Telegram (/link команда)

---

## 🔐 Система доступа (RBAC)

### Роли

| Роль | Уровень | Scope | Описание |
|------|---------|-------|----------|
| SUPER_ADMIN | 100 | all | Полный доступ ко всем отелям |
| HOTEL_ADMIN | 80 | hotel | Администратор одного отеля |
| DEPARTMENT_MANAGER | 50 | department | Менеджер отдела |
| STAFF | 10 | department | Сотрудник отдела |

### Permissions vs Roles

```javascript
// ❌ ПЛОХО - hardcoded роли
if (user.role === 'ADMIN') { showSettings() }

// ✅ ХОРОШО - проверка permissions
if (hasPermission('settings:manage')) { showSettings() }

// ✅ ЛУЧШЕ - использовать capabilities с бэкенда
if (user.capabilities.canManageSettings) { showSettings() }
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

## 🔄 Data Flow

```
┌──────────────┐     Request      ┌──────────────┐
│   Frontend   │ ────────────────>│   Backend    │
│              │                  │              │
│  - Uses      │                  │  - Validates │
│    capabilities                 │    permissions│
│  - Shows     │                  │  - Computes  │
│    status    │<────────────────│    status    │
│    from API  │     Response     │    colors    │
└──────────────┘                  └──────────────┘
```

### API Request Flow

```
1. Frontend: GET /api/inventory?department_id=xxx
2. Backend:
   - authMiddleware: Verify JWT, attach user
   - hotelIsolation: Filter by user's hotel_id
   - requirePermission('products', 'read')
   - Service: Get data with hotel_id filter
   - ExpiryService: Enrich batches with status/colors
3. Response: { batches: [...enriched], permissions: {...} }
```

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
- [Permissions Model](./PERMISSIONS.md)
- [Audit Implementation](./AUDIT_IMPLEMENTATION_REPORT.md)
- [Mobile UX Guidelines](./MOBILE_UX.md)
