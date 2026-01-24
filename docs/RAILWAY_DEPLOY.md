# Деплой FreshTrack на Railway

После `railway link` проект привязан к окружению Railway. Ниже — что можно делать.

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
3. Задать при необходимости `JWT_SECRET`, `TELEGRAM_BOT_TOKEN` и т.д.
4. `railway run sh -c "cd server && npm run migrate"`.
5. `railway up`.
6. `railway logs` — проверить, что сервер стартовал и healthcheck ок.

После деплоя фронт обычно отдаётся тем же сервером (статика из `dist` или `public`) либо деплоится отдельно (Vite/Vercel и т.д.) — смотри конфиг `nixpacks.toml` и `railway.json`.
