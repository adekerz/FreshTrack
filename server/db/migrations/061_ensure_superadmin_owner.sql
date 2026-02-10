-- Migration 061: Ensure at least one SUPER_ADMIN always has is_owner=TRUE
-- 
-- Problem: Previous migrations (059, 060) relied on hardcoded login='superadmin'.
-- On production, if the super admin was created with a different login,
-- is_owner was never set to TRUE, breaking the "Create Super Admin" button.
--
-- Fix: Don't depend on login name. Simply ensure the oldest SUPER_ADMIN
-- gets is_owner=TRUE if nobody has it yet.

-- Guarantee: at least one SUPER_ADMIN must be owner
-- This works regardless of what login the super admin uses
DO $$
BEGIN
  -- If no user has is_owner=TRUE, make the oldest active SUPER_ADMIN the owner
  IF NOT EXISTS (SELECT 1 FROM users WHERE is_owner = TRUE) THEN
    UPDATE users SET is_owner = TRUE
    WHERE id = (
      SELECT id FROM users 
      WHERE role = 'SUPER_ADMIN' 
        AND is_active = TRUE
      ORDER BY created_at ASC 
      LIMIT 1
    );
    
    RAISE NOTICE 'is_owner flag set for the oldest SUPER_ADMIN';
  END IF;
END $$;
