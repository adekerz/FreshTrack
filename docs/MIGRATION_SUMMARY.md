# Database Migration Summary (Jan–Feb 2026)

> Последнее обновление: 3 февраля 2026  
> Команда: FreshTrack core

## 📦 Применённые миграции

| ID | Файл | Статус | Кратко |
| --- | --- | --- | --- |
| 047 | `047_email_otp_verification.sql` | ✅ | Таблица `email_verification_tokens`, TTL, индексы; используется для подтверждения email отделов. |
| 048 | `048_audit_logs_metadata.sql` | ✅ | `audit_logs` получил `metadata JSONB`, `snapshot_after`, `ip_address`, новые индексы. |
| 049 | `049_audit_permissions.sql` | ✅ | Матрица прав на аудит (`audit_permissions`, сиды для ролей). |
| 050a | `050_audit_severity_extended.sql` | ✅ | Severity уровни, `current_hash/previous_hash`, подготовка hash chain. |
| 050b | `050_hotel_coordinates.sql` | ✅ | Геоданные (`latitude`, `longitude`, `timezone`) для отелей, индексы для поиска. |
| 051 | `051_fix_kazakhstan_timezones.sql` | ✅ | Исправлены таймзоны KZ отелей/отделов (Almaty/Aqtobe). |
| 054 | `054_scheduled_exports.sql` | ✅ | Таблицы `scheduled_exports` и `scheduled_export_logs`, FK на departments, audit поля. |

> ⚠️ Нумерация `050` встречается дважды (a/b) — применять строго в указанном порядке.

## 🔁 Порядок выполнения

```bash
cd server
npm run db:migrate

# или вручную
for file in 047_email_otp_verification.sql \
            048_audit_logs_metadata.sql \
            049_audit_permissions.sql \
            050_audit_severity_extended.sql \
            050_hotel_coordinates.sql \
            051_fix_kazakhstan_timezones.sql \
            054_scheduled_exports.sql; do
  psql $DATABASE_URL -f server/db/migrations/$file
done
```

Скрипт `npm run db:migrate` запускает `psql` с `-v ON_ERROR_STOP=1`, поэтому пайплайн останавливается при первой ошибке.

## 🔍 Post-migration checks

1. **Email OTP**
   ```sql
   SELECT COUNT(*) FROM email_verification_tokens WHERE expires_at > now();
   ```
2. **Audit metadata**
   ```sql
   SELECT DISTINCT severity FROM audit_logs ORDER BY 1;
   SELECT COUNT(*) FROM audit_logs WHERE metadata ? 'exportId';
   ```
3. **Geo/timezone**
   ```sql
   SELECT id, timezone FROM hotels WHERE country = 'KZ';
   SELECT COUNT(*) FROM hotels WHERE latitude IS NULL OR longitude IS NULL;
   ```
4. **Scheduled exports**
   ```sql
   SELECT COUNT(*) FROM scheduled_exports;
   SELECT COUNT(*) FROM scheduled_export_logs;
   ```

## 🧯 Rollback plan

| ID | Действие | Риск |
| --- | --- | --- |
| 047 | `DROP TABLE email_verification_tokens;` | Потеря активных запросов на подтверждение. |
| 048/050a | `ALTER TABLE audit_logs DROP COLUMN ...` | Ломает hash chain и отчётность — не рекомендуется, лучше оставить default значения. |
| 050b | `ALTER TABLE hotels DROP COLUMN latitude, longitude, timezone;` | Потеря координат, делайте `pg_dump` заранее. |
| 051 | Повторно запустить миграцию с корректными таймзонами | Скрипт идемпотентен. |
| 054 | `DROP TABLE scheduled_export_logs; DROP TABLE scheduled_exports;` + отключить cron | Откатывает всю фичу; требуется выключить `ScheduledExportService`. |

Перед destructive действиями обязательно: `pg_dump -Fc $DATABASE_URL > backup_before_rollback.dump`.

## ⏱️ Cron и сервисы

- `ScheduledExportService` читает `scheduled_exports` каждую минуту и пишет в `scheduled_export_logs`.
- `EmailVerificationService` удаляет просроченные токены (использует TTL из 047).
- `AuditIntegrityJob` строит hash chain на основании столбцов из 050a.

## 🧭 Связанные документы

- [ARCHITECTURE_MIGRATION.md](./ARCHITECTURE_MIGRATION.md) — high-level эволюция серверной архитектуры.
- [EXPORT_SYSTEM_IMPLEMENTATION.md](./EXPORT_SYSTEM_IMPLEMENTATION.md) — как используется миграция 054.
- [RESEND_WEBHOOKS_AND_EMAIL.md](./RESEND_WEBHOOKS_AND_EMAIL.md) — взаимодействие Email/Telegram.
- `server/db/migrations/README` — памятка по созданию новых SQL скриптов.

## ✅ Статус

Все перечисленные миграции применены на production (Railway) и staging окружениях. Следующая запланированная миграция — `055_push_notifications.sql` (push/SSE enrichment).
