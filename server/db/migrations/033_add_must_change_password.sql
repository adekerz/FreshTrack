-- Add must_change_password flag to users table
-- This flag indicates that user must change password on next login (temporary password)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_must_change_password 
ON users(must_change_password) WHERE must_change_password = TRUE;

COMMENT ON COLUMN users.must_change_password IS 'User must change password on next login (temporary password was set)';
