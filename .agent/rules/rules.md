---
trigger: always_on
---

# FreshTrack — Project Rules

## Язык
- ВСЕГДА Отвечай **на русском**
- Комментарии в коде — **на русском**
- ВСЕГДА UI тексты — только через i18n ключи

---

## Проект

**FreshTrack** — enterprise система управления инвентарем для отелей (multi-tenant).

| | |
|---|---|
| **Backend** | Node.js 20+ · Express 4.18 · PostgreSQL 16 (raw pool.query) |
| **Frontend** | React 18.2 · Vite 5.x · TailwindCSS 3.4 · TanStack Query v5 |
| **Auth** | JWT · MFA (TOTP + backup codes) · httpOnly cookies |
| **i18n** | i18next · 8 языков (RU, EN, KK, DE, FR, ES, IT, AR) |
| **Security** | Hash chain audit trail · Rate limiting · IP allowlist |

**Роли:** `SUPER_ADMIN` (100) → `HOTEL_ADMIN` (80) → `DEPARTMENT_MANAGER` (50) → `STAFF` (10)

**SUPER_ADMIN** имеет доступ ко **всем** отелям и переключает активный отель через UI-переключатель (передаётся как `X-Hotel-Id` header в каждом запросе).

---

## Стиль ответа

- Кратко, по делу, без пересказа условия
- **Сначала код — потом чеклист**
- Пиши **весь код целиком** — без `// ...`, `// TODO`, заглушек
- Если задача требует нескольких файлов — пиши все

```
// Формат ответа:
[1-2 предложения что делаем]

[полный рабочий код — все файлы]

Checklist:
[ ] ...
[ ] ...

⚠️ Security: [если есть]
```

---

## Принцип осознанной разработки

Перед кодом проверь **4 вопроса**:

**1. Нужно ли это?**
- Решает реальную задачу пользователя отеля?
- Не дублирует существующее?

**2. Безопасно ли?**
- Middleware chain: `authMiddleware → hotelIsolation → departmentIsolation → requirePermission`
- `req.hotelId` — всегда, никогда `req.user.hotel_id` в бизнес-логике
- MFA: `requireMFA` на критичных endpoints
- Audit: все мутации логируются с hash chain
- Rate limiting: export/webhook защищены

**3. Не ломает ли архитектуру?**
- Бизнес-логика — только в services, не в controller
- Permissions — только на backend, fail closed (403)
- Hash chain integrity сохраняется (no DELETE audit_logs)
- SQL параметризован, hotel_id всегда в WHERE

**4. UX приемлем?**
- ≤ 3 клика до результата
- Mobile-first (touch ≥ 48px)
- Все states: loading / error / empty / success
- i18n keys
- Мутация → инвалидация TanStack Query

**Есть сомнение — СПРОСИ. Не делай.**

---

## Запреты

### Архитектурные (БЕЗ ЯВНОГО РАЗРЕШЕНИЯ):
- Новые таблицы БД
- Изменение схем БД
- Изменение auth / RBAC / MFA flow
- Новые роли
- Изменение hash chain логики

Если архитектура реально нужна:
1. Написать: **«Требуется архитектурное решение»**
2. Дать 2–3 варианта с trade-offs
3. Ждать выбора — только потом код

### Технологические (не вводить без запроса):
| Запрещено | Вместо |
|---|---|
| Prisma / TypeORM | Raw PostgreSQL `pool.query()` |
| Next.js / Remix | React + Vite |
| NestJS / Fastify | Express |
| Redux / MobX | TanStack Query + React state |
| Redis / Kafka / RabbitMQ | Только если явно нужно |
| GraphQL / WebSockets | Только если явно нужно |

### В коде:
- `TODO`, `FIXME`, `mock`, `stub`, заглушки — запрещены
- `console.log` → `logInfo`/`logError`/`logWarn`
- Inline styles → TailwindCSS
- Magic numbers → named constants
- SQL injection (строковая конкатенация) → параметризованные запросы

### Deprecated (не использовать):
- `hotelAdminOnly()` — deprecated, вместо `requirePermission`
- `departmentManagerOnly()` — deprecated, вместо `requirePermission`
- `req.user.hotel_id` в бизнес-логике → `req.hotelId`

---

## Полная реализация фичи

Фича **НЕ готова**, пока нельзя использовать end-to-end.

### Backend chain (обязательный порядок):
```
authMiddleware → hotelIsolation → departmentIsolation
→ requirePermission → requireMFA? → validate(Zod)
→ controller → service → repository (SQL) → AuditService → response
```

**Backend checklist:**
- [ ] Middleware chain полный: auth → hotelIsolation → departmentIsolation → requirePermission
- [ ] `req.hotelId` (не `req.user.hotel_id`) в бизнес-логике
- [ ] Zod schema валидация
- [ ] Логика в `services/`, controller только HTTP
- [ ] Параметризованный SQL: `WHERE hotel_id = $1`
- [ ] Транзакция при нескольких операциях
- [ ] `AuditService.logAction()` для всех мутаций
- [ ] `WHERE archived = FALSE` для audit_logs
- [ ] `requireMFA` на критичных endpoints
- [ ] `rateLimitExportWithAlert` для export
- [ ] try-catch, user-friendly ошибки, `logError`

### Frontend chain:
```
useQuery/useMutation (TanStack Query) → queryKeys factory
→ apiFetch → normalizeBatch/normalize* → UI states → invalidateQueries
```

**Frontend checklist:**
- [ ] TanStack Query: `useQuery` / `useMutation` (не useState для server data)
- [ ] `queryKeys.*` из фабрики (не строки вручную)
- [ ] `invalidateQueries` после каждой мутации
- [ ] Loading / Error / Empty / Success states все
- [ ] `disabled={isPending}` на кнопках
- [ ] Mobile-first, touch ≥ 48px
- [ ] i18n keys
- [ ] `{permissions?.canEdit && ...}`
- [ ] Интеграция в Router + навигация

### Edge cases (обязательно обработать):
- 401 → глобально в `apiFetch` (не дублировать)
- 403 → глобально в `apiFetch` (не дублировать)
- 429 → `toast.error(t('errors.rateLimit'))`
- MFA grace period → banner + redirect
- Email не верифицирован → redirect
- Network timeout → retry в apiFetch (3 попытки для GET)
- Double submit → `isPending` из useMutation
- Empty state → `<EmptyState>` компонент
- Large dataset → пагинация с `keepPreviousData`

---

## Security Patterns

### RBAC:
```javascript
// ✅ Правильно — все новые endpoints
authMiddleware, hotelIsolation, requirePermission('batches', 'create')

// ❌ Запрещено — deprecated
hotelAdminOnly()
if (req.user.role === 'HOTEL_ADMIN') { ... }
```

### hotel_id isolation:
```javascript
// ✅ После hotelIsolation
const hotelId = req.hotelId

// ✅ SQL с dept фильтром
const deptFilter = req.canAccessAllDepartments ? '' : 'AND department_id = $2'
const params = req.canAccessAllDepartments ? [req.hotelId] : [req.hotelId, req.departmentId]

// ❌ Обход изоляции
const hotelId = req.user.hotel_id   // не нормализован!
const hotelId = req.query.hotel_id  // не проверен!
```

### Audit Trail (hash chain):
```javascript
// ✅ Все мутации
await AuditService.logAction({
  entityType: 'BATCH', entityId: batch.id, action: 'UPDATE',
  userId: req.user.id, hotelId: req.hotelId,
  snapshotBefore: oldBatch, snapshotAfter: updatedBatch
})

// ✅ НИКОГДА DELETE — только архивация
UPDATE audit_logs SET archived = TRUE WHERE created_at < NOW() - INTERVAL '7 years'
SELECT * FROM audit_logs WHERE hotel_id = $1 AND archived = FALSE
```

### Export Protection:
```javascript
router.get('/export/products',
  authMiddleware, hotelIsolation, departmentIsolation,
  requirePermission(PermissionResource.EXPORT, PermissionAction.READ),
  requireMFA,
  rateLimitExportWithAlert,    // 10/hour + SecurityAlertService
  requireAllowlistedIP,
  controller
)
```

---

## MFA
```javascript
// requireMFA middleware — grace period
if (req.user.mfa_required && !req.user.mfa_enabled) {
  if (Date.now() < new Date(req.user.mfa_grace_period_ends)) {
    res.setHeader('X-MFA-Warning', `${daysLeft} days left`)
    return next()   // grace period — пропускаем с предупреждением
  }
  return res.status(403).json({ error: 'MFA required' })
}
```

---

## Абсолютные запреты

| Запрет | Почему | Вместо |
|---|---|---|
| `req.user.hotel_id` в бизнес-логике | Обход hotelIsolation | `req.hotelId` |
| Hardcoded роли в коде | Ломает RBAC | `requirePermission` |
| `hotelAdminOnly()` | Deprecated | `requirePermission` |
| Бизнес-решения в UI | Backend ≠ source of truth | На backend |
| Permission fallback | Security hole | Fail closed 403 |
| DELETE audit_logs | Breaks hash chain | `archived = TRUE` |
| `console.log` | Security risk | `logInfo`/`logError` |
| SQL injection | Critical vuln | Параметризованные запросы |
| `useState` для server data | Race conditions | TanStack Query |
| Ручные строки queryKey | Cache invalidation bugs | `queryKeys.*` |

---

## Production Readiness

Фича готова к production если:
- [ ] Middleware chain полный (auth → hotelIsolation → requirePermission)
- [ ] `req.hotelId` везде
- [ ] Security checklist пройден
- [ ] Все states (loading/error/empty/success)
- [ ] Mobile протестировано
- [ ] Audit logging работает
- [ ] Hash chain integrity сохраняется
- [ ] i18n keys (не hardcoded)
- [ ] Мутации инвалидируют queries
- [ ] Performance < 1s response

---

## Emergency

**Production Bug:**
1. Анализ логов → root cause
2. Hotfix — минимальное изменение
3. Deploy
4. Post-mortem + prevention

**Security Incident:**
1. Оценить scope (affected hotels? data breach?)
2. Immediate mitigation (block IP / disable feature)
3. Audit logs analysis (hash chain верифицировать)
4. Notify users (GDPR)
5. Root cause fix
