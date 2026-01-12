-- ═══════════════════════════════════════════════════════════════
-- Migration 020: Fix FK constraints on users table for proper deletion
-- ═══════════════════════════════════════════════════════════════

-- Fix join_requests.processed_by - set NULL on delete
ALTER TABLE join_requests 
DROP CONSTRAINT IF EXISTS join_requests_processed_by_fkey;

ALTER TABLE join_requests 
ADD CONSTRAINT join_requests_processed_by_fkey 
FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;

-- Fix notification_rules.created_by - set NULL on delete (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_rules') THEN
    EXECUTE 'ALTER TABLE notification_rules DROP CONSTRAINT IF EXISTS notification_rules_created_by_fkey';
    EXECUTE 'ALTER TABLE notification_rules ADD CONSTRAINT notification_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- Verification query (run manually to check):
-- SELECT conname, conrelid::regclass, confrelid::regclass, confdeltype 
-- FROM pg_constraint 
-- WHERE confrelid = 'users'::regclass;
