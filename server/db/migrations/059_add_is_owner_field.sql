-- Migration 059: Add is_owner field to users table
-- Allows distinguishing primary (owner) super-admin from created super-admins
-- Only the owner super-admin can create other super-admins

-- Add column with default false
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Set is_owner = true for the existing seed superadmin
UPDATE users SET is_owner = TRUE
WHERE login = 'superadmin' AND role = 'SUPER_ADMIN';

-- Add partial index for quick lookup of owner
CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner) WHERE is_owner = TRUE;

-- Comment for documentation
COMMENT ON COLUMN users.is_owner IS 'Primary (owner) super-admin who can create other super-admins. Only one user should have is_owner=true.';
