# Railway Environment Variables

> Обновлено: 3 февраля 2026

Список переменных окружения для настройки FreshTrack на Railway. Актуальный эталон — `server/.env.example`.

## 🔴 Обязательные переменные

Эти переменные **обязательны** для запуска приложения:

### Базовая конфигурация
```bash
# JWT Secret (минимум 32 символа!)
JWT_SECRET=your-secret-key-minimum-32-characters-long-change-in-production

# URL приложения (для ссылок в письмах и CORS)
APP_URL=https://your-domain.com

# База данных (Railway автоматически устанавливает, если подключена PostgreSQL)
# Если Railway не установил автоматически, добавьте вручную:
DATABASE_URL=postgresql://user:password@host:port/database
```

### Email конфигурация (Resend)
```bash
# Email провайдер
EMAIL_PROVIDER=resend

# Resend API Key (обязателен, если EMAIL_PROVIDER=resend)
RESEND_API_KEY=re_your_resend_api_key_here

# Email отправитель
EMAIL_FROM=FreshTrack <onboarding@resend.dev>
```

## 🟡 Рекомендуемые переменные

Эти переменные **рекомендуются** для безопасности и полной функциональности:

### CORS и безопасность
```bash
# Разрешенные домены для CORS (через запятую)
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Webhooks (безопасность)
```bash
# Resend Webhook Secret (для верификации webhooks от Resend)
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret

# Telegram Webhook Secret (если используете Telegram)
TELEGRAM_WEBHOOK_SECRET=tgwhsec_your_telegram_webhook_secret
```

### Telegram Bot (опционально)
```bash
# Telegram Bot Token (если используете Telegram уведомления)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Использовать polling вместо webhooks (для разработки)
TELEGRAM_POLLING=false
```

### Мониторинг и логирование
```bash
# Sentry DSN для отслеживания ошибок (опционально)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 🟢 Опциональные переменные

Эти переменные имеют значения по умолчанию, но могут быть настроены:

### Окружение
```bash
# Окружение (development/production)
NODE_ENV=production

# Порт (Railway обычно устанавливает автоматически)
PORT=3001
```

### JWT
```bash
# Время жизни JWT токена
JWT_EXPIRES_IN=7d
```

### MFA (Multi-Factor Authentication)
```bash
# Название приложения для MFA
MFA_ISSUER=FreshTrack

# Окно допуска для TOTP (в шагах)
MFA_TOTP_WINDOW=1
```

### Лимиты экспорта и scheduled exports
```bash
# Максимальное количество строк в экспорте
MAX_EXPORT_ROWS=10000
EXPORT_RATE_LIMIT_MAX=10
EXPORT_RATE_LIMIT_WINDOW=3600000

# Отключить cron запланированных экспортов (например, в dev)
DISABLE_SCHEDULED_EXPORTS=false
```

### IP Allowlist
```bash
# Разрешенные IP адреса (через запятую, оставьте пустым для отключения)
ALLOWED_IPS=
# Пример: ALLOWED_IPS=1.2.3.4,5.6.7.8
```

### GDPR и хранение данных
```bash
# Годы хранения данных
DATA_RETENTION_YEARS=7

# Email для GDPR запросов
GDPR_CONTACT_EMAIL=privacy@your-domain.com
```

### Audit Trail
```bash
# Интервал проверки целостности audit trail (в миллисекундах)
# 21600000 = 6 часов
AUDIT_VERIFICATION_INTERVAL=21600000
```

## 📝 Пример полной конфигурации для Railway

```bash
# ═══════════════════════════════════════════════════════════════
# ОБЯЗАТЕЛЬНЫЕ
# ═══════════════════════════════════════════════════════════════
JWT_SECRET=your-very-long-secret-key-minimum-32-characters-for-security
APP_URL=https://freshtrack.systems
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=FreshTrack <onboarding@resend.dev>

# ═══════════════════════════════════════════════════════════════
# РЕКОМЕНДУЕМЫЕ
# ═══════════════════════════════════════════════════════════════
CORS_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems
ALLOWED_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret
NODE_ENV=production

# ═══════════════════════════════════════════════════════════════
# ОПЦИОНАЛЬНЫЕ (если нужны)
# ═══════════════════════════════════════════════════════════════
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=tgwhsec_your_telegram_webhook_secret
TELEGRAM_POLLING=false
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
MFA_ISSUER=FreshTrack
GDPR_CONTACT_EMAIL=privacy@freshtrack.systems
```

## ⚠️ Важные замечания

1. **DATABASE_URL**: Railway автоматически устанавливает эту переменную, если вы подключили PostgreSQL базу данных. Не нужно устанавливать вручную, если база подключена.

2. **JWT_SECRET**: Должен быть минимум 32 символа! Используйте длинный случайный ключ для безопасности.

3. **APP_URL**: Должен начинаться с `http://` или `https://`. Используется для генерации ссылок в письмах.

4. **RESEND_API_KEY**: Обязателен, если `EMAIL_PROVIDER=resend`. Без него приложение не запустится.

5. **RESEND_WEBHOOK_SECRET**: Рекомендуется для безопасности webhooks. Без него webhooks будут небезопасными.

6. **CORS_ORIGINS**: Укажите все домены, с которых будет доступ к API (включая www поддомен).

## 🔧 Как добавить переменные в Railway

1. Откройте ваш проект в Railway
2. Перейдите в **Variables** (Переменные)
3. Нажмите **+ New Variable**
4. Добавьте каждую переменную по отдельности
5. После добавления Railway автоматически перезапустит приложение

## 🚨 Решение проблем

### Приложение не запускается с ошибкой "Missing required environment variables"
- Проверьте, что все обязательные переменные установлены
- Убедитесь, что `JWT_SECRET` минимум 32 символа
- Проверьте, что `APP_URL` начинается с `http://` или `https://`

### Email не работает
- Проверьте `RESEND_API_KEY` - он должен быть валидным ключом от Resend
- Убедитесь, что `EMAIL_FROM` использует домен, подтвержденный в Resend

### CORS ошибки
- Проверьте `CORS_ORIGINS` и `ALLOWED_ORIGINS`
- Убедитесь, что домен фронтенда указан в этих переменных
- Не используйте `localhost` в production
