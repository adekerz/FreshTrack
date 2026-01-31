/**
 * Email Verification Service
 * Handles OTP-based email verification for registration and email changes
 */

import { query } from '../db/database.js'
import { sendEmail } from './EmailService.js'
import { logError, logInfo } from '../utils/logger.js'

export class EmailVerificationService {
  static OTP_LENGTH = 6
  static OTP_TTL_MINUTES = 15
  static MAX_ATTEMPTS = 5
  static RESEND_COOLDOWN_SECONDS = 60
  static MAX_SENDS_PER_HOUR = 3

  /**
   * Generate 6-digit OTP
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Send OTP to email
   * @param {string} userId - User ID
   * @param {string} email - Email address
   * @param {string} purpose - 'REGISTRATION' or 'EMAIL_CHANGE'
   */
  static async sendOTP(userId, email, purpose = 'REGISTRATION') {
    try {
      // Check rate limiting (max 3 sends per hour per user)
      const recentSends = await query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE id = $1 
           AND email_verification_otp_expires > NOW() - INTERVAL '1 hour'`,
        [userId]
      )

      if (parseInt(recentSends.rows[0].count) >= this.MAX_SENDS_PER_HOUR) {
        throw new Error('Too many OTP requests. Please try again in 1 hour.')
      }

      // Generate OTP
      const otp = this.generateOTP()
      const expiresAt = new Date(Date.now() + this.OTP_TTL_MINUTES * 60 * 1000)

      // Save to database
      await query(
        `UPDATE users 
         SET email_verification_otp = $1,
             email_verification_otp_expires = $2,
             email_verification_attempts = 0
         WHERE id = $3`,
        [otp, expiresAt, userId]
      )

      // Send email
      await this.sendOTPEmail({
        to: email,
        otp,
        purpose,
        expiresInMinutes: this.OTP_TTL_MINUTES
      })

      logInfo('EmailVerificationService', `OTP sent to ${email} for user ${userId} (${purpose})`)

      return {
        success: true,
        expiresAt,
        cooldownSeconds: this.RESEND_COOLDOWN_SECONDS
      }
    } catch (error) {
      logError('EmailVerificationService.sendOTP', error)
      throw error
    }
  }

  /**
   * Verify OTP code
   * @param {string} userId - User ID
   * @param {string} otp - 6-digit OTP code
   */
  static async verifyOTP(userId, otp) {
    try {
      // Get user data
      const { rows } = await query(
        `SELECT email_verification_otp, 
                email_verification_otp_expires, 
                email_verification_attempts,
                email,
                pending_email
         FROM users 
         WHERE id = $1`,
        [userId]
      )

      if (rows.length === 0) {
        throw new Error('User not found')
      }

      const user = rows[0]

      // Check attempts limit
      if (user.email_verification_attempts >= this.MAX_ATTEMPTS) {
        throw new Error('Maximum verification attempts exceeded. Request new code.')
      }

      // Check expiration
      if (!user.email_verification_otp_expires || new Date() > new Date(user.email_verification_otp_expires)) {
        throw new Error('Verification code expired')
      }

      // Verify code
      if (user.email_verification_otp !== otp) {
        // Increment attempts
        await query(
          `UPDATE users 
           SET email_verification_attempts = email_verification_attempts + 1 
           WHERE id = $1`,
          [userId]
        )

        const attemptsLeft = this.MAX_ATTEMPTS - user.email_verification_attempts - 1
        throw new Error(`Invalid verification code. ${attemptsLeft} attempts left.`)
      }

      // Success: verify email
      await query(
        `UPDATE users 
         SET email_verified = TRUE,
             email_verification_otp = NULL,
             email_verification_otp_expires = NULL,
             email_verification_attempts = 0
         WHERE id = $1`,
        [userId]
      )

      logInfo('EmailVerificationService', `Email verified for user ${userId}`)

      return {
        success: true,
        email: user.email
      }
    } catch (error) {
      logError('EmailVerificationService.verifyOTP', error)
      throw error
    }
  }

  /**
   * Check if user can resend OTP (cooldown check)
   * @param {string} userId - User ID
   */
  static async canResendOTP(userId) {
    const { rows } = await query(
      `SELECT email_verification_otp_expires FROM users WHERE id = $1`,
      [userId]
    )

    if (rows.length === 0) return false

    const lastSent = rows[0].email_verification_otp_expires
    if (!lastSent) return true

    // Cooldown ends when: (lastSent - TTL) + cooldown seconds
    const cooldownEnds = new Date(
      new Date(lastSent).getTime() - this.OTP_TTL_MINUTES * 60 * 1000 + this.RESEND_COOLDOWN_SECONDS * 1000
    )

    return new Date() >= cooldownEnds
  }

  /**
   * Send OTP email
   * @private
   */
  static async sendOTPEmail({ to, otp, purpose, expiresInMinutes }) {
    const subject = purpose === 'REGISTRATION'
      ? 'Подтверждение email - FreshTrack'
      : 'Изменение email - FreshTrack'

    const purposeText = purpose === 'REGISTRATION'
      ? 'завершения регистрации'
      : 'изменения email'

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #10b981; margin: 0;">FreshTrack</h1>
        </div>
        
        <div style="background: #f9fafb; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #111827;">Код подтверждения</h2>
          <p style="color: #6b7280; margin-bottom: 20px;">
            Используйте этот код для ${purposeText}:
          </p>
          
          <div style="background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #10b981; font-family: monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            ⏱️ Код действителен <strong>${expiresInMinutes} минут</strong>
          </p>
        </div>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            ⚠️ Если вы не запрашивали этот код, просто проигнорируйте это письмо.
          </p>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px;">
          <p>© ${new Date().getFullYear()} FreshTrack. Все права защищены.</p>
        </div>
      </div>
    `

    await sendEmail({ to, subject, html })
  }
}
