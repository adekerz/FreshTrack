-- ═══════════════════════════════════════════════════════════════
-- Migration 011: Add missing columns to notifications table
-- ═══════════════════════════════════════════════════════════════
-- Date: 2025-12-27
-- Description: Adds 'data' and 'channels' columns required by NotificationEngine
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Add data column for storing additional notification metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'data'
  ) THEN
    ALTER TABLE notifications ADD COLUMN data JSONB DEFAULT '{}';
    RAISE NOTICE 'Added data column to notifications table';
  END IF;
  
  -- Add channels column for multi-channel delivery tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'channels'
  ) THEN
    ALTER TABLE notifications ADD COLUMN channels JSONB DEFAULT '["app"]';
    RAISE NOTICE 'Added channels column to notifications table';
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 011 error: %', SQLERRM;
END $$;

-- Index for data search (GIN for JSONB)
CREATE INDEX IF NOT EXISTS idx_notifications_data 
  ON notifications USING GIN (data) 
  WHERE data IS NOT NULL AND data != '{}';
