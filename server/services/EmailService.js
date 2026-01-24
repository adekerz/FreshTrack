/**
 * Email Service for FreshTrack
 * Supports: Resend (recommended), SMTP (Nodemailer), SendGrid
 * 
 * Configuration via environment variables:
 * - EMAIL_PROVIDER: 'resend' | 'smtp' | 'sendgrid'
 * - RESEND_API_KEY: Resend API key
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP settings
 * - SENDGRID_API_KEY: SendGrid API key
 */

import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { logInfo, logWarn, logError } from '../utils/logger.js'
import { query } from '../db/database.js'

// Email configuration - единый источник правды
export const EMAIL_FROM = {
  system: 'FreshTrack System <system@freshtrack.systems>',
  noreply: 'FreshTrack <no-reply@freshtrack.systems>',
}

// По умолчанию используем system@ для всех писем
const DEFAULT_FROM = EMAIL_FROM.system

// Email provider configuration
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Initialize Resend client (singleton)
let resendClient = null
if (EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY)
  console.log('✅ Resend client initialized')
} else if (EMAIL_PROVIDER === 'resend') {
  console.warn('⚠️ Resend provider selected but RESEND_API_KEY not found')
}

/**
 * Get Resend client instance (for webhook verification, etc.)
 */
export function getResendClient() {
  return resendClient
}

/**
 * Recipient resolver: USER vs DEPARTMENT.
 * USER: auth, invites → user.email.
 * DEPARTMENT: expiry alerts, daily reports → department.email.
 * If DEPARTMENT and department.email missing → null and log warning.
 */
export function resolveEmailRecipient(target, { user, department }) {
  if (target === 'USER') {
    if (!user?.email || typeof user.email !== 'string' || !String(user.email).trim()) return null
    return String(user.email).trim()
  }
  if (target === 'DEPARTMENT') {
    const email = department?.email
    if (!email || typeof email !== 'string' || !String(email).trim()) {
      logWarn('EmailService', `Department ${department?.name ?? 'unknown'} has no email; skipping system email`)
      return null
    }
    return String(email).trim()
  }
  return null
}

// Transporter instance
let transporter = null

/**
 * Initialize email transporter based on provider
 */
async function initTransporter() {
  if (transporter) return transporter

  switch (EMAIL_PROVIDER) {
    case 'resend':
      // Resend uses their own API, we'll handle it separately
      console.log('📧 Email provider: Resend')
      return null

    case 'sendgrid':
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      })
      console.log('📧 Email provider: SendGrid')
      break

    case 'smtp':
    default:
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
      console.log('📧 Email provider: SMTP')
      break
  }

  // Verify connection
  try {
    await transporter.verify()
    console.log('✅ Email transporter verified')
  } catch (error) {
    console.error('❌ Email transporter verification failed:', error.message)
  }

  return transporter
}

/**
 * Send email via Resend API
 */
async function sendViaResend(options) {
  if (!resendClient) {
    throw new Error('Resend client not initialized. Check RESEND_API_KEY environment variable.')
  }

  const result = await resendClient.emails.send({
    from: options.from || DEFAULT_FROM,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text
  })

  return result
}

/**
 * Send email (universal method)
 */
export async function sendEmail(options) {
  const { to, subject, html, text, from } = options

  try {
    // Определяем отправителя: если не указан явно, используем DEFAULT_FROM
    const sender = from || DEFAULT_FROM

    if (EMAIL_PROVIDER === 'resend') {
      const result = await sendViaResend({
        ...options,
        from: sender
      })
      console.log(`📧 Email sent via Resend to ${to}: ${subject}`)
      return result
    }

    await initTransporter()
    
    const result = await transporter.sendMail({
      from: sender,
      to,
      subject,
      html,
      text
    })

    console.log(`📧 Email sent to ${to}: ${subject}`)
    return result
  } catch (error) {
    console.error('❌ Email send error:', error)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════

/**
 * Base email template wrapper
 */
function emailTemplate(content, options = {}) {
  const { title = 'FreshTrack' } = options
  
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo h1 {
      color: #FF8D6B;
      font-size: 28px;
      margin: 0;
    }
    .content {
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background: #FF8D6B;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background: #E67D5B;
    }
    .footer {
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
    .code {
      background: #f5f5f5;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 4px;
      text-align: center;
      color: #FF8D6B;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>🍊 FreshTrack</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} FreshTrack. Все права защищены.</p>
        <p>Это автоматическое письмо, не отвечайте на него.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Welcome email after registration
 */
export async function sendWelcomeEmail(user, hotel = null) {
  const content = `
    <h2>Добро пожаловать в FreshTrack! 👋</h2>
    <p>Привет, <strong>${user.name}</strong>!</p>
    <p>Ваш аккаунт успешно создан.</p>
    ${hotel ? `
      <p>Вы подали заявку на присоединение к отелю <strong>${hotel.name}</strong>.</p>
      <p>Администратор отеля рассмотрит вашу заявку в ближайшее время.</p>
    ` : `
      <p>Для начала работы вам нужно присоединиться к отелю или дождаться приглашения от администратора.</p>
    `}
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}" class="button">Открыть FreshTrack</a>
    </p>
  `

  return sendEmail({
    to: user.email,
    subject: 'Добро пожаловать в FreshTrack! 🍊',
    html: emailTemplate(content, { title: 'Добро пожаловать' })
  })
}

/**
 * Send welcome email with temporary password (USER email)
 * Used when admin creates a new user
 */
export async function sendWelcomeEmailWithPassword({ to, userName, temporaryPassword, hotelName, loginUrl }) {
  if (!to || !userName || !temporaryPassword) {
    logWarn('EmailService', 'Missing required parameters for welcome email with password')
    return null
  }

  const loginUrlFinal = loginUrl || `${APP_URL}/login`
  const hotelNameFinal = hotelName || 'FreshTrack'

  const content = `
    <h2 style="margin-top: 0;">🎉 Добро пожаловать в FreshTrack!</h2>
    <p>Здравствуйте, <strong>${userName}</strong>!</p>
    
    <p>Для вас создан аккаунт в системе FreshTrack для отеля <strong>${hotelNameFinal}</strong>.</p>
    
    <div style="background: white; border: 2px solid #FF8D6B; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-weight: 600;">Ваш временный пароль:</p>
      <div style="font-size: 24px; font-weight: bold; color: #FF8D6B; font-family: monospace; letter-spacing: 2px; word-break: break-all;">
        ${temporaryPassword}
      </div>
    </div>
    
    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
      <p style="margin: 0;"><strong>⚠️ Важно!</strong> Это временный пароль. При первом входе система попросит вас изменить его на постоянный.</p>
    </div>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="${loginUrlFinal}" class="button">Войти в систему</a>
    </p>
    
    <h3 style="margin-top: 30px;">📋 Инструкция:</h3>
    <ol style="line-height: 1.8;">
      <li>Перейдите по ссылке выше или откройте <a href="${loginUrlFinal}">${loginUrlFinal}</a></li>
      <li>Введите ваш email: <strong>${to}</strong></li>
      <li>Введите временный пароль (скопируйте из письма)</li>
      <li>Придумайте новый надежный пароль</li>
      <li>Начните работу с системой!</li>
    </ol>
    
    <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>🔒 Требования к паролю:</strong></p>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Минимум 8 символов</li>
        <li>Хотя бы одна заглавная буква (A-Z)</li>
        <li>Хотя бы одна строчная буква (a-z)</li>
        <li>Хотя бы одна цифра (0-9)</li>
        <li>Хотя бы один спецсимвол (!@#$%^&*-_=+)</li>
      </ul>
    </div>
    
    <p>Если у вас возникли вопросы, свяжитесь с администратором вашего отеля.</p>
    
    <p>С уважением,<br><strong>Команда FreshTrack</strong></p>
  `

  const text = `
Добро пожаловать в FreshTrack!

Здравствуйте, ${userName}!

Для вас создан аккаунт в системе FreshTrack для отеля ${hotelNameFinal}.

Ваш временный пароль: ${temporaryPassword}

⚠️ ВАЖНО! Это временный пароль. При первом входе система попросит вас изменить его.

Инструкция:
1. Откройте: ${loginUrlFinal}
2. Введите ваш email: ${to}
3. Введите временный пароль
4. Придумайте новый надежный пароль

Требования к паролю:
- Минимум 8 символов
- Заглавные и строчные буквы
- Цифры
- Спецсимволы (!@#$%^&*-_=+)

С уважением,
Команда FreshTrack
  `

  try {
    return await sendEmail({
      to,
      from: EMAIL_FROM.noreply,
      subject: `Добро пожаловать в FreshTrack - ${hotelNameFinal}`,
      html: emailTemplate(content, { title: 'Добро пожаловать' }),
      text
    })
  } catch (error) {
    logError('EmailService', `Failed to send welcome email with password to ${to}`, error)
    throw error
  }
}

/**
 * Join request approved email
 */
export async function sendJoinApprovedEmail(user, hotel, department = null) {
  const content = `
    <h2>Заявка одобрена! ✅</h2>
    <p>Привет, <strong>${user.name}</strong>!</p>
    <p>Ваша заявка на присоединение к отелю <strong>${hotel.name}</strong> была одобрена.</p>
    ${department ? `<p>Вы добавлены в департамент: <strong>${department.name}</strong></p>` : ''}
    <p>Теперь вы можете начать работу в системе.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}" class="button">Начать работу</a>
    </p>
  `

  return sendEmail({
    to: user.email,
    subject: 'Заявка одобрена — добро пожаловать в команду! ✅',
    html: emailTemplate(content, { title: 'Заявка одобрена' })
  })
}

/**
 * Join request rejected email
 */
export async function sendJoinRejectedEmail(user, hotel, reason = null) {
  const content = `
    <h2>Заявка отклонена</h2>
    <p>Привет, <strong>${user.name}</strong>.</p>
    <p>К сожалению, ваша заявка на присоединение к отелю <strong>${hotel.name}</strong> была отклонена.</p>
    ${reason ? `<p><strong>Причина:</strong> ${reason}</p>` : ''}
    <p>Если у вас есть вопросы, обратитесь к администратору отеля.</p>
  `

  return sendEmail({
    to: user.email,
    subject: 'Заявка на присоединение отклонена',
    html: emailTemplate(content, { title: 'Заявка отклонена' })
  })
}

/**
 * Password reset email
 */
export async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`
  
  const content = `
    <h2>Сброс пароля 🔐</h2>
    <p>Привет, <strong>${user.name}</strong>!</p>
    <p>Вы запросили сброс пароля для вашего аккаунта FreshTrack.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="button">Сбросить пароль</a>
    </p>
    <p>Или скопируйте эту ссылку в браузер:</p>
    <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
    <p><strong>Ссылка действительна 1 час.</strong></p>
    <p style="color: #888; font-size: 14px;">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
  `

  return sendEmail({
    to: user.email,
    from: EMAIL_FROM.noreply, // no-reply для auth писем
    subject: 'Сброс пароля FreshTrack 🔐',
    html: emailTemplate(content, { title: 'Сброс пароля' })
  })
}

/**
 * Email verification
 */
export async function sendVerificationEmail(user, verificationCode) {
  const content = `
    <h2>Подтверждение email 📧</h2>
    <p>Привет, <strong>${user.name}</strong>!</p>
    <p>Для подтверждения вашего email адреса введите код:</p>
    <div class="code">${verificationCode}</div>
    <p style="text-align: center; margin-top: 16px; color: #888;">
      Код действителен 15 минут
    </p>
  `

  return sendEmail({
    to: user.email,
    from: EMAIL_FROM.noreply, // no-reply для auth писем
    subject: 'Подтверждение email — FreshTrack',
    html: emailTemplate(content, { title: 'Подтверждение email' })
  })
}

/**
 * New join request notification for admins
 */
export async function sendNewJoinRequestEmail(admin, user, hotel) {
  const content = `
    <h2>Новая заявка на присоединение 📋</h2>
    <p>Привет, <strong>${admin.name}</strong>!</p>
    <p>Новый пользователь хочет присоединиться к вашему отелю:</p>
    <ul>
      <li><strong>Имя:</strong> ${user.name}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Отель:</strong> ${hotel.name}</li>
    </ul>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/settings?tab=users" class="button">Рассмотреть заявку</a>
    </p>
  `

  return sendEmail({
    to: admin.email,
    subject: `Новая заявка: ${user.name} хочет присоединиться`,
    html: emailTemplate(content, { title: 'Новая заявка' })
  })
}

/**
 * Daily expiry report for admins
 */
export async function sendExpiryReportEmail(admin, report) {
  const { critical, warning, today, hotel } = report
  
  const content = `
    <h2>Ежедневный отчёт о сроках годности 📊</h2>
    <p>Привет, <strong>${admin.name}</strong>!</p>
    <p>Отчёт для отеля <strong>${hotel.name}</strong> на ${new Date().toLocaleDateString('ru-RU')}:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #FEE2E2;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px;">
          <strong style="color: #DC2626;">🔴 Просрочено</strong>
        </td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;">
          <strong style="font-size: 24px; color: #DC2626;">${critical}</strong>
        </td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr style="background: #FEF3C7;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px;">
          <strong style="color: #D97706;">🟡 Истекает сегодня</strong>
        </td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;">
          <strong style="font-size: 24px; color: #D97706;">${today}</strong>
        </td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr style="background: #FEF9C3;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px;">
          <strong style="color: #CA8A04;">⚠️ Скоро истечёт</strong>
        </td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;">
          <strong style="font-size: 24px; color: #CA8A04;">${warning}</strong>
        </td>
      </tr>
    </table>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/inventory" class="button">Открыть инвентарь</a>
    </p>
  `

  return sendEmail({
    to: admin.email,
    subject: `📊 Отчёт: ${critical} просрочено, ${today} истекает сегодня`,
    html: emailTemplate(content, { title: 'Отчёт о сроках' })
  })
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════

/**
 * System email base layout
 * Used for system-level notifications (expiry warnings, daily reports)
 */
function systemEmailLayout(content, options = {}) {
  const { title = 'FreshTrack System' } = options
  
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 2px solid #f0f0f0;
    }
    .header h1 {
      color: #FF8D6B;
      font-size: 28px;
      margin: 0 0 8px 0;
    }
    .header p {
      color: #666;
      font-size: 14px;
      margin: 0;
    }
    .content {
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background: #FF8D6B;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
    }
    .button:hover {
      background: #E67D5B;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .table th,
    .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    .table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
    }
    .table tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-warning {
      background: #FEF3C7;
      color: #D97706;
    }
    .badge-critical {
      background: #FEE2E2;
      color: #DC2626;
    }
    .footer {
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🍊 FreshTrack</h1>
        <p>System Notification</p>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} FreshTrack. Все права защищены.</p>
        <p>Это автоматическое системное письмо, не отвечайте на него.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Get unified templates from settings
 * @param {string} hotelId - Hotel ID
 * @returns {Promise<Object>} Templates object
 */
async function getUnifiedTemplates(hotelId) {
  try {
    const templatesResult = await query(`
      SELECT value FROM settings 
      WHERE key IN ('notify.templates', 'telegram_message_templates') AND hotel_id = $1
      ORDER BY CASE WHEN key = 'notify.templates' THEN 1 ELSE 2 END
      LIMIT 1
    `, [hotelId])

    if (templatesResult.rows.length > 0) {
      try {
        return JSON.parse(templatesResult.rows[0].value)
      } catch {
        return {}
      }
    }
  } catch (error) {
    logWarn('EmailService', 'Failed to load templates from settings', error)
  }

  return {
    dailyReport: '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'
  }
}

/**
 * Convert text template to HTML (preserving line breaks and emojis)
 * @param {string} text - Text template
 * @returns {string} HTML formatted text
 */
function textToHtml(text) {
  if (!text) return ''
  
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

/**
 * Daily inventory summary email template
 * Uses unified templates from settings
 */
async function dailyReportTemplate(stats, hotelId = null) {
  const {
    totalBatches = 0,
    expiringBatches = 0,
    expiredBatches = 0,
    collectionsToday = 0,
    hotel = null,
    department = null,
    expiringList = [],
    expiredList = []
  } = stats

  // Get unified template from settings
  const templates = hotelId ? await getUnifiedTemplates(hotelId) : {}
  const templateText = templates.dailyReport ||
    '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'

  // Format aggregated lists
  const formatExpiringList = () => {
    if (!expiringList || expiringList.length === 0) return ''
    const items = expiringList.map(b => {
      const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
      return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (истекает ${date}, осталось ${b.days_left} дн.)`
    }).join('\n')
    return `⚠️ Истекают в ближайшее время:\n${items}`
  }

  const formatExpiredList = () => {
    if (!expiredList || expiredList.length === 0) return ''
    const items = expiredList.map(b => {
      const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
      return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (просрочено с ${date}, ${b.days_overdue} дн. назад)`
    }).join('\n')
    return `🔴 Просрочено:\n${items}`
  }

  // Replace variables (using stats mapping: good = totalBatches - expiringBatches - expiredBatches)
  const good = Math.max(0, totalBatches - expiringBatches - expiredBatches)
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const expiringListText = formatExpiringList()
  const expiredListText = formatExpiredList()
  const departmentText = department?.name || ''

  const formattedTemplate = templateText
    .replace(/{good}/g, good)
    .replace(/{warning}/g, expiringBatches)
    .replace(/{expired}/g, expiredBatches)
    .replace(/{total}/g, totalBatches)
    .replace(/{date}/g, currentDate)
    .replace(/{expiringList}/g, expiringListText)
    .replace(/{expiredList}/g, expiredListText)
    .replace(/{department}/g, departmentText)

  // Convert to HTML
  const templateHtml = textToHtml(formattedTemplate)

  const content = `
    <h2 style="margin-top: 0;">📊 Ежедневный отчёт по инвентарю</h2>
    <p>Отчёт за ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    ${hotel ? `<p><strong>Отель:</strong> ${hotel.name}</p>` : ''}
    ${department?.name ? `<p><strong>Отдел:</strong> ${department.name}</p>` : ''}
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      ${templateHtml}
    </div>
    
    <table class="table" style="margin-top: 20px;">
      <tr>
        <td><strong>Списаний за сутки</strong></td>
        <td style="text-align: right; font-size: 24px; font-weight: bold; color: #059669;">${collectionsToday}</td>
      </tr>
    </table>
    
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/inventory" class="button">Открыть инвентарь</a>
    </p>
  `

  return systemEmailLayout(content, { title: 'Ежедневный отчёт' })
}

/**
 * Send daily system report (system email → department inbox).
 * Uses unified templates from settings.
 * @param {Object} params - Report parameters
 * @param {Object} params.stats - Statistics object (must include hotel.id for template loading)
 * @param {string} params.to - Recipient email (department.email); required.
 */
export async function sendDailyReportEmail({ stats, to }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    logWarn('EmailService', 'No recipient (department.email) for daily report; skipping')
    return null
  }

  const hotelId = stats.hotel?.id || null
  const html = await dailyReportTemplate(stats, hotelId)
  
  // Generate text version from template
  const templates = hotelId ? await getUnifiedTemplates(hotelId) : {}
  const templateText = templates.dailyReport ||
    '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'

  const good = Math.max(0, (stats.totalBatches || 0) - (stats.expiringBatches || 0) - (stats.expiredBatches || 0))
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  // Format lists for text version
  const formatExpiringList = () => {
    if (!stats.expiringList || stats.expiringList.length === 0) return ''
    const items = stats.expiringList.map(b => {
      const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
      return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (истекает ${date}, осталось ${b.days_left} дн.)`
    }).join('\n')
    return `⚠️ Истекают в ближайшее время:\n${items}`
  }

  const formatExpiredList = () => {
    if (!stats.expiredList || stats.expiredList.length === 0) return ''
    const items = stats.expiredList.map(b => {
      const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
      return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (просрочено с ${date}, ${b.days_overdue} дн. назад)`
    }).join('\n')
    return `🔴 Просрочено:\n${items}`
  }
  
  const expiringListText = formatExpiringList()
  const expiredListText = formatExpiredList()
  const departmentText = stats.department?.name || ''

  const text = templateText
    .replace(/{good}/g, good)
    .replace(/{warning}/g, stats.expiringBatches || 0)
    .replace(/{expired}/g, stats.expiredBatches || 0)
    .replace(/{total}/g, stats.totalBatches || 0)
    .replace(/{date}/g, currentDate)
    .replace(/{expiringList}/g, expiringListText)
    .replace(/{expiredList}/g, expiredListText)
    .replace(/{department}/g, departmentText)

  const textReport = `Ежедневный отчёт по инвентарю\n\n${text}\n\nСписаний за сутки: ${stats.collectionsToday || 0}`

  try {
    return await sendEmail({
      to,
      from: EMAIL_FROM.noreply,
      subject: `FreshTrack: Ежедневный отчёт по инвентарю - ${new Date().toLocaleDateString('ru-RU')}`,
      html,
      text: textReport
    })
  } catch (error) {
    logError('EmailService', `Failed to send daily report email`, error)
    throw error
  }
}

// Initialize on import
initTransporter().catch(console.error)

export default {
  sendEmail,
  sendWelcomeEmail,
  sendWelcomeEmailWithPassword,
  sendJoinApprovedEmail,
  sendJoinRejectedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendNewJoinRequestEmail,
  sendExpiryReportEmail,
  sendDailyReportEmail
}
