/**
 * validateRequiredEnv - Validate required environment variables on startup
 * Exits process if critical variables are missing
 */

export function validateRequiredEnv() {
  const baseRequired = [
    'JWT_SECRET',
    'DATABASE_URL',
    'APP_URL' // Критично для ссылок в письмах!
  ]

  const missing = baseRequired.filter(key => !process.env[key])
  
  // Email provider specific
  const emailProvider = process.env.EMAIL_PROVIDER || 'resend'
  
  if (emailProvider === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      missing.push('RESEND_API_KEY')
    }
    if (!process.env.RESEND_WEBHOOK_SECRET) {
      console.warn('⚠️  RESEND_WEBHOOK_SECRET not set - webhooks will be UNSECURED!')
    }
  } else if (emailProvider === 'smtp') {
    const smtpRequired = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    const smtpMissing = smtpRequired.filter(key => !process.env[key])
    missing.push(...smtpMissing)
  }
  
  // Telegram (optional, but если есть, проверяем)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('⚠️  TELEGRAM_WEBHOOK_SECRET not set - webhooks will be UNSECURED!')
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`  - ${key}`))
    console.error('\nPlease set these variables in your .env file or environment.')
    process.exit(1)
  }

  // Format validation
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters')
    console.error(`   Current length: ${process.env.JWT_SECRET.length}`)
    process.exit(1)
  }
  
  if (process.env.APP_URL && !process.env.APP_URL.startsWith('http')) {
    console.error('❌ APP_URL must start with http:// or https://')
    console.error(`   Current value: ${process.env.APP_URL}`)
    process.exit(1)
  }

  console.log('✓ All required environment variables present')
}
