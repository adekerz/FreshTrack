-- FreshTrack Migration 036
-- Add email verification fields to users table
-- Email verification is required for password reset and sensitive operations

-- Add email verification columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER DEFAULT 0;

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_code 
ON users(email_verification_code) 
WHERE email_verification_code IS NOT NULL;

-- Comment
COMMENT ON COLUMN users.email_verified IS 'Whether user email has been verified via 6-digit code';
COMMENT ON COLUMN users.email_verification_code IS '6-digit verification code (temporary, expires in 30 minutes for registration)';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration timestamp for verification code';
COMMENT ON COLUMN users.email_verification_attempts IS 'Number of failed verification attempts (max 5 before 1-hour lockout)';
