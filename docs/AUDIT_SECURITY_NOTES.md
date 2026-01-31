# Security Notes — Журнал аудита (Audit Logs)

## Реализованные меры

### MFA для export endpoints
- **GET /api/audit-logs/export** — `requireMFA` в цепочке (generic xlsx/csv/json).
- **GET /api/audit-logs/export/pdf** — `requireMFA`.
- **GET /api/audit-logs/export/excel** — `requireMFA`.

Критичные экспорты доступны только после прохождения MFA (с учётом grace period для SUPER_ADMIN).

### Rate limiting на export
- Лимитер: **10 запросов в час** на клиента (`exportLimiter`, `EXPORT_RATE_LIMIT_MAX` / `EXPORT_RATE_LIMIT_WINDOW`).
- На PDF/Excel и generic export используется `rateLimitExportWithAlert`: при превышении лимита отправляется security alert.
- Заголовки ответа: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` при 429.

### Permissions: HOTEL_ADMIN только свой отель
- На всех маршрутах журнала аудита стоит **hotelIsolation**: выбор отеля из `req.hotelId` (для HOTEL_ADMIN — свой отель, для SUPER_ADMIN — из query `hotel_id`).
- Чтение логов, stats, users, stream, export — данные только по `req.hotelId`.
- Права: `requirePermission(PermissionResource.AUDIT, PermissionAction.READ | EXPORT)`; роль не проверяется напрямую, только через permissions.

### SSE: проверка прав и изоляция
- **GET /api/audit-logs/stream**: `authMiddleware` → `hotelIsolation` → `requirePermission(AUDIT, READ)`.
- При broadcast рассылка идёт только клиентам, у которых `connection.hotelId === log.hotel_id` или `connection.role === 'SUPER_ADMIN'`.

### IP только для security events
- В **AuditDetailsModal** IP отображается только для действий: `LOGIN`, `LOGOUT`, `PASSWORD_CHANGED`, `EMAIL_CHANGED`, `MFA_ENABLED`, `MFA_DISABLED`.
- В таблице журнала колонка IP не выводится; IP доступен только в модалке деталей и только для перечисленных типов событий.

### Hash chain integrity
- Таблица **audit_logs** не изменялась (нет новых полей, влияющих на хэш-цепочку).
- Удаление записей из audit_logs не добавлялось; используется только архивация (`archived = TRUE`) по политике хранения.
- Новые сущности: **audit_logs_metadata** (метаданные), SSE, export — не участвуют в расчёте hash chain.

### Метаданные в отдельной таблице
- Человекочитаемые поля и severity хранятся в **audit_logs_metadata** (связь по `audit_log_id`).
- Таблица **audit_logs** остаётся единственным источником для цепочки хэшей и архивации.
