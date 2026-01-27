# Railway Environment Variables - Quick Reference

## 🔴 Минимальный набор (обязательно)

```bash
JWT_SECRET=your-secret-key-minimum-32-characters-long
APP_URL=https://your-domain.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=FreshTrack <onboarding@resend.dev>
```

## 🟡 Рекомендуемый набор

```bash
# Обязательные
JWT_SECRET=your-secret-key-minimum-32-characters-long
APP_URL=https://your-domain.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=FreshTrack <onboarding@resend.dev>

# Рекомендуемые
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret
NODE_ENV=production
```

## 📋 Полный список для копирования

Скопируйте и замените значения на свои:

```bash
JWT_SECRET=your-secret-key-minimum-32-characters-long
APP_URL=https://freshtrack.systems
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=FreshTrack <onboarding@resend.dev>
CORS_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems
ALLOWED_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems
RESEND_WEBHOOK_SECRET=whsec_your_webhook_secret
NODE_ENV=production
JWT_EXPIRES_IN=7d
MFA_ISSUER=FreshTrack
MFA_TOTP_WINDOW=1
MAX_EXPORT_ROWS=10000
EXPORT_RATE_LIMIT_MAX=10
EXPORT_RATE_LIMIT_WINDOW=3600
DATA_RETENTION_YEARS=7
GDPR_CONTACT_EMAIL=privacy@freshtrack.systems
AUDIT_VERIFICATION_INTERVAL=21600000
```

## ⚠️ Важно

- `DATABASE_URL` устанавливается Railway автоматически (не нужно добавлять вручную)
- `JWT_SECRET` должен быть минимум 32 символа
- `APP_URL` должен начинаться с `http://` или `https://`
- Замените `your-domain.com` на ваш реальный домен
