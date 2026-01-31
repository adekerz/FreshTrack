# Журнал действий — соответствие спеки и реализации

Спека из задачи **уже реализована** в проекте. Ниже — где что лежит и отличия от текста спеки (номера миграций, имена методов, схема permissions).

---

## Фаза 1: Backend — читаемость и обогащение

| Спека | Реализация |
|-------|------------|
| Миграция **046** audit_logs_metadata | Используется **048_audit_logs_metadata.sql** (046 занят под fix_audit_hash_function_types). В 048: `audit_log_id UUID REFERENCES audit_logs(id)` (в проекте id — UUID, не BIGINT). |
| **AuditEnrichmentService.js** | `server/services/AuditEnrichmentService.js` — generateHumanReadableDescription, generateHumanReadableDetails, parseUserAgent (ua-parser-js), getSeverity, enrichAuditLog, enrichExistingLogs. |
| **AuditService.logAction()** | В проекте метод называется **log()**. После `logAudit()` вызывается `AuditEnrichmentService.enrichAuditLog()` (async, non-blocking) и в production — `broadcastAuditLog()`. |
| **GET /audit-logs** с фильтрами | `server/modules/audit/audit.controller.js`: фильтры через `UnifiedFilterService.parseCommonFilters`, выборка через `getAuditLogsWithMetadata` из `server/db/database.js`, обогащение через `AuditService.enrichAuditLog`. Есть severity, securityOnly, userId, departmentId. |
| **GET /audit-logs/stats** | Реализован, возвращает по дням count, critical_count, important_count, normal_count. |
| **GET /audit-logs/users** | Реализован, список пользователей с action_count для фильтра. |
| **POST /audit-logs/enrich** | Реализован, права `audit:manage`, вызов `AuditEnrichmentService.enrichExistingLogs(limit)`. |

---

## Фаза 2: Frontend

| Спека | Реализация |
|-------|------------|
| **AuditLogsPage.jsx** | `src/pages/AuditLogsPage.jsx` — фильтры, пагинация (offset/limit), severity, users/departments, SSE-баннер, кнопки PDF/Excel, ExportButton, i18n. |
| **ActivityChart.jsx** | `src/components/audit/ActivityChart.jsx` — Chart.js, два ряда (всего / критичные), блок «Активность за 7 дней», i18n. |
| **AuditDetailsModal.jsx** | `src/components/audit/AuditDetailsModal.jsx` — Modal из ui, время/пользователь/действие/детали, браузер/ОС/IP (только для security events), сворачиваемый JSON snapshots, i18n. |

---

## Фаза 3: SSE

| Спека | Реализация |
|-------|------------|
| **audit.sse.js** | `server/modules/audit/audit.sse.js` — sseConnections Map, auditLogsSSE (headers, clientId, heartbeat 30s), broadcastAuditLog с проверкой hotelId/SUPER_ADMIN, enrichLogForBroadcast через `query` из postgres.js (не pool). |
| **GET /audit-logs/stream** | Маршрут с `authMiddleware`, `hotelIsolation`, `requirePermission(AUDIT, READ)`, затем `auditLogsSSE`. |
| **AuditService broadcast** | В конце `log()` при `NODE_ENV === 'production'` вызывается `broadcastAuditLog(logRow)`. |
| **useAuditSSE.js** | `src/hooks/useAuditSSE.js` — EventSource с токеном в query (`API_BASE_URL/audit-logs/stream?token=...`), newLogs (макс. 10), clearNewLogs. |
| Токен в SSE | В проекте ключ `freshtrack_token`; auth middleware поддерживает `req.query.token` для SSE. |

---

## Фаза 4: Export

| Спека | Реализация |
|-------|------------|
| **AuditExportService.js** | `server/services/AuditExportService.js` — generatePDF (PDFKit), generateExcel (ExcelJS), своя formatDate (без frontend). |
| **GET /export/pdf, /export/excel** | Реализованы с `authMiddleware`, `hotelIsolation`, `requireMFA`, `rateLimitExportWithAlert`, `requirePermission(AUDIT, EXPORT)`, хелпер `getFilteredLogsForExport(req)`, audit logging. |
| **getFilteredLogs** | Реализован как `getFilteredLogsForExport(req)` — те же фильтры, что и GET /audit-logs, через getAuditLogsWithMetadata + enrich, лимит MAX_EXPORT_ROWS. |
| Кнопки PDF/Excel на фронте | В header AuditLogsPage — кнопки «PDF» и «Excel», скачивание через fetch blob с текущими фильтрами, i18n (auditLogs.exportPdf, exportExcel). |

---

## Фаза 5: Permissions

| Спека | Реализация |
|-------|------------|
| Миграция **047** audit_permissions | Используется **049_audit_permissions.sql** (047 занят под email_otp_verification). |
| Схема role_permissions | В проекте: таблица `permissions` (resource, action, scope) и `role_permissions` (role, permission_id). Ресурс для аудита — **audit** (PermissionResource.AUDIT), не audit_logs. |
| Права | Добавлены permissions: audit export all/hotel, audit write all. SUPER_ADMIN — export+write all; HOTEL_ADMIN — export hotel. Чтение уже было в 004/024. |

---

## Критичные ограничения (соблюдены)

- Таблица **audit_logs** не менялась (структура и hash chain).
- Удаление записей не добавлялось (только архивация).
- Метаданные — в отдельной таблице **audit_logs_metadata**.
- Запросы параметризованные; везде изоляция по hotel_id.

---

## Документы

- **docs/AUDIT_CHECKLIST.md** — чеклист выполнения (backend/frontend/testing).
- **docs/AUDIT_SECURITY_NOTES.md** — MFA, rate limit, permissions, SSE, IP только для security events, hash chain, метаданные.

Если нужно что-то доработать под новую версию спеки — укажи фазу и пункт.
