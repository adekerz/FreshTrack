-- Migration 047: Email OTP Verification
-- Adds OTP-based email verification for registration and email changes
-- Extends existing email verification fields (from migration 036)

-- Add OTP-specific fields (if not exist from migration 036)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_required BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_otp VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_otp_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);

-- Update existing users: mark email as verified if they have email
UPDATE users 
SET email_verified = TRUE 
WHERE email IS NOT NULL 
  AND email_verified IS NULL;

-- Make email required for new registrations (but don't break existing users)
-- We'll enforce this in application logic, not DB constraint
-- ALTER TABLE users ALTER COLUMN email SET NOT NULL; -- Commented out to avoid breaking existing data

-- Index for fast OTP lookup
CREATE INDEX IF NOT EXISTS idx_users_email_otp 
ON users(email_verification_otp) 
WHERE email_verification_otp IS NOT NULL;

-- Index for pending email lookups
CREATE INDEX IF NOT EXISTS idx_users_pending_email 
ON users(pending_email) 
WHERE pending_email IS NOT NULL;

-- Comments
COMMENT ON COLUMN users.email_required IS 'Whether email is required for this user (default TRUE for new registrations)';
COMMENT ON COLUMN users.email_verification_otp IS '6-digit OTP code for email verification (temporary, expires in 15 minutes)';
COMMENT ON COLUMN users.email_verification_otp_expires IS 'Expiration timestamp for OTP code (15 minutes from generation)';
COMMENT ON COLUMN users.pending_email IS 'Temporary email address during email change process (verified via OTP)';
