-- Migration: Add terms acceptance tracking to users table
-- Date: 2024-02-01
-- Description: Adds columns to track user acceptance of Terms of Service and Privacy Policy

-- Add terms acceptance columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN users.terms_accepted IS 'Whether user has accepted Terms of Service and Privacy Policy';
COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp when user accepted terms';
COMMENT ON COLUMN users.terms_version IS 'Version of terms accepted (e.g., 1.0)';

-- Create index for querying users who haven't accepted terms
CREATE INDEX IF NOT EXISTS idx_users_terms_accepted ON users(terms_accepted) WHERE terms_accepted = FALSE;
