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
    if (
      !user?.email ||
      typeof user.email !== 'string' ||
      !String(user.email).trim()
    )
      return null
    return String(user.email).trim()
  }
  if (target === 'DEPARTMENT') {
    const email = department?.email
    if (!email || typeof email !== 'string' || !String(email).trim()) {
      logWarn(
        'EmailService',
        `Department ${department?.name ?? 'unknown'} has no email; skipping system email`
      )
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
          pass: process.env.SENDGRID_API_KEY,
        },
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
          pass: process.env.SMTP_PASS,
        },
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
    throw new Error(
      'Resend client not initialized. Check RESEND_API_KEY environment variable.'
    )
  }

  const fromAddr =
    process.env.NODE_ENV === 'development' &&
    process.env.RESEND_USE_DEV_SENDER === 'true'
      ? 'FreshTrack <onboarding@resend.dev>'
      : options.from || DEFAULT_FROM

  const payload = {
    from: fromAddr,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
  }

  if (options.attachments && options.attachments.length > 0) {
    payload.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
    }))
  }

  const result = await resendClient.emails.send(payload)

  if (result.error) {
    throw new Error(result.error.message || 'Resend API error')
  }
  return result
}

/**
 * Send email (universal method)
 */
export async function sendEmail(options) {
  const { to, subject, html, text, from, attachments } = options

  try {
    const sender = from || DEFAULT_FROM

    if (EMAIL_PROVIDER === 'resend') {
      const result = await sendViaResend({
        ...options,
        from: sender,
      })
      const attachInfo = attachments?.length
        ? ` (${attachments.length} влож.)`
        : ''
      console.log(`📧 Email sent via Resend to ${to}: ${subject}${attachInfo}`)
      return result
    }

    await initTransporter()

    const mailOptions = {
      from: sender,
      to,
      subject,
      html,
      text,
    }
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content)
          ? a.content
          : Buffer.from(a.content),
        contentType: a.contentType,
      }))
    }

    const result = await transporter.sendMail(mailOptions)

    const attachInfo = attachments?.length
      ? ` (${attachments.length} влож.)`
      : ''
    console.log(`📧 Email sent to ${to}: ${subject}${attachInfo}`)
    return result
  } catch (error) {
    console.error('❌ Email send error:', error)
    throw error
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════

// Support email for footer
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@freshtrack.systems'
const PRIVACY_POLICY_URL =
  process.env.PRIVACY_POLICY_URL || `${APP_URL}/privacy`
const PREFERENCES_URL =
  process.env.PREFERENCES_URL || `${APP_URL}/settings?tab=notifications`

/**
 * Standard email footer
 */
function emailFooter() {
  return `
    <div class="footer">
      <p>The FreshTrack Team</p>
      <p>Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #888;">${SUPPORT_EMAIL}</a></p>
      <p>You received this email because you have an account with FreshTrack.</p>
      <p>
        <a href="${PRIVACY_POLICY_URL}" style="color: #888;">Privacy Policy</a>
        &nbsp;&middot;&nbsp;
        <a href="${PREFERENCES_URL}" style="color: #888;">Manage notification preferences</a>
      </p>
      <p style="margin-top: 12px;">© ${new Date().getFullYear()} FreshTrack. All rights reserved.</p>
    </div>
  `
}

/**
 * Base email template wrapper
 */
function emailTemplate(content, options = {}) {
  const { title = 'FreshTrack' } = options

  return `
<!DOCTYPE html>
<html lang="en">
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
      letter-spacing: 8px;
      text-align: center;
      color: #FF8D6B;
      font-family: 'Courier New', Courier, monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>FreshTrack</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      ${emailFooter()}
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
    <h2 style="margin-top: 0;">Welcome to FreshTrack</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Welcome to FreshTrack. Your account${hotel ? ` for <strong>${hotel.name}</strong>` : ''} has been created and is ready to use.</p>
    <p>FreshTrack helps hotel teams track product expiration dates, reduce waste, and stay compliant with food safety standards.</p>
    ${
      hotel
        ? `
      <p>Your join request for <strong>${hotel.name}</strong> has been submitted. A hotel administrator will review it shortly.</p>
    `
        : `
      <p style="text-align: center; margin-top: 24px;">
        <a href="${APP_URL}" class="button">Open FreshTrack</a>
      </p>
      <p>Here is what to do first:</p>
      <ol style="line-height: 1.8;">
        <li>Add your storage locations and departments</li>
        <li>Enter your first inventory items</li>
        <li>Configure expiration alert thresholds</li>
      </ol>
    `
    }
    <p>If you have any questions, contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
  `

  return sendEmail({
    to: user.email,
    subject: 'Welcome to FreshTrack',
    html: emailTemplate(content, { title: 'Welcome to FreshTrack' }),
  })
}

/**
 * Send welcome email with temporary password (USER email)
 * Used when admin creates a new user
 */
export async function sendWelcomeEmailWithPassword({
  to,
  userName,
  temporaryPassword,
  hotelName,
  loginUrl,
}) {
  if (!to || !userName || !temporaryPassword) {
    logWarn(
      'EmailService',
      'Missing required parameters for welcome email with password'
    )
    return null
  }

  const loginUrlFinal = loginUrl || `${APP_URL}/login`
  const hotelNameFinal = hotelName || 'FreshTrack'

  const content = `
    <h2 style="margin-top: 0;">You have been invited to FreshTrack</h2>
    <p>Hi <strong>${userName}</strong>,</p>
    <p>An administrator has invited you to join FreshTrack for <strong>${hotelNameFinal}</strong>.</p>
    <p>FreshTrack is an inventory management system that helps hotel teams track product expiration dates and maintain food safety compliance.</p>
    <p>A temporary password has been created for your account. For security, you must change it upon first login.</p>

    <p><strong>Your sign-in details:</strong></p>
    <table style="margin: 0 0 16px 0;">
      <tr><td style="padding: 4px 16px 4px 0; color: #666;">Email</td><td><strong>${to}</strong></td></tr>
      <tr><td style="padding: 4px 16px 4px 0; color: #666;">Temporary password</td><td><strong style="font-family: 'Courier New', monospace;">${temporaryPassword}</strong></td></tr>
    </table>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${loginUrlFinal}" class="button">Sign In to FreshTrack</a>
    </p>

    <p style="color: #888; font-size: 14px; margin-top: 20px;">For security, do not share these credentials with anyone. This temporary password will expire. If it expires, contact your administrator.</p>
  `

  const text = `
You have been invited to FreshTrack

Hi ${userName},

An administrator has invited you to join FreshTrack for ${hotelNameFinal}.

Your sign-in details:
  Email: ${to}
  Temporary password: ${temporaryPassword}

Sign in at: ${loginUrlFinal}

You must change your password upon first login. Do not share these credentials with anyone.
  `

  try {
    return await sendEmail({
      to,
      from: EMAIL_FROM.noreply,
      subject: `You have been invited to FreshTrack`,
      html: emailTemplate(content, {
        title: 'You have been invited to FreshTrack',
      }),
      text,
    })
  } catch (error) {
    logError(
      'EmailService',
      `Failed to send welcome email with password to ${to}`,
      error
    )
    throw error
  }
}

/**
 * Join request approved email
 */
export async function sendJoinApprovedEmail(user, hotel, department = null) {
  const roleName = department ? department.name : 'staff member'
  const content = `
    <h2 style="margin-top: 0;">Your request to join ${hotel.name} has been approved</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Your request to join <strong>${hotel.name}</strong> on FreshTrack has been approved. You have been granted <strong>${roleName}</strong> access.</p>
    <p>You can now sign in and begin using FreshTrack.</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}" class="button">Sign In to FreshTrack</a>
    </p>
  `

  return sendEmail({
    to: user.email,
    subject: `Your request to join ${hotel.name} has been approved`,
    html: emailTemplate(content, { title: 'Request approved' }),
  })
}

/**
 * Join request rejected email
 */
export async function sendJoinRejectedEmail(user, hotel, reason = null) {
  const content = `
    <h2 style="margin-top: 0;">Update on your FreshTrack access request</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Thank you for your interest in joining <strong>${hotel.name}</strong> on FreshTrack. After review, your access request was not approved at this time.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
    <p>If you believe this decision was made in error or you have questions, please contact the property administrator.</p>
  `

  return sendEmail({
    to: user.email,
    subject: `Update on your FreshTrack access request`,
    html: emailTemplate(content, { title: 'Access request update' }),
  })
}

/**
 * Password reset email
 */
export async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`

  const content = `
    <h2 style="margin-top: 0;">Reset your FreshTrack password</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>We received a request to reset the password for your FreshTrack account associated with <strong>${user.email}</strong>.</p>
    <p>Click the button below to set a new password. This link will expire in <strong>1 hour</strong> and can only be used once.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p style="font-size: 14px; color: #666;">If you cannot click the button, copy and paste this URL into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 13px;">${resetUrl}</p>
    <p style="color: #888; font-size: 14px; margin-top: 20px;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    <p style="color: #888; font-size: 14px;">If you are concerned about your account security, contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #888;">${SUPPORT_EMAIL}</a>.</p>
  `

  return sendEmail({
    to: user.email,
    from: EMAIL_FROM.noreply,
    subject: 'Reset your FreshTrack password',
    html: emailTemplate(content, { title: 'Reset your password' }),
  })
}

/**
 * Email verification — только коды (OTP), без ссылок
 * @param {Object} params - verificationCode обязателен для USER
 */
export async function sendVerificationEmail({
  user,
  verificationCode,
  target = 'USER',
  email = null,
  departmentName,
  hotelName,
  confirmLink,
  unsubscribeLink,
}) {
  const recipientEmail = email || user?.email
  if (!recipientEmail) {
    throw new Error('Email address is required for verification')
  }

  let content
  if (target === 'DEPARTMENT') {
    const deptName = departmentName || user?.name || 'your department'
    const hName = hotelName || 'your hotel'
    const confirm = confirmLink || ''
    const unsubLink = unsubscribeLink || ''

    content = `
      <h2 style="margin-top: 0;">Verify email for ${deptName} reports</h2>
      <p>Hello,</p>
      <p>A FreshTrack administrator has configured <strong>${deptName}</strong> at <strong>${hName}</strong> to send daily inventory reports to this email address.</p>
      <p>To confirm that you want to receive these reports, click the button below:</p>

      ${confirm ? `<p style="text-align: center; margin: 24px 0;"><a href="${confirm}" class="button">Verify Email Address</a></p>` : ''}

      <p style="font-size: 14px; color: #666; margin-top: 20px;">Once verified, you will receive automated daily reports containing inventory status and expiration alerts for <strong>${deptName}</strong>.</p>

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;">

      <p style="color: #888; font-size: 13px;">
        If you did not expect this email, no action is required. You will not receive any further messages.
        ${unsubLink ? `<br><a href="${unsubLink}" style="color: #888;">Unsubscribe</a>` : ''}
      </p>
    `
  } else {
    // USER — OTP code only
    if (!verificationCode) {
      throw new Error('Verification code is required for USER target')
    }
    content = `
      <h2 style="margin-top: 0;">Your FreshTrack verification code</h2>
      <p>Hi <strong>${user?.name || 'there'}</strong>,</p>
      <p>Your verification code is:</p>
      <div class="code">${verificationCode}</div>
      <p style="text-align: center; margin-top: 16px; color: #888;">This code expires in <strong>10 minutes</strong>.</p>
      <p style="text-align: center; margin-top: 12px; color: #888; font-size: 14px;">For your security, never share this code with anyone. The FreshTrack team will never ask you for this code.</p>
      <p style="text-align: center; margin-top: 12px; color: #888; font-size: 14px;">If you did not request this code, you can safely ignore this email.</p>
    `
  }

  return sendEmail({
    to: recipientEmail,
    from: EMAIL_FROM.noreply,
    subject:
      target === 'DEPARTMENT'
        ? `Verify email for ${departmentName || 'department'} reports`
        : 'Your FreshTrack verification code',
    html: emailTemplate(content, {
      title:
        target === 'DEPARTMENT' ? 'Verify email address' : 'Verification code',
    }),
  })
}

/**
 * New join request notification for admins
 */
export async function sendNewJoinRequestEmail(admin, user, hotel) {
  const content = `
    <h2 style="margin-top: 0;">New access request for ${hotel.name}</h2>
    <p>Hi <strong>${admin.name}</strong>,</p>
    <p><strong>${user.name}</strong> (<a href="mailto:${user.email}">${user.email}</a>) has requested to join <strong>${hotel.name}</strong> on FreshTrack.</p>
    <p>You can approve or decline this request from your dashboard:</p>
    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/settings?tab=users" class="button">Review Request</a>
    </p>
  `

  return sendEmail({
    to: admin.email,
    subject: `New access request for ${hotel.name}`,
    html: emailTemplate(content, { title: 'New access request' }),
  })
}

/**
 * Daily expiry report for admins
 */
export async function sendExpiryReportEmail(admin, report) {
  const { critical, warning, today, hotel } = report
  const reportDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const expiredCount = critical || 0
  const warningCount = warning || 0
  const todayCount = today || 0
  const totalAlertCount = expiredCount + warningCount + todayCount

  const content = `
    <h2 style="margin-top: 0;">Expiry report for ${hotel.name} — ${reportDate}</h2>
    <p>Hi <strong>${admin.name}</strong>,</p>
    <p>Here is the daily expiration report for <strong>${hotel.name}</strong> as of ${reportDate}.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #FEE2E2;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px; color: #DC2626;"><strong>Expired — Immediate action required</strong></td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;"><strong style="font-size: 24px; color: #DC2626;">${expiredCount}</strong></td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr style="background: #FEF3C7;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px; color: #D97706;"><strong>Expiring today</strong></td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;"><strong style="font-size: 24px; color: #D97706;">${todayCount}</strong></td>
      </tr>
      <tr><td colspan="2" style="height: 8px;"></td></tr>
      <tr style="background: #FEF9C3;">
        <td style="padding: 12px; border-radius: 8px 0 0 8px; color: #CA8A04;"><strong>Expiring soon</strong></td>
        <td style="padding: 12px; text-align: right; border-radius: 0 8px 8px 0;"><strong style="font-size: 24px; color: #CA8A04;">${warningCount}</strong></td>
      </tr>
    </table>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/inventory" class="button">View Full Report</a>
    </p>
    <p style="text-align: center; color: #888; font-size: 13px; margin-top: 12px;">This is an automated daily report. To adjust report settings, visit your <a href="${PREFERENCES_URL}" style="color: #888;">notification preferences</a>.</p>
  `

  return sendEmail({
    to: admin.email,
    subject: `Expiry report for ${hotel.name} — ${totalAlertCount} items need attention`,
    html: emailTemplate(content, { title: 'Expiry report' }),
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
        <h1>FreshTrack</h1>
        <p>System Notification</p>
      </div>
      <div class="content">
        ${content}
      </div>
      ${emailFooter()}
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
    const templatesResult = await query(
      `
      SELECT value FROM settings 
      WHERE key IN ('notify.templates', 'telegram_message_templates') AND hotel_id = $1
      ORDER BY CASE WHEN key = 'notify.templates' THEN 1 ELSE 2 END
      LIMIT 1
    `,
      [hotelId]
    )

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
    dailyReport:
      '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}',
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
 * Account deleted email notification
 * @param {Object} user - User object with name and email
 * @param {string} hotelName - Optional hotel name
 */
export async function sendAccountDeletedEmail(user, hotelName = null) {
  if (!user?.email) {
    logWarn(
      'EmailService',
      'Cannot send account deleted email - no email address'
    )
    return null
  }

  const content = `
    <h2 style="margin-top: 0;">Your FreshTrack account has been deleted</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Your FreshTrack account (<strong>${user.email}</strong>${hotelName ? ` for ${hotelName}` : ''}) has been deleted by your administrator.</p>
    <p><strong>What this means:</strong></p>
    <ul style="line-height: 1.8;">
      <li>Your access to FreshTrack has been permanently revoked</li>
      <li>Your personal account data has been removed</li>
      <li>Hotel inventory data managed by your organization is unaffected</li>
    </ul>
    <p>If you believe this was done in error, contact your property administrator.</p>
    <p style="color: #888; font-size: 14px;">If you have questions about data handling, review our <a href="${PRIVACY_POLICY_URL}" style="color: #888;">Privacy Policy</a> or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #888;">${SUPPORT_EMAIL}</a>.</p>
  `

  const text = `
Your FreshTrack account has been deleted

Hi ${user.name},

Your FreshTrack account (${user.email}${hotelName ? ` for ${hotelName}` : ''}) has been deleted by your administrator.

What this means:
- Your access to FreshTrack has been permanently revoked
- Your personal account data has been removed
- Hotel inventory data managed by your organization is unaffected

If you believe this was done in error, contact your property administrator.
  `

  try {
    return await sendEmail({
      to: user.email,
      from: EMAIL_FROM.noreply,
      subject: 'Your FreshTrack account has been deleted',
      html: emailTemplate(content, { title: 'Account deleted' }),
      text,
    })
  } catch (error) {
    logError(
      'EmailService',
      `Failed to send account deleted email to ${user.email}`,
      error
    )
    throw error
  }
}

/**
 * Account deactivated email notification
 * @param {Object} user - User object with name and email
 * @param {string} hotelName - Optional hotel name
 */
export async function sendAccountDeactivatedEmail(user, hotelName = null) {
  if (!user?.email) {
    logWarn(
      'EmailService',
      'Cannot send account deactivated email - no email address'
    )
    return null
  }

  const content = `
    <h2 style="margin-top: 0;">Your FreshTrack account has been deactivated</h2>
    <p>Hi <strong>${user.name}</strong>,</p>
    <p>Your FreshTrack account (<strong>${user.email}</strong>${hotelName ? ` for ${hotelName}` : ''}) has been deactivated by your administrator.</p>
    <p><strong>While your account is deactivated:</strong></p>
    <ul style="line-height: 1.8;">
      <li>You cannot sign in to FreshTrack</li>
      <li>You will not receive notifications or reports</li>
      <li>Your account data is preserved</li>
    </ul>
    <p>Your administrator can reactivate your account at any time. If you have questions, contact your property administrator.</p>
  `

  const text = `
Your FreshTrack account has been deactivated

Hi ${user.name},

Your FreshTrack account (${user.email}${hotelName ? ` for ${hotelName}` : ''}) has been deactivated by your administrator.

While your account is deactivated:
- You cannot sign in to FreshTrack
- You will not receive notifications or reports
- Your account data is preserved

Your administrator can reactivate your account at any time.
  `

  try {
    return await sendEmail({
      to: user.email,
      from: EMAIL_FROM.noreply,
      subject: 'Your FreshTrack account has been deactivated',
      html: emailTemplate(content, { title: 'Account deactivated' }),
      text,
    })
  } catch (error) {
    logError(
      'EmailService',
      `Failed to send account deactivated email to ${user.email}`,
      error
    )
    throw error
  }
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
    expiredList = [],
  } = stats

  // Get unified template from settings
  const templates = hotelId ? await getUnifiedTemplates(hotelId) : {}
  const templateText =
    templates.dailyReport ||
    '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'

  // Format aggregated lists
  const formatExpiringList = () => {
    if (!expiringList || expiringList.length === 0) return ''
    const items = expiringList
      .map((b) => {
        const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
        return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (истекает ${date}, осталось ${b.days_left} дн.)`
      })
      .join('\n')
    return `⚠️ Истекают в ближайшее время:\n${items}`
  }

  const formatExpiredList = () => {
    if (!expiredList || expiredList.length === 0) return ''
    const items = expiredList
      .map((b) => {
        const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
        return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (просрочено с ${date}, ${b.days_overdue} дн. назад)`
      })
      .join('\n')
    return `🔴 Просрочено:\n${items}`
  }

  // Replace variables (using stats mapping: good = totalBatches - expiringBatches - expiredBatches)
  const good = Math.max(0, totalBatches - expiringBatches - expiredBatches)
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
    <h2 style="margin-top: 0;">Daily Inventory Report</h2>
    <p>Report for ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    ${hotel ? `<p><strong>Hotel:</strong> ${hotel.name}</p>` : ''}
    ${department?.name ? `<p><strong>Department:</strong> ${department.name}</p>` : ''}
    
    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      ${templateHtml}
    </div>
    
    <table class="table" style="margin-top: 20px;">
      <tr>
        <td><strong>Collections today</strong></td>
        <td style="text-align: right; font-size: 24px; font-weight: bold; color: #059669;">${collectionsToday}</td>
      </tr>
    </table>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${APP_URL}/inventory" class="button">View Dashboard</a>
    </p>
    <p style="text-align: center; color: #888; font-size: 13px; margin-top: 12px;">This is an automated daily report. To change report settings, visit your <a href="${PREFERENCES_URL}" style="color: #888;">notification preferences</a>.</p>
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
    logWarn(
      'EmailService',
      'No recipient (department.email) for daily report; skipping'
    )
    return null
  }

  const hotelId = stats.hotel?.id || null
  const html = await dailyReportTemplate(stats, hotelId)

  // Generate text version from template
  const templates = hotelId ? await getUnifiedTemplates(hotelId) : {}
  const templateText =
    templates.dailyReport ||
    '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'

  const good = Math.max(
    0,
    (stats.totalBatches || 0) -
      (stats.expiringBatches || 0) -
      (stats.expiredBatches || 0)
  )
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format lists for text version
  const formatExpiringList = () => {
    if (!stats.expiringList || stats.expiringList.length === 0) return ''
    const items = stats.expiringList
      .map((b) => {
        const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
        return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (истекает ${date}, осталось ${b.days_left} дн.)`
      })
      .join('\n')
    return `⚠️ Истекают в ближайшее время:\n${items}`
  }

  const formatExpiredList = () => {
    if (!stats.expiredList || stats.expiredList.length === 0) return ''
    const items = stats.expiredList
      .map((b) => {
        const date = new Date(b.expiry_date).toLocaleDateString('ru-RU')
        return `  • ${b.product_name} — ${b.quantity} ${b.unit || 'шт.'} (просрочено с ${date}, ${b.days_overdue} дн. назад)`
      })
      .join('\n')
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
      subject: `Daily inventory report — ${stats.hotel?.name || 'FreshTrack'} — ${new Date().toLocaleDateString('en-GB')}`,
      html,
      text: textReport,
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
  sendDailyReportEmail,
  sendAccountDeletedEmail,
  sendAccountDeactivatedEmail,
}
