# Деплой FreshTrack на Railway

> Обновлено: 3 февраля 2026

После `railway link` проект привязан к окружению Railway. Ниже — что можно делать.

## Auto-deploy из GitHub

1. В Railway Dashboard → проект → **Settings** → **Connect Repo** (или **Source**).
2. Подключите репозиторий и выберите ветку (например `main`).
3. При каждом пуше в эту ветку Railway собирает и деплоит сервис.
4. **Check suites (опционально):** в **Settings** → **Deploy** включите «Wait for GitHub checks», чтобы деплой стартовал только после успешных тестов.

Если деплой не подтянул последний коммит — проверьте выбранную ветку, логи билда и не отключён ли сервис.

## 1. Переменные окружения

```bash
railway variables                    # Показать переменные
railway variables --json             # JSON (для копирования)
railway variables set KEY=value      # Добавить/изменить
```

**Важно:** Если в проекте Railway есть **PostgreSQL**, `DATABASE_URL` обычно задаётся автоматически. Убедись, что сервис FreshTrack имеет к нему доступ (общие переменные проекта или ссылка на Postgres).

Дополнительно для FreshTrack часто нужны:
- `TELEGRAM_BOT_TOKEN` — бот Telegram
- `JWT_SECRET` — секрет для JWT
- `EMAIL_*` / Resend — если используешь почту

## 2. Миграции БД

Перед первым деплоем примени миграции к Railway Postgres:

```bash
railway run sh -c "cd server && npm run migrate"
```

Проверить статус миграций:

```bash
railway run sh -c "cd server && npm run migrate:status"
```

## 3. Деплой

```bash
railway up                           # Собрать и задеплоить из текущей папки
```

Либо подключи **GitHub-репозиторий** к проекту Railway — деплой будет по пушу в выбранную ветку.

## 4. Локальный запуск с Railway-переменными

Проверить, что приложение поднимается с БД Railway:

```bash
railway run sh -c "cd server && node index.js"
```

Или миграции + старт:

```bash
railway run sh -c "cd server && npm run migrate && node index.js"
```

## 5. Логи и статус

```bash
railway logs                         # Логи деплоя/приложения
railway logs -f                      # Стрим логов
railway status                       # Статус сервиса
railway open                         # Открыть проект в браузере
```

## 6. Полезные команды

| Команда | Описание |
|--------|----------|
| `railway link` | Привязать к другому проекту/окружению |
| `railway environment` | Текущее окружение |
| `railway run <cmd>` | Выполнить команду с переменными Railway |
| `railway up` | Деплой |
| `railway open` | Dashboard в браузере |

## Порядок первого деплоя

1. `railway link` (уже сделано).
2. Убедиться, что в проекте есть Postgres и `DATABASE_URL` доступен сервису FreshTrack.
3. Задать переменные из [RAILWAY_ENV_VARIABLES.md](./RAILWAY_ENV_VARIABLES.md) или `server/.env.example`: `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, `APP_URL`, `CORS_ORIGINS` и т.д.
4. `railway run sh -c "cd server && npm run migrate"`.
5. При необходимости отключить scheduled exports в dev: `DISABLE_SCHEDULED_EXPORTS=true`.

## После деплоя

- **Health:** `curl https://your-app.railway.app/api/health` — должен вернуть 200.
- **Cron:** в логах должно быть `Scheduled exports service started` (если не задан `DISABLE_SCHEDULED_EXPORTS=true`).
- **MFA:** для production убедитесь, что `DISABLE_MFA_IN_DEV` не используется или выключен; SUPER_ADMIN обязан настроить MFA в течение grace period.

Фронт обычно деплоится отдельно (Vite на Vercel); backend — этот сервис Railway. См. [VERCEL_QUICK_SETUP.md](./VERCEL_QUICK_SETUP.md) и [VERCEL_PORKBUN_SETUP.md](./VERCEL_PORKBUN_SETUP.md).
