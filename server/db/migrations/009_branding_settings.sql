-- FreshTrack PostgreSQL Migration 009
-- Branding Settings Seed (Phase 7.3)
-- ═══════════════════════════════════════════════════════════════
-- Adds default branding settings for customizable UI appearance
-- Hotels can override these at hotel scope for white-labeling

-- ═══════════════════════════════════════════════════════════════
-- STEP 0: Ensure scope column exists (dependency on 005)
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Add scope column if missing (in case 005 hasn't run yet)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'scope'
  ) THEN
    ALTER TABLE settings ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'hotel';
  END IF;
  
  -- Add description column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'description'
  ) THEN
    ALTER TABLE settings ADD COLUMN description TEXT;
  END IF;
  
  -- Make hotel_id nullable for system settings
  ALTER TABLE settings ALTER COLUMN hotel_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors
END $$;

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Seed branding system settings
-- ═══════════════════════════════════════════════════════════════

-- Use DO block for safe insert with proper error handling
DO $$
BEGIN
  -- Insert branding settings one by one to handle conflicts gracefully
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.primaryColor', '"#3B82F6"', 'system', 'Primary UI color (hex)')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.secondaryColor', '"#10B981"', 'system', 'Secondary/accent UI color (hex)')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.accentColor', '"#F59E0B"', 'system', 'Accent color for highlights (hex)')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.logoUrl', '"/assets/logo.svg"', 'system', 'Logo URL (relative or absolute)')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.faviconUrl', '"/favicon.ico"', 'system', 'Favicon URL')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.logoDark', '"/assets/logo-dark.svg"', 'system', 'Logo for dark theme')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.siteName', '"FreshTrack"', 'system', 'Application name displayed in UI')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.companyName', '"FreshTrack Inc."', 'system', 'Company name for footer/legal')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('branding.welcomeMessage', '"Добро пожаловать в FreshTrack!"', 'system', 'Welcome message on login')
  ON CONFLICT DO NOTHING;
  
  -- Locale settings
  INSERT INTO settings (key, value, scope, description) VALUES
  ('locale.language', '"ru"', 'system', 'Default UI language (ru, en, kk)')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('locale.dateFormat', '"DD.MM.YYYY"', 'system', 'Date format pattern')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('locale.timeFormat', '"HH:mm"', 'system', 'Time format pattern')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('locale.currency', '"KZT"', 'system', 'Default currency code')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO settings (key, value, scope, description) VALUES
  ('locale.timezone', '"Asia/Almaty"', 'system', 'Default timezone')
  ON CONFLICT DO NOTHING;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Branding settings insert failed: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Add index for branding keys lookup
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_settings_branding 
  ON settings(key) 
  WHERE key LIKE 'branding.%';

CREATE INDEX IF NOT EXISTS idx_settings_locale 
  ON settings(key) 
  WHERE key LIKE 'locale.%';

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Documentation
-- ═══════════════════════════════════════════════════════════════

COMMENT ON COLUMN settings.value IS 'JSONB value - for branding use quoted strings for hex colors';

-- ═══════════════════════════════════════════════════════════════
-- NOTE: Hotels can override branding at hotel scope:
-- 
-- INSERT INTO settings (key, value, scope, hotel_id, description) VALUES
-- ('branding.primaryColor', '"#FF5733"', 'hotel', 'hotel-uuid', 'Hotel custom color'),
-- ('branding.siteName', '"Grand Hotel Inventory"', 'hotel', 'hotel-uuid', 'Hotel name');
-- ═══════════════════════════════════════════════════════════════
