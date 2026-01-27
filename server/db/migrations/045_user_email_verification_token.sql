-- Migration 045: Add email_verification_token for link-based verification
-- Users now use link-based verification (simplified, like departments)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification link (link-based, simplified)';
