-- FreshTrack PostgreSQL Migration 003
-- Full department isolation implementation
-- Phase 2: Enforce department ownership for data isolation

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Add DEPARTMENT_MANAGER role
-- ═══════════════════════════════════════════════════════════════

-- Update users role constraint to include DEPARTMENT_MANAGER
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role 
  CHECK (role IN ('SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER', 'STAFF'));

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Add department_id to categories (for department-specific categories)
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_department ON categories(department_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Add department_id to notifications if not exists
-- ═══════════════════════════════════════════════════════════════

-- Already exists in schema, just ensure index
CREATE INDEX IF NOT EXISTS idx_notifications_department ON notifications(department_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Populate missing department_id values
-- ═══════════════════════════════════════════════════════════════

-- For users without department_id, assign first department of their hotel
UPDATE users u
SET department_id = (
  SELECT d.id FROM departments d 
  WHERE d.hotel_id = u.hotel_id 
  AND d.is_active = TRUE
  ORDER BY d.created_at ASC
  LIMIT 1
)
WHERE u.department_id IS NULL 
  AND u.hotel_id IS NOT NULL
  AND u.role NOT IN ('SUPER_ADMIN', 'HOTEL_ADMIN');

-- For products without department_id, assign first department of their hotel
UPDATE products p
SET department_id = (
  SELECT d.id FROM departments d 
  WHERE d.hotel_id = p.hotel_id 
  AND d.is_active = TRUE
  ORDER BY d.created_at ASC
  LIMIT 1
)
WHERE p.department_id IS NULL;

-- For write_offs without department_id, get from batch or user
UPDATE write_offs w
SET department_id = COALESCE(
  (SELECT b.department_id FROM batches b WHERE b.id = w.batch_id),
  (SELECT u.department_id FROM users u WHERE u.id = w.written_off_by),
  (SELECT d.id FROM departments d WHERE d.hotel_id = w.hotel_id AND d.is_active = TRUE ORDER BY d.created_at ASC LIMIT 1)
)
WHERE w.department_id IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Create department_settings table if not exists
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS department_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(department_id, key)
);

CREATE INDEX IF NOT EXISTS idx_department_settings_hotel ON department_settings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_department_settings_dept ON department_settings(department_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 5b: Create user_settings table for user-level settings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Add composite indexes for better query performance
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_batches_hotel_department ON batches(hotel_id, department_id);
CREATE INDEX IF NOT EXISTS idx_products_hotel_department ON products(hotel_id, department_id);
CREATE INDEX IF NOT EXISTS idx_write_offs_hotel_department ON write_offs(hotel_id, department_id);
CREATE INDEX IF NOT EXISTS idx_users_hotel_department ON users(hotel_id, department_id);
