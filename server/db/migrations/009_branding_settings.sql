-- FreshTrack PostgreSQL Migration 009
-- Branding Settings Seed (Phase 7.3)
-- ═══════════════════════════════════════════════════════════════
-- Adds default branding settings for customizable UI appearance
-- Hotels can override these at hotel scope for white-labeling

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Seed branding system settings
-- ═══════════════════════════════════════════════════════════════

INSERT INTO settings (key, value, scope, description) VALUES
-- Primary branding colors
('branding.primaryColor', '"#3B82F6"', 'system', 'Primary UI color (hex)'),
('branding.secondaryColor', '"#10B981"', 'system', 'Secondary/accent UI color (hex)'),
('branding.accentColor', '"#F59E0B"', 'system', 'Accent color for highlights (hex)'),

-- Logo and favicon
('branding.logoUrl', '"/assets/logo.svg"', 'system', 'Logo URL (relative or absolute)'),
('branding.faviconUrl', '"/favicon.ico"', 'system', 'Favicon URL'),
('branding.logoDark', '"/assets/logo-dark.svg"', 'system', 'Logo for dark theme'),

-- Company/Site naming
('branding.siteName', '"FreshTrack"', 'system', 'Application name displayed in UI'),
('branding.companyName', '"FreshTrack Inc."', 'system', 'Company name for footer/legal'),
('branding.welcomeMessage', '"Добро пожаловать в FreshTrack!"', 'system', 'Welcome message on login'),

-- Locale settings (Phase 7.4)
('locale.language', '"ru"', 'system', 'Default UI language (ru, en, kk)'),
('locale.dateFormat', '"DD.MM.YYYY"', 'system', 'Date format pattern'),
('locale.timeFormat', '"HH:mm"', 'system', 'Time format pattern'),
('locale.currency', '"KZT"', 'system', 'Default currency code'),
('locale.timezone', '"Asia/Almaty"', 'system', 'Default timezone')

ON CONFLICT ON CONSTRAINT settings_unique_key_scope DO NOTHING;

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
