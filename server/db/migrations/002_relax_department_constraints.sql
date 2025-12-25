-- FreshTrack PostgreSQL Migration 002
-- Relax department_id constraints and add department_id to products
-- Some entities may not have department_id assigned initially

-- Make department_id nullable in write_offs table
ALTER TABLE write_offs 
  ALTER COLUMN department_id DROP NOT NULL;

-- Add department_id to products table (optional, for department-specific products)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE products ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_write_offs_department ON write_offs(department_id);
CREATE INDEX IF NOT EXISTS idx_products_department ON products(department_id);
