-- Migration 042: MFA Recovery Requests
-- Allows users to request MFA recovery assistance

CREATE TABLE IF NOT EXISTS mfa_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  login VARCHAR(100) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_status ON mfa_recovery_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_email ON mfa_recovery_requests(email, created_at);

-- Add comments
COMMENT ON TABLE mfa_recovery_requests IS 'User requests for MFA recovery assistance';
COMMENT ON COLUMN mfa_recovery_requests.status IS 'Request status: PENDING, APPROVED, REJECTED';
