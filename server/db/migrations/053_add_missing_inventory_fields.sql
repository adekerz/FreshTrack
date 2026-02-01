-- Migration 053: Add missing fields to categories and products tables
-- These fields are used in the code but were never added to the schema

-- ═══════════════════════════════════════════════════════════════
-- Add missing fields to categories table
-- ═══════════════════════════════════════════════════════════════

-- Add description field to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE categories ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add parent_id field to categories (for hierarchical categories)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for parent_id
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ═══════════════════════════════════════════════════════════════
-- Add missing fields to products table
-- ═══════════════════════════════════════════════════════════════

-- Add description field to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add storage_type field to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'storage_type'
  ) THEN
    ALTER TABLE products ADD COLUMN storage_type VARCHAR(50) DEFAULT 'room_temp';
  END IF;
END $$;

-- Add min_stock field to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'min_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add image_url field to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add updated_at field to products if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Add updated_at field to categories if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Add updated_at field to batches if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE batches ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Add created_at field to batches if missing (rename from added_at for consistency)
-- Note: We keep added_at for backward compatibility and add created_at separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE batches ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    -- Copy values from added_at to created_at for existing records
    UPDATE batches SET created_at = added_at WHERE created_at IS NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_storage_type ON products(storage_type);
CREATE INDEX IF NOT EXISTS idx_products_description ON products(description);
CREATE INDEX IF NOT EXISTS idx_categories_description ON categories(description);
