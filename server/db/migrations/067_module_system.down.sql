-- ═══════════════════════════════════════════════════════════════
-- Rollback Migration 067: Module System
-- ═══════════════════════════════════════════════════════════════

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_user_department_modules ON users;
DROP TRIGGER IF EXISTS trigger_update_user_modules ON department_modules;
DROP TRIGGER IF EXISTS trigger_assign_default_modules ON departments;

-- Drop functions
DROP FUNCTION IF EXISTS update_user_department_modules();
DROP FUNCTION IF EXISTS update_user_modules_cache();
DROP FUNCTION IF EXISTS assign_default_modules();

-- Drop tables
DROP TABLE IF EXISTS department_modules;
DROP TABLE IF EXISTS modules;

-- Remove added columns
ALTER TABLE departments DROP COLUMN IF EXISTS department_type;
ALTER TABLE departments DROP COLUMN IF EXISTS handles_food_products;
ALTER TABLE users DROP COLUMN IF EXISTS cached_modules;
