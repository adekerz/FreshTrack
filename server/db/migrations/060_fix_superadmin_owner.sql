-- Migration 060: Fix is_owner flag for superadmin
-- Ensures that at least one superadmin has is_owner=true
-- Specifically targets the 'superadmin' login which is used on production

-- 1. Try to set is_owner for the standard 'superadmin' login
UPDATE users 
SET is_owner = TRUE 
WHERE login = 'superadmin' 
  AND role = 'SUPER_ADMIN'
  AND (is_owner IS NULL OR is_owner = FALSE);

-- 2. Safety net: If still no user is owner, make the first created SUPER_ADMIN the owner
-- This ensures that even if login is different, someone gets the rights
UPDATE users SET is_owner = TRUE
WHERE id = (
  SELECT id FROM users 
  WHERE role = 'SUPER_ADMIN' 
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_owner = TRUE)
  ORDER BY created_at ASC 
  LIMIT 1
);
