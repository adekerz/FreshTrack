-- Migration 044: MFA Emergency Recovery
-- Allows emergency MFA recovery via email for ONLY SUPER_ADMIN

CREATE TABLE IF NOT EXISTS mfa_emergency_recovery (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_emergency_token ON mfa_emergency_recovery(token, expires_at);

-- Add comment
COMMENT ON TABLE mfa_emergency_recovery IS 'Emergency MFA recovery tokens (email-based, for ONLY SUPER_ADMIN)';
COMMENT ON COLUMN mfa_emergency_recovery.token IS 'Secure token for email recovery link';
COMMENT ON COLUMN mfa_emergency_recovery.expires_at IS 'Token expiration (24 hours)';
