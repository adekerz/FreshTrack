-- FreshTrack Migration 035
-- Add email verification fields to departments table
-- Email verification is required before sending daily reports to department email

-- Add email verification columns
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verification_attempts INTEGER DEFAULT 0;

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_departments_verification_code 
ON departments(email_verification_code) 
WHERE email_verification_code IS NOT NULL;

-- Comment
COMMENT ON COLUMN departments.email_verified IS 'Whether department email has been verified via 6-digit code';
COMMENT ON COLUMN departments.email_verification_code IS '6-digit verification code (temporary, expires in 15 minutes)';
COMMENT ON COLUMN departments.email_verification_expires IS 'Expiration timestamp for verification code';
COMMENT ON COLUMN departments.email_verification_attempts IS 'Number of failed verification attempts (max 5 before 1-hour lockout)';
