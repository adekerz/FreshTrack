/**
 * Webhooks Controller
 * Handles external webhook events (Resend, etc.)
 */

import { Router } from 'express'
import { query } from '../../db/postgres.js'
import { logInfo, logError, logWarn } from '../../utils/logger.js'
import { Webhook } from 'svix'

const router = Router()

/**
 * Verify Resend webhook signature using Svix library
 * Resend uses Svix for webhook signing
 */
function verifyResendSignature(req, res, next) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  
  if (!webhookSecret) {
    logWarn('Webhooks', 'RESEND_WEBHOOK_SECRET not configured - UNSAFE!')
    // In dev пропускаем, в prod отклоняем
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Webhook not configured' })
    }
    return next()
  }
  
  try {
    const webhook = new Webhook(webhookSecret)
    
    // Svix expects raw body string
    const rawBody = JSON.stringify(req.body)
    
    webhook.verify(rawBody, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature']
    })
    
    next()
  } catch (err) {
    logWarn('Webhooks', `Invalid Resend webhook signature: ${err.message}`)
    return res.status(401).json({ error: 'Invalid signature' })
  }
}

/**
 * POST /webhooks/resend
 * Resend webhook endpoint for email events
 * 
 * Supported events:
 * - email.delivered: Email successfully delivered
 * - email.bounced: Email bounced (invalid address)
 * - email.complained: User marked email as spam
 */
router.post('/resend', verifyResendSignature, async (req, res) => {
  try {
    const { type, data } = req.body

    // Validate payload structure
    if (!type || !data) {
      logWarn('Webhooks', 'Invalid Resend webhook payload: missing type or data')
      return res.status(400).json({ error: 'Invalid payload structure' })
    }

    logInfo('Webhooks', `📬 Resend webhook received: ${type}`)

    // Handle different event types
    switch (type) {
      case 'email.delivered':
        await handleEmailDelivered(data)
        break

      case 'email.bounced':
        await handleEmailBounced(data)
        break

      case 'email.complained':
        await handleEmailComplained(data)
        break

      default:
        // Unknown event type - log but don't fail
        logWarn('Webhooks', `Unknown Resend event type: ${type}`)
        return res.status(200).json({ received: true, message: 'Event type not handled' })
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true, processed: true })

  } catch (error) {
    // Never fail the webhook - Resend will retry
    logError('Webhooks', `Error processing Resend webhook: ${error.message}`, error)
    res.status(200).json({ received: true, error: 'Processing failed but acknowledged' })
  }
})

/**
 * Handle email.delivered event
 * Just log the delivery - no action needed
 * Works for both USER and DEPARTMENT emails
 */
async function handleEmailDelivered(data) {
  const { email, created_at } = data
  logInfo('Webhooks', `✅ Email delivered: ${email} at ${created_at}`)
  
  // Optional: Update delivery status in notifications table if we track it
  // For now, just log (works for both USER and DEPARTMENT emails)
}

/**
 * Handle email.bounced event
 * - USER emails: mark email_valid = false in users table.
 * - DEPARTMENT emails (system emails): log warning, optionally track in future.
 */
async function handleEmailBounced(data) {
  const { email, bounce_type, reason } = data

  logWarn('Webhooks', `❌ Email bounced: ${email} (${bounce_type}: ${reason})`)

  if (!email) {
    logWarn('Webhooks', 'Bounce event missing email address')
    return
  }

  try {
    // First, try to update user email (USER email)
    const userResult = await query(`
      UPDATE users 
      SET email_valid = false,
          email_blocked = false
      WHERE email = $1
    `, [email])

    if (userResult.rowCount > 0) {
      logInfo('Webhooks', `📧 Marked user email as invalid: ${email} (${userResult.rowCount} user(s) updated)`)
      return
    }

    // If not found in users, check if it's a department email (SYSTEM email)
    const deptResult = await query(`
      SELECT id, name, hotel_id 
      FROM departments 
      WHERE email = $1 AND is_active = true
    `, [email])

    if (deptResult.rowCount > 0) {
      const dept = deptResult.rows[0]
      logWarn('Webhooks', `⚠️ Department inbox bounced: ${email} (${dept.name}, hotel_id: ${dept.hotel_id}). System emails will not be sent to this address.`)
      // Future: optionally track department email status (add email_valid, email_blocked to departments table)
    } else {
      logWarn('Webhooks', `Email not found in users or departments: ${email}`)
    }
  } catch (error) {
    logError('Webhooks', `Failed to update email status for ${email}`, error)
    throw error
  }
}

/**
 * Handle email.complained event
 * - USER emails: mark email_blocked = true in users table.
 * - DEPARTMENT emails (system emails): log warning, optionally track in future.
 */
async function handleEmailComplained(data) {
  const { email, created_at } = data

  logWarn('Webhooks', `🚫 Email complaint: ${email} at ${created_at}`)

  if (!email) {
    logWarn('Webhooks', 'Complaint event missing email address')
    return
  }

  try {
    // First, try to update user email (USER email)
    const userResult = await query(`
      UPDATE users 
      SET email_blocked = true,
          email_valid = false
      WHERE email = $1
    `, [email])

    if (userResult.rowCount > 0) {
      logInfo('Webhooks', `🚫 Blocked user email due to complaint: ${email} (${userResult.rowCount} user(s) updated)`)
      return
    }

    // If not found in users, check if it's a department email (SYSTEM email)
    const deptResult = await query(`
      SELECT id, name, hotel_id 
      FROM departments 
      WHERE email = $1 AND is_active = true
    `, [email])

    if (deptResult.rowCount > 0) {
      const dept = deptResult.rows[0]
      logWarn('Webhooks', `⚠️ Department inbox complaint: ${email} (${dept.name}, hotel_id: ${dept.hotel_id}). System emails should not be sent to this address.`)
      // Future: optionally track department email status (add email_valid, email_blocked to departments table)
    } else {
      logWarn('Webhooks', `Email not found in users or departments: ${email}`)
    }
  } catch (error) {
    logError('Webhooks', `Failed to block email ${email}`, error)
    throw error
  }
}

export default router
