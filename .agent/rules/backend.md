# FreshTrack — Backend Rules

## Стек
- Node.js 20+ · Express 4.18 · PostgreSQL 16 (raw `pool.query()`)
- JWT · Bcrypt · Zod · OTPLib
- **Не используем:** Prisma, TypeORM, NestJS, Fastify

## Роли и уровни доступа
| Роль | Level | Scope |
|---|---|---|
| `SUPER_ADMIN` | 100 | ALL — все отели, все данные |
| `HOTEL_ADMIN` | 80 | HOTEL — только свой отель |
| `DEPARTMENT_MANAGER` | 50 | DEPARTMENT — только свой отдел |
| `STAFF` | 10 | DEPARTMENT — только свой отдел |

**SUPER_ADMIN переключает активный отель через `X-Hotel-Id` header** — это штатный механизм, не баг.

## Идентификаторы
- `hotel_id` (UUID) — основной идентификатор в бизнес-логике
- `marsha_code` — только при регистрации отеля, никогда как FK

---

## Middleware Chain — ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК

```javascript
// Стандартный endpoint
router.get('/endpoint',
  authMiddleware,       // JWT → req.user
  hotelIsolation,       // → req.hotelId (с учётом SUPER_ADMIN X-Hotel-Id)
  departmentIsolation,  // → req.departmentId, req.canAccessAllDepartments
  requirePermission('resource', 'action'),
  controller
)

// Критичный endpoint (SUPER_ADMIN)
router.delete('/hotels/:id',
  authMiddleware,
  requireMFA,
  requirePermission(PermissionResource.HOTELS, PermissionAction.DELETE),
  controller
)

// Export endpoint
router.get('/export/products',
  authMiddleware,
  hotelIsolation,
  departmentIsolation,
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,   // 10/hour + SecurityAlertService
  requireAllowlistedIP,
  controller
)

// Webhook endpoint — БЕЗ authMiddleware
router.post('/webhook',
  verifyWebhookSignature,   // Svix или secret token
  rateLimiter(60),
  controller
)
```

### `req.hotelId` — главное правило
После `hotelIsolation` middleware используй **ТОЛЬКО `req.hotelId`** в ЛЮБОЙ бизнес-логике — он уже нормализован с учётом роли:
- Обычный пользователь: `req.user.hotel_id`
- SUPER_ADMIN: из `X-Hotel-Id` header / query / body, или первый активный отель

```javascript
// ✅ Правильно — всегда используем req.hotelId после hotelIsolation
const hotelId = req.hotelId
await pool.query('SELECT * FROM products WHERE hotel_id = $1', [req.hotelId])

// ❌ КРИТИЧЕСКАЯ ОШИБКА — обходит hotelIsolation, создаёт риск cross-hotel access
const hotelId = req.user.hotel_id      // SUPER_ADMIN получит неверный ID!
const hotelId = req.query.hotel_id     // Можно подделать!
const hotelId = req.body.hotel_id      // Не прошло через middleware!
```

**Правило:** `req.user.hotel_id` доступен ТОЛЬКО в самом middleware `hotelIsolation`. В контроллерах, сервисах, репозиториях — ТОЛЬКО `req.hotelId`.

---

## Permissions (RBAC)

```javascript
// ✅ Всегда через requirePermission
requirePermission('batches', 'create')
requirePermission(PermissionResource.EXPORT, PermissionAction.READ)

// ❌ Запрещено — deprecated, не использовать
hotelAdminOnly()
departmentManagerOnly()
if (user.role === 'HOTEL_ADMIN') { ... }
if (allowedRoles.includes(user.role)) { ... }
```

- Права берутся из таблицы `role_permissions`
- Fail closed — нет права → 403, никогда не пропускать
- Новая роль = INSERT в `role_permissions`, нулевых изменений кода
- `superAdminOnly` — только для эндпоинтов исключительно для SA

---

## Архитектура: Controller vs Service

### Controller — ТОЛЬКО HTTP слой (строго запрещена бизнес-логика):
```javascript
// ✅ Правильно — controller только оркестрирует
async function getBatches(req, res) {
  try {
    const schema = z.object({ /* ... */ })
    const params = schema.parse(req.query)
    
    // Вызов service — вся логика там
    const result = await BatchService.getBatches(req.hotelId, req.departmentId, params)
    
    res.json(result)
  } catch (error) {
    logError('BatchController', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// ❌ ЗАПРЕЩЕНО — бизнес-логика в контроллере (ТЕХНИЧЕСКИЙ ДОЛГ)
async function getBatches(req, res) {
  const { rows } = await pool.query('SELECT * FROM batches WHERE hotel_id = $1', [req.hotelId])
  
  // ❌ Расчёт статусов — это бизнес-логика!
  const batches = rows.map(batch => {
    const daysLeft = Math.ceil((new Date(batch.expiry_date) - Date.now()) / (1000*60*60*24))
    let status = 'active'
    if (daysLeft <= 0) status = 'expired'
    else if (daysLeft <= 3) status = 'critical'  // порог "3" — это бизнес-правило!
    return { ...batch, status, daysLeft }
  })
  
  res.json(batches)
}
```

**Ответственность Controller:**
- ✅ Получить `req` → распарсить/валидировать (Zod)
- ✅ Вызвать `service.method(req.hotelId, ...)`
- ✅ Отдать `res` (JSON / Buffer для exports)
- ✅ try/catch + logError
- ❌ **НИКАКИХ** вычислений дат, статусов, порогов, бизнес-правил
- ❌ **НИКАКИХ** прямых SQL запросов (только через service/repository)

### Service — ВСЯ бизнес-логика:
```javascript
// ✅ Правильно — вся логика в сервисе
class BatchService {
  static async getBatches(hotelId, departmentId, params) {
    // SQL через repository
    const batches = await BatchRepository.findByHotel(hotelId, departmentId, params)
    
    // Бизнес-логика расчёта статусов
    return batches.map(batch => ({
      ...batch,
      ...ExpiryService.calculateBatchStatus(batch.expiry_date, batch.hotel_id)
    }))
  }
}

class ExpiryService {
  static calculateBatchStatus(expiryDate, hotelId) {
    // Получаем пороги из настроек отеля (не hardcode!)
    const thresholds = this.getHotelThresholds(hotelId) // { critical: 3, warning: 7 }
    
    const daysLeft = Math.ceil((new Date(expiryDate) - Date.now()) / (1000*60*60*24))
    let status = 'active'
    if (daysLeft <= 0) status = 'expired'
    else if (daysLeft <= thresholds.critical) status = 'critical'
    else if (daysLeft <= thresholds.warning) status = 'warning'
    
    return { status, daysLeft }
  }
}
```

**Ответственность Service:**
- ✅ Вся бизнес-логика (расчёты, правила, пороги)
- ✅ Оркестрация нескольких repository
- ✅ Транзакции при сложных операциях
- ✅ `AuditService.logAction()` для мутаций
- ✅ Переиспользуется в schedulers, webhooks, CLI

### Repository — ТОЛЬКО SQL:
```javascript
// ✅ Правильно — только параметризованный SQL
class BatchRepository {
  static async findByHotel(hotelId, departmentId, params) {
    const deptFilter = params.canAccessAllDepartments ? '' : 'AND department_id = $2'
    const queryParams = params.canAccessAllDepartments ? [hotelId] : [hotelId, departmentId]
    
    const { rows } = await pool.query(
      `SELECT * FROM batches WHERE hotel_id = $1 ${deptFilter} AND archived = FALSE`,
      queryParams
    )
    return rows
  }
}
```

---

### Миграция технического долга:
**Существующий код в контроллерах с бизнес-логикой — это ТЕХНИЧЕСКИЙ ДОЛГ.**

- ❌ Не копируй этот паттерн в новый код
- ✅ Весь новый код пиши по правилам: **Controller → Service → Repository**
- ✅ При рефакторинге старого кода — переноси логику из контроллеров в services

---

## Изоляция данных

```javascript
// ✅ SQL — всегда hotel_id из req.hotelId
const { rows } = await pool.query(
  'SELECT * FROM products WHERE hotel_id = $1 AND archived = FALSE',
  [req.hotelId]
)

// ✅ С учётом department (если не canAccessAllDepartments)
const deptFilter = req.canAccessAllDepartments ? '' : 'AND department_id = $2'
await pool.query(
  `SELECT * FROM batches WHERE hotel_id = $1 ${deptFilter}`,
  req.canAccessAllDepartments ? [req.hotelId] : [req.hotelId, req.departmentId]
)

// ❌ ЗАПРЕЩЕНО — cross-hotel
SELECT * FROM products WHERE id = $1   -- нет hotel_id!
```

**НИКОГДА `DELETE FROM audit_logs`** — только архивация:
```sql
UPDATE audit_logs SET archived = TRUE WHERE created_at < NOW() - INTERVAL '7 years'
SELECT * FROM audit_logs WHERE hotel_id = $1 AND archived = FALSE
```

---

## SQL Patterns

```javascript
// ✅ Параметризованный запрос
const { rows } = await pool.query(
  'SELECT * FROM products WHERE hotel_id = $1 AND id = $2',
  [req.hotelId, productId]
)

// ✅ Транзакция при нескольких операциях
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('UPDATE ...', [...])
  await client.query('INSERT ...', [...])
  await client.query('COMMIT')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
}

// ❌ SQL injection
`SELECT * FROM products WHERE id = ${productId}`
```

---

## Audit Logging

```javascript
// Все мутации CREATE/UPDATE/DELETE
await AuditService.logAction({
  entityType: 'BATCH',          // AuditEntityType enum
  entityId: batch.id,
  action: 'UPDATE',             // AuditAction enum: CREATE | UPDATE | DELETE
  userId: req.user.id,
  hotelId: req.hotelId,
  snapshotBefore: oldBatch,
  snapshotAfter: updatedBatch
})
// previous_hash / current_hash — через триггер БД автоматически
```

---

## MFA Patterns

```javascript
// Setup: generate → verify → enable
const { qrCode, backupCodes } = await MFAService.setupMFA(userId, userName)
await MFAService.verifyTOTP(userId, code, ipAddress, userAgent)
await MFAService.enableMFA(userId)

// Login: credentials → MFA check → full token
const user = await AuthService.verifyCredentials(login, password)
if (user.mfa_enabled) return { requiresMFA: true, partialToken }
await MFAService.verifyTOTP(userId, code, ipAddress, userAgent)

// requireMFA middleware — grace period
if (req.user.mfa_required && !req.user.mfa_enabled) {
  const graceEnds = new Date(req.user.mfa_grace_period_ends)
  if (Date.now() < graceEnds) {
    res.setHeader('X-MFA-Warning', `${daysLeft} days left`)
    return next()
  }
  return res.status(403).json({ error: 'MFA required' })
}
```

---

## Export Pattern

```javascript
const result = await ExportService.sendExport({
  data, format: 'xlsx', filename: 'products',
  user: req.user, ipAddress: req.ip,
  userAgent: req.get('user-agent'), entityType: 'product'
})
res.setHeader('X-Export-ID', result.exportId)
res.setHeader('Content-Type', result.contentType)
res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
res.send(result.buffer)
```

---

## Ошибки и логирование

```javascript
// ✅ Правильно
try {
  // ...
} catch (error) {
  logError('ModuleName', error, { action: 'operationName', userId: req.user?.id })
  res.status(500).json({ success: false, error: 'Ошибка сервера' })
}

// ❌ Запрещено
console.log(error)
res.status(500).json({ error: error.stack })
```

Логи: `logInfo` / `logError` / `logWarn` из `../../utils/logger.js`.
Security events → `SecurityAlertService.sendAlert()`.

---

## req.user структура (после authMiddleware)
```javascript
req.user = {
  id, login, name, email,
  role,                    // SUPER_ADMIN | HOTEL_ADMIN | DEPARTMENT_MANAGER | STAFF
  hotel_id,               // null для SUPER_ADMIN
  department_id,
  is_owner,               // boolean
  mfa_enabled,            // boolean
  mfa_required,           // boolean
  mfa_grace_period_ends,  // Date | null
  hotel,                  // объект Hotel (если есть hotel_id)
  department              // объект Department (если есть department_id)
}

// После hotelIsolation:
req.hotelId              // нормализованный hotel_id

// После departmentIsolation:
req.departmentId         // нормализованный department_id
req.canAccessAllDepartments  // boolean
```

---

## Сервисы проекта
| Сервис | Назначение |
|---|---|
| `ExpiryService` | Расчёт статусов партий (expired/critical/warning/good) |
| `StatisticsService` | Статистика инвентаря по отелю |
| `MFAService` | TOTP + backup codes |
| `AuditIntegrityService` | Проверка hash chain |
| `SecurityAlertService` | Алерты для SUPER_ADMIN |
| `ExportService` / `AuditExportService` | Экспорт + audit logging |
| `EmailService` / `EmailVerificationService` | Шаблоны + верификация |
| `FilterService` | Парсинг общих фильтров запросов |
| `CollectionService` | Логика сборов/списаний |
| `ScheduledExportService` | Плановые экспорты |

---

## СТОП — не пиши код если:
- Нет `req.hotelId` (не прошло через `hotelIsolation`)
- Нет `requirePermission`
- Нужна новая таблица или изменение схемы БД → спроси сначала
- Нужно менять auth / RBAC / MFA / hash chain flow → спроси сначала
