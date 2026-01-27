-- Migration 037: MFA for SUPER_ADMIN
-- Adds multi-factor authentication support with TOTP

-- Add MFA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[]; -- array of hashed codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN DEFAULT FALSE;

-- Audit log для MFA событий
CREATE TABLE IF NOT EXISTS mfa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'setup', 'verify_success', 'verify_fail', 'disable', 'backup_used'
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_audit_user ON mfa_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_failures ON mfa_audit_log(user_id, event_type, created_at) 
  WHERE event_type = 'verify_fail';

-- Policy: Require MFA для SUPER_ADMIN
-- Автоматически включить для существующих SUPER_ADMIN
UPDATE users SET mfa_required = TRUE WHERE role = 'SUPER_ADMIN';

-- Add comment
COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is enabled and active for this user';
COMMENT ON COLUMN users.mfa_secret IS 'TOTP secret key (stored encrypted)';
COMMENT ON COLUMN users.mfa_backup_codes IS 'Array of hashed backup codes (one-time use)';
COMMENT ON COLUMN users.mfa_required IS 'Whether MFA is required for this role (enforced for SUPER_ADMIN)';
