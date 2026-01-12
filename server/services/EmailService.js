/**
 * Email Service for FreshTrack
 * Supports: Resend (recommended), SMTP (Nodemailer), SendGrid
 * 
 * Configuration via environment variables:
 * - EMAIL_PROVIDER: 'resend' | 'smtp' | 'sendgrid'
 * - RESEND_API_KEY: Resend API key
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP settings
 * - SENDGRID_API_KEY: SendGrid API key
 * - EMAIL_FROM: Default sender email
 */

import nodemailer from 'nodemailer'

// Email provider configuration
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'smtp'
const EMAIL_FROM = process.env.EMAIL_FROM || 'FreshTrack <noreply@freshtrack.app>'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

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
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: options.from || EMAIL_FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Resend error: ${error.message || response.statusText}`)
  }

  return response.json()
}

/**
 * Send email (universal method)
 */
export async function sendEmail(options) {
  const { to, subject, html, text } = options

  try {
    if (EMAIL_PROVIDER === 'resend') {
      return await sendViaResend(options)
    }

    await initTransporter()
    
    const result = await transporter.sendMail({
      from: options.from || EMAIL_FROM,
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

// Initialize on import
initTransporter().catch(console.error)

export default {
  sendEmail,
  sendWelcomeEmail,
  sendJoinApprovedEmail,
  sendJoinRejectedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendNewJoinRequestEmail,
  sendExpiryReportEmail
}
