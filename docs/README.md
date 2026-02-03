# FreshTrack Docs Index

> Обновлено: 3 февраля 2026

Рабочая документация по архитектуре, фичам, деплоям и QA.

## Структура

| Файл | Категория | Описание |
| --- | --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура | Backend = source of truth, RBAC, capabilities, scheduled exports pipeline, offline/SSE |
| [ARCHITECTURE_MIGRATION.md](./ARCHITECTURE_MIGRATION.md) | Архитектура | Эволюция v2 → v3.1, модули, API endpoints |
| [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) | БД | Миграции 047–054, порядок применения, rollback |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Фичи | Статус централизованного экспорта и scheduled exports |
| [EXPORT_SYSTEM_IMPLEMENTATION.md](./EXPORT_SYSTEM_IMPLEMENTATION.md) | Фичи | Экспорт: типы, backend/frontend, безопасность |
| [OFFLINE_SYNC.md](./OFFLINE_SYNC.md) | Фичи | Offline: React Query persistence, useOfflineMutation, IndexedDB |
| [HOTEL_IDENTIFICATION.md](./HOTEL_IDENTIFICATION.md) | Домены | hotel_id, marsha_code, external_ids |
| [MARSHA_CODES.md](./MARSHA_CODES.md) | Домены | Справочник Marsha кодов |
| [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) | Домены | Мультитенантность, hash chain |
| [AUDIT_SPEC_REFERENCE.md](./AUDIT_SPEC_REFERENCE.md) | Audit | Спецификация API аудита |
| [AUDIT_CHECKLIST.md](./AUDIT_CHECKLIST.md) | Audit | Чеклист ревью |
| [AUDIT_IMPLEMENTATION_REPORT.md](./AUDIT_IMPLEMENTATION_REPORT.md) | Audit | Архитектура audit trail |
| [AUDIT_SECURITY_NOTES.md](./AUDIT_SECURITY_NOTES.md) | Audit | Security заметки |
| [MOBILE_CHECKLIST.md](./MOBILE_CHECKLIST.md) | Mobile | Responsive UX чеклист |
| [MOBILE_UX.md](./MOBILE_UX.md) | Mobile | UX-гайды |
| [REACT_QUERY_MIGRATION.md](./REACT_QUERY_MIGRATION.md) | Frontend | Миграция на React Query |
| [RESEND_WEBHOOKS_AND_EMAIL.md](./RESEND_WEBHOOKS_AND_EMAIL.md) | Интеграции | Email, Resend, вложения |
| [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) | Деплой | Backend на Railway, auto-deploy, миграции |
| [RAILWAY_ENV_VARIABLES.md](./RAILWAY_ENV_VARIABLES.md) | Деплой | Переменные окружения (эталон: server/.env.example) |
| [RAILWAY_ENV_QUICK_REFERENCE.md](./RAILWAY_ENV_QUICK_REFERENCE.md) | Деплой | Шпаргалка Railway |
| [VERCEL_QUICK_SETUP.md](./VERCEL_QUICK_SETUP.md) | Деплой | Frontend на Vercel |
| [VERCEL_PORKBUN_SETUP.md](./VERCEL_PORKBUN_SETUP.md) | Деплой | DNS, Porkbun |
| [QA_TESTING.md](./QA_TESTING.md) | QA | Чеклисты: scheduled exports, SSE, viewport, Lighthouse |
| [ACCESSIBILITY.md](./ACCESSIBILITY.md) | QA | Lighthouse, Axe, WCAG, i18n/формы |
| [api/openapi.yaml](./api/openapi.yaml) | API | OpenAPI/Swagger |

Рефакторинг документации (объединение offline-документов, обновление архитектуры, деплоя и QA) выполнен 03.02.2026.
