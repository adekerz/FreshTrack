-- Migration: Add email status tracking fields to users table
-- Purpose: Track email validity and blocking status from Resend webhooks
-- Date: 2026-01-21

-- Add email status tracking columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_valid BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_blocked BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on email status
CREATE INDEX IF NOT EXISTS idx_users_email_status 
ON users(email_valid, email_blocked) 
WHERE email IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.email_valid IS 'Email address validity status (false if bounced)';
COMMENT ON COLUMN users.email_blocked IS 'Email address blocked status (true if user complained)';
