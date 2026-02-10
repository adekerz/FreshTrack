# FreshTrack — Prompt Templates

## Контекст по умолчанию
- Стек: Node.js + Express + PostgreSQL · React + Vite + TanStack Query
- Middleware chain: `authMiddleware → hotelIsolation → departmentIsolation → requirePermission`
- `req.hotelId` — всегда (не `req.user.hotel_id`)
- Серверные данные — TanStack Query с `queryKeys.*` (не useState)
- Бизнес-логика — только в services
- Есть сомнение → спроси перед кодом

---

## Backend Prompts

### Новый API endpoint
```
Реализуй backend endpoint: <ОПИСАНИЕ>

Стек: Node.js + Express + PostgreSQL (raw pool.query)
Middleware chain: authMiddleware → hotelIsolation → departmentIsolation → requirePermission('resource', 'action')
Используй req.hotelId и req.departmentId — не req.user.hotel_id
Zod schema валидация входных данных
Бизнес-логика в service, не в controller
hotel_id = req.hotelId в каждом SQL-запросе
AuditService.logAction() для мутаций
User-friendly ошибки, logError для логирования

Покажи: route file · Zod schema · service · пример response
```

### Критичный endpoint (SUPER_ADMIN / destructive)
```
Реализуй критичный endpoint: <ОПИСАНИЕ>

Middleware: authMiddleware → requireMFA → requirePermission (SUPER_ADMIN)
hotelIsolation если нужна изоляция отеля
AuditService.logAction() + SecurityAlertService.sendAlert() при подозрительной активности
Grace period support в requireMFA

Покажи: route · middleware chain · grace period handling · security alert · edge cases
```

### Export endpoint
```
Реализуй export endpoint: <ЧТО ЭКСПОРТИРОВАТЬ> (формат: xlsx/csv/pdf)

Middleware chain:
authMiddleware → hotelIsolation → departmentIsolation
→ requirePermission(EXPORT, READ) → requireMFA → rateLimitExportWithAlert → requireAllowlistedIP

ExportService.sendExport() с audit logging
MAX_EXPORT_ROWS лимит + понятная ошибка если превышен
X-Export-ID header в response

Покажи: route · middleware chain · ExportService вызов · size limit · error handling
```

### Рефакторинг существующего endpoint
```
Рефакторинг endpoint в файле: <ФАЙЛ>

Исправь:
- hotelAdminOnly() / departmentManagerOnly() → requirePermission
- req.user.hotel_id → req.hotelId (добавь hotelIsolation если нет)
- Бизнес-логика в controller → перенести в service
- Параметризованные SQL запросы (если строковая конкатенация)
- Отсутствующий audit logging
- WHERE archived = FALSE (audit_logs)

НЕ меняй архитектуру, НЕ добавляй таблицы, НЕ добавляй лишние фичи.
Покажи до/после + чеклист изменений.
```

---

## Frontend Prompts

### Новый хук / data layer
```
Реализуй React Query хук: <ОПИСАНИЕ>

TanStack Query v5 (useQuery / useMutation)
queryKey из queryKeys.* фабрики — не строки вручную
apiFetch из src/services/api.js
Нормализация snake_case → camelCase в queryFn
staleTime из STALE_TIMES константы
placeholderData: keepPreviousData для пагинации
После мутации — invalidateQueries для связанных данных
onError → toast.error(error.message || t('errors.generic'))

Покажи: hook file · queryKey · нормализация · invalidation
```

### Новый компонент / страница
```
Реализуй React компонент: <ОПИСАНИЕ>

React 18 + TanStack Query + TailwindCSS
Данные через useQuery / useMutation хуки (не useState + apiFetch)
Loading → skeleton, Error → ErrorMessage + onRetry, Empty → EmptyState, Success → toast
disabled={isPending} на кнопках submit
Mobile-first (touch ≥ 48px, flex-col md:flex-row)
i18n через useTranslation()
Permissions из API: {permissions?.canEdit && <EditButton />}
Интеграция в Router

Покажи: компонент · хук (если нужен) · i18n ключи · Router integration
```

### SUPER_ADMIN hotel switch
```
Добавь поддержку переключения отеля для SUPER_ADMIN в: <КОМПОНЕНТ/ХУК>

X-Hotel-Id header отправляется в apiFetch автоматически при выбранном отеле
При смене отеля: queryClient.clear() или queryClient.invalidateQueries()
UI показывает текущий отель, дропдаун со списком всех отелей
hotelId берётся из активного отеля в контексте SUPER_ADMIN

Покажи: компонент переключателя · invalidation при смене · как hotelId передаётся в хуки
```

### UI ↔ Backend аудит
```
Проведи аудит Frontend ↔ Backend для модуля: <МОДУЛЬ>

Найди:
- UI элементы без соответствующего API endpoint
- API endpoints без UI
- Несовпадение полей (snake_case vs camelCase, отсутствующие поля)
- Role checks на фронте вместо permissions из API
- useState где должен быть useQuery
- Ручные строки queryKey вместо queryKeys.*
- Мутации без invalidateQueries

Результат в таблице: | Проблема | Файл:строка | Что исправить |
Код не пиши — только анализ.
```

---

## Full-Stack Prompts

### Фича end-to-end
```
Реализуй фичу end-to-end: <ОПИСАНИЕ>

1. Backend:
   - Middleware chain: auth → hotelIsolation → departmentIsolation → requirePermission
   - req.hotelId везде
   - Бизнес-логика в service
   - AuditService.logAction()
   - Zod validation

2. Frontend:
   - useQuery / useMutation хуки
   - queryKeys.* фабрика
   - invalidateQueries после мутаций
   - Все states: loading/error/empty/success
   - Mobile-first, i18n

3. Security checklist: RBAC · MFA (если нужно) · audit · rate limiting
4. Edge cases: 401/403 (не дублировать) · 429 · empty · double submit

Пиши ВСЕ файлы целиком. Фича должна работать end-to-end.
```

---

## Security Prompts

### Code Review
```
Security code review файла: <ФАЙЛ>

Проверь:
- req.user.hotel_id вместо req.hotelId (обход hotelIsolation)
- hotelAdminOnly() / departmentManagerOnly() (deprecated)
- Отсутствующий hotelIsolation в middleware chain
- Hardcoded role checks
- Отсутствующий requirePermission
- SQL injection (строковая конкатенация)
- Отсутствующий audit logging для мутаций
- DELETE audit_logs (вместо archived = TRUE)
- console.log вместо logError

Формат:
🔴 BLOCKER — data breach / security hole
🟡 MAJOR — security weakness
🟢 MINOR — best practices

Итог: готово / не готово для production
Код не переписывай.
```

### Migration Review
```
Проверь SQL миграцию: <ФАЙЛ>

- Backwards compatible? (no column drop без fallback)
- Indexes для new foreign keys?
- NOT NULL без default value?
- Затрагивает audit_logs? → hash chain integrity?
- Rollback strategy?

Покажи: что может сломаться · rollback SQL · testing checklist
```

---

## Быстрые команды

| Задача | Промпт |
|---|---|
| Новый endpoint | `backend endpoint: <описание>` |
| Export endpoint | `export endpoint: <что/формат>` |
| Критичный SA endpoint | `mfa endpoint: <описание>` |
| Рефакторинг endpoint | `refactor endpoint: <файл>` |
| Новый хук | `query hook: <описание>` |
| Новый компонент | `frontend component: <описание>` |
| SA hotel switch | `hotel switch: <компонент>` |
| Фича целиком | `full-stack: <описание>` |
| Security review | `security review: <файл>` |
| UI↔Backend аудит | `ui-backend audit: <модуль>` |
| Migration review | `migration review: <файл>` |

---

## Emergency

### Production Bug
```
СРОЧНО: баг в production.
Симптомы: <ОПИСАНИЕ>
Затронутые отели/пользователи: <ЕСЛИ ИЗВЕСТНО>

1. Где ошибка (logs, endpoint, service)?
2. Root cause
3. Hotfix — минимальное изменение, не ломает другое
4. Long-term fix
5. Как предотвратить

Приоритет: BLOCKER
```

### Security Incident
```
SECURITY INCIDENT: <ОПИСАНИЕ>

1. Scope — затронутые отели, пользователи, данные
2. Immediate mitigation — что заблокировать прямо сейчас
3. Audit logs — что показывает hash chain
4. GDPR — кого уведомить
5. Root cause + prevention

Приоритет: CRITICAL
```

---

## Финальная проверка перед кодом

Фича **НЕ ГОТОВА** если:
- Middleware chain неполный (нет hotelIsolation или requirePermission)
- Используется `req.user.hotel_id` вместо `req.hotelId`
- Бизнес-логика в controller
- TanStack Query не используется (useState для server data)
- Ручные строки queryKey
- Мутация без invalidateQueries
- Нет всех states (loading/error/empty/success)
- Нет i18n keys
- Ломает hash chain integrity
