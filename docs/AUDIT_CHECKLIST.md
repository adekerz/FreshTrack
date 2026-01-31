# Checklist выполнения — Журнал аудита (Audit Logs)

## Backend

| Пункт | Статус | Примечание |
|-------|--------|------------|
| AuditEnrichmentService.js | ✅ | `server/services/AuditEnrichmentService.js` |
| Обновить AuditService.log() | ✅ | Вызов enrich + broadcast (logAction в чеклисте = log в коде) |
| GET /audit-logs с фильтрами | ✅ | action, entityType, dateFrom, dateTo, userId, departmentId, severity, securityOnly, pagination |
| GET /audit-logs/stats | ✅ | По дням за N дней, critical_count, important_count |
| GET /audit-logs/users | ✅ | Список пользователей с action_count для фильтра |
| POST /audit-logs/enrich | ✅ | Обогащение существующих логов (limit из query) |
| SSE GET /audit-logs/stream | ✅ | `server/modules/audit/audit.sse.js`, token в query |
| AuditExportService (PDF + Excel) | ✅ | `server/services/AuditExportService.js` |
| Export endpoints с MFA | ✅ | requireMFA, rateLimitExportWithAlert на /export/pdf и /export/excel |
| npm: ua-parser-js, pdfkit, exceljs | ✅ | В `server/package.json` (exceljs, pdfkit, ua-parser-js) |

## Frontend

| Пункт | Статус | Примечание |
|-------|--------|------------|
| AuditLogsPage.jsx | ✅ | Фильтры, пагинация, severity, users/departments, SSE banner |
| ActivityChart.jsx | ✅ | `src/components/audit/ActivityChart.jsx` (Chart.js) |
| AuditDetailsModal.jsx | ✅ | `src/components/audit/AuditDetailsModal.jsx` (Modal + JSON) |
| useAuditSSE.js | ✅ | `src/hooks/useAuditSSE.js` |
| Export buttons (PDF + Excel) | ✅ | Кнопки в header: PDF и Excel → GET /export/pdf, /export/excel |
| i18n для новых текстов | ✅ | auditLogs.* в en.json (newRecords, refreshList, exportPdf, exportExcel, severity, activity, stats, details, technicalDataJson и др.) |
| Mobile responsive | ✅ | Таблица скрыта на md, карточки на mobile, min-h-[48px], touch targets |

## Testing (ручная проверка)

| Пункт | Действие |
|-------|----------|
| Обогащение логов (POST /enrich) | Вызвать POST /api/audit-logs/enrich?limit=50 (с правами audit:manage) |
| Фильтры работают | Проверить actionType, entityType, даты, userId, departmentId, severity, securityOnly |
| Real-time (SSE) | Открыть страницу журнала, в другом окне выполнить действие → баннер «X новых записей» |
| Export PDF читаемый | Нажать PDF → файл с заголовком, легендой критичности, списком записей |
| Export Excel с цветами | Нажать Excel → строки critical/important с заливкой |
| Permissions | HOTEL_ADMIN видит только свой отель (hotelIsolation) |
| Mobile UI | Адаптивная вёрстка, карточки вместо таблицы, кнопки ≥ 48px |
| График активности | Блок «Активность за 7 дней» + два ряда (всего / критичные) |
| Детальный просмотр | Кнопка «Подробнее» → модалка с временем, пользователем, действием, деталями, браузер/ОС/IP, JSON snapshots |

## Запуск сервера и миграции

- Backend: `cd server && npm install && node index.js`
- Миграция 049 (audit permissions): применяется при старте сервера из `server/db/database.js`
- Frontend: `npm run dev`
