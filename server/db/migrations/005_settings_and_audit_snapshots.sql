-- FreshTrack PostgreSQL Migration 005
-- Hierarchical Settings System and Enhanced Audit Snapshots
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- STEP 0: Upgrade existing settings table OR create new one
-- ═══════════════════════════════════════════════════════════════

-- If settings table exists from 001, add missing columns
DO $$
BEGIN
  -- Add scope column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'scope'
  ) THEN
    ALTER TABLE settings ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'hotel';
  END IF;
  
  -- Add department_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE settings ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
  
  -- Add user_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add description column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'description'
  ) THEN
    ALTER TABLE settings ADD COLUMN description TEXT;
  END IF;
  
  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE settings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
  
  -- Make hotel_id nullable (system settings have NULL hotel_id)
  ALTER TABLE settings ALTER COLUMN hotel_id DROP NOT NULL;
  
  -- Change value type to JSONB if it's TEXT
  -- First, wrap non-JSON text values in quotes to make them valid JSON strings
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'value' AND data_type = 'text'
  ) THEN
    -- Update invalid JSON values to be wrapped in quotes
    UPDATE settings 
    SET value = '"' || REPLACE(value::text, '"', '\"') || '"'
    WHERE value IS NOT NULL 
      AND value::text NOT LIKE '{%' 
      AND value::text NOT LIKE '[%' 
      AND value::text NOT LIKE '"%'
      AND value::text NOT SIMILAR TO '[0-9]+(\.[0-9]+)?'
      AND value::text NOT IN ('true', 'false', 'null');
    
    -- Now safely convert to JSONB
    ALTER TABLE settings ALTER COLUMN value TYPE JSONB USING value::jsonb;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 005 value conversion skipped: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Create settings table if it doesn't exist (fresh install)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL,
  value JSONB,
  scope VARCHAR(20) NOT NULL DEFAULT 'system',  -- system, hotel, department, user
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint via functional index (COALESCE not allowed in UNIQUE constraints)
DO $$
BEGIN
  -- Try to drop old constraint
  ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_hotel_id_key_key;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if doesn't exist
END $$;

-- Remove duplicate settings before creating unique index
DELETE FROM settings a USING settings b
WHERE a.id < b.id 
  AND a.key = b.key 
  AND COALESCE(a.scope, 'hotel') = COALESCE(b.scope, 'hotel')
  AND COALESCE(a.hotel_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.hotel_id, '00000000-0000-0000-0000-000000000000')
  AND COALESCE(a.department_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.department_id, '00000000-0000-0000-0000-000000000000')
  AND COALESCE(a.user_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.user_id, '00000000-0000-0000-0000-000000000000');

-- Drop old index if exists with different definition
DROP INDEX IF EXISTS idx_settings_unique_key_scope;

-- Create unique functional index instead of constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_unique_key_scope
  ON settings(
    key, 
    scope, 
    COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000'), 
    COALESCE(department_id, '00000000-0000-0000-0000-000000000000'), 
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000')
  );

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope);
CREATE INDEX IF NOT EXISTS idx_settings_hotel ON settings(hotel_id) WHERE hotel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settings_department ON settings(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id) WHERE user_id IS NOT NULL;

-- Composite index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_settings_hierarchy 
  ON settings(key, scope, hotel_id, department_id, user_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Seed default system settings
-- ═══════════════════════════════════════════════════════════════

INSERT INTO settings (key, value, scope, description) VALUES
-- Expiry thresholds
('expiry.critical.days', '3', 'system', 'Days threshold for critical expiry status'),
('expiry.warning.days', '7', 'system', 'Days threshold for warning expiry status'),

-- Notification settings
('notify.expiry.enabled', 'true', 'system', 'Enable expiry notifications'),
('notify.expiry.daysBefore', '[1, 3, 7]', 'system', 'Days before expiry to send notifications'),
('notify.channels', '["telegram", "push"]', 'system', 'Default notification channels'),
('notify.schedule', '"daily"', 'system', 'Notification schedule: immediate, daily, weekly'),

-- Display settings
('display.dateFormat', '"dd.MM.yyyy"', 'system', 'Date format for display'),
('display.locale', '"ru"', 'system', 'Default locale'),
('display.timezone', '"Asia/Almaty"', 'system', 'Default timezone'),

-- FIFO settings
('fifo.enabled', 'true', 'system', 'Enable FIFO algorithm for batch collection'),
('fifo.sortBy', '"expiry_date"', 'system', 'Field to sort by for FIFO'),

-- Statistics settings
('stats.defaultPeriod', '"month"', 'system', 'Default statistics period'),

-- Export settings
('export.defaultFormat', '"xlsx"', 'system', 'Default export format')

ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Enhance audit_logs table with snapshot support
-- ═══════════════════════════════════════════════════════════════

-- Add snapshot columns if they don't exist
DO $$
BEGIN
  -- Add snapshot_before column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'snapshot_before'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN snapshot_before JSONB;
  END IF;
  
  -- Add snapshot_after column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'snapshot_after'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN snapshot_after JSONB;
  END IF;
  
  -- Add changes_diff column for computed differences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'changes_diff'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN changes_diff JSONB;
  END IF;
END $$;

-- Index for searching by entity snapshots
CREATE INDEX IF NOT EXISTS idx_audit_logs_snapshots 
  ON audit_logs USING GIN (snapshot_before, snapshot_after);

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Create function to compute changes diff
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_audit_diff()
RETURNS TRIGGER AS $$
BEGIN
  -- Only compute diff if both snapshots exist
  IF NEW.snapshot_before IS NOT NULL AND NEW.snapshot_after IS NOT NULL THEN
    -- Compute the difference (fields that changed)
    NEW.changes_diff := (
      SELECT jsonb_object_agg(key, jsonb_build_object(
        'before', NEW.snapshot_before->key,
        'after', NEW.snapshot_after->key
      ))
      FROM jsonb_each(NEW.snapshot_after)
      WHERE NEW.snapshot_before->key IS DISTINCT FROM NEW.snapshot_after->key
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-computing diff
DROP TRIGGER IF EXISTS trigger_audit_compute_diff ON audit_logs;
CREATE TRIGGER trigger_audit_compute_diff
  BEFORE INSERT OR UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION compute_audit_diff();

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Create view for settings with inheritance resolution
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_settings_resolved AS
WITH ranked_settings AS (
  SELECT 
    key,
    value,
    scope,
    hotel_id,
    department_id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY key, 
        COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000'),
        COALESCE(department_id, '00000000-0000-0000-0000-000000000000'),
        COALESCE(user_id, '00000000-0000-0000-0000-000000000000')
      ORDER BY 
        CASE scope 
          WHEN 'user' THEN 4 
          WHEN 'department' THEN 3 
          WHEN 'hotel' THEN 2 
          WHEN 'system' THEN 1 
        END DESC
    ) as priority_rank
  FROM settings
)
SELECT 
  key,
  value,
  scope as resolved_from_scope,
  hotel_id,
  department_id,
  user_id
FROM ranked_settings
WHERE priority_rank = 1;

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Create helper function for getting setting with hierarchy
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_setting(
  p_key VARCHAR,
  p_hotel_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  -- Try user-level first
  IF p_user_id IS NOT NULL THEN
    SELECT value INTO v_value 
    FROM settings 
    WHERE key = p_key AND scope = 'user' AND user_id = p_user_id;
    IF FOUND THEN RETURN v_value; END IF;
  END IF;
  
  -- Try department-level
  IF p_department_id IS NOT NULL THEN
    SELECT value INTO v_value 
    FROM settings 
    WHERE key = p_key AND scope = 'department' AND department_id = p_department_id;
    IF FOUND THEN RETURN v_value; END IF;
  END IF;
  
  -- Try hotel-level
  IF p_hotel_id IS NOT NULL THEN
    SELECT value INTO v_value 
    FROM settings 
    WHERE key = p_key AND scope = 'hotel' AND hotel_id = p_hotel_id;
    IF FOUND THEN RETURN v_value; END IF;
  END IF;
  
  -- Fall back to system-level
  SELECT value INTO v_value 
  FROM settings 
  WHERE key = p_key AND scope = 'system';
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- STEP 7: Add comment documentation
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE settings IS 'Hierarchical settings with inheritance: system → hotel → department → user';
COMMENT ON COLUMN settings.scope IS 'Setting scope: system (global), hotel, department, user';
COMMENT ON COLUMN settings.value IS 'JSONB value allowing any type of setting data';

COMMENT ON COLUMN audit_logs.snapshot_before IS 'Complete entity state before the action';
COMMENT ON COLUMN audit_logs.snapshot_after IS 'Complete entity state after the action';
COMMENT ON COLUMN audit_logs.changes_diff IS 'Computed diff showing only changed fields';

