-- Migration 041: Department Email Confirmation
-- Simplified email confirmation for departments (no codes, just confirmation)

ALTER TABLE departments ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS email_unsubscribe_token VARCHAR(64);

-- Index для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_departments_email_confirmed ON departments(email_confirmed) WHERE email IS NOT NULL;

-- Add comments
COMMENT ON COLUMN departments.email_confirmed IS 'Whether department email has been confirmed';
COMMENT ON COLUMN departments.email_confirmed_at IS 'Timestamp when email was confirmed';
COMMENT ON COLUMN departments.email_unsubscribe_token IS 'Token for unsubscribing from department emails';
