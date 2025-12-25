-- FreshTrack Migration 006: Batch Snapshot in Write-offs
-- ═══════════════════════════════════════════════════════════════
-- Adds batch_snapshot JSONB column to write_offs table
-- Preserves enriched batch data at write-off time including:
-- - Product details (name, category, department)
-- - Expiry information (expiryDate, daysLeft at write-off time)
-- - Status information (expiryStatus, statusColor, statusText)
-- 
-- This ensures historical consistency for collection history:
-- even after batch/product deletion, the UI can display
-- correct names, dates, and colors from the snapshot.
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Add batch_snapshot column to write_offs
DO $$
BEGIN
  -- Add batch_snapshot column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'write_offs' AND column_name = 'batch_snapshot'
  ) THEN
    ALTER TABLE write_offs ADD COLUMN batch_snapshot JSONB;
    COMMENT ON COLUMN write_offs.batch_snapshot IS 'Enriched batch data at write-off time (product, expiry status, colors)';
  END IF;
  
  -- Add expiry_date column for quick filtering (denormalized from snapshot)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'write_offs' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE write_offs ADD COLUMN expiry_date DATE;
    COMMENT ON COLUMN write_offs.expiry_date IS 'Expiry date from batch (denormalized for queries)';
  END IF;
  
  -- Add expiry_status column for quick filtering
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'write_offs' AND column_name = 'expiry_status'
  ) THEN
    ALTER TABLE write_offs ADD COLUMN expiry_status VARCHAR(20);
    COMMENT ON COLUMN write_offs.expiry_status IS 'Expiry status at write-off time (expired, critical, warning, good)';
  END IF;
END $$;

-- STEP 2: Create index on batch_snapshot for JSONB queries
CREATE INDEX IF NOT EXISTS idx_write_offs_batch_snapshot 
  ON write_offs USING GIN (batch_snapshot);

-- STEP 3: Create index on expiry_status for filtering
CREATE INDEX IF NOT EXISTS idx_write_offs_expiry_status 
  ON write_offs(expiry_status);

-- STEP 4: Create index on expiry_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_write_offs_expiry_date 
  ON write_offs(expiry_date);

-- STEP 5: Backfill existing write_offs with data from batches (if batch still exists)
UPDATE write_offs w
SET 
  expiry_date = b.expiry_date,
  batch_snapshot = jsonb_build_object(
    'id', b.id,
    'product_id', b.product_id,
    'product_name', COALESCE(p.name, w.product_name),
    'quantity', b.quantity,
    'expiry_date', b.expiry_date,
    'department_id', b.department_id,
    'category_name', c.name,
    -- Note: expiryStatus will be calculated at query time for historical data
    'snapshot_at', w.written_off_at
  )
FROM batches b
LEFT JOIN products p ON b.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE w.batch_id = b.id 
  AND w.batch_snapshot IS NULL;

-- STEP 6: For write_offs where batch is already deleted, preserve what we have
UPDATE write_offs w
SET batch_snapshot = jsonb_build_object(
  'product_name', w.product_name,
  'quantity', w.quantity,
  'reason', w.reason,
  'snapshot_at', w.written_off_at,
  'note', 'Partial snapshot - batch was already deleted'
)
WHERE w.batch_snapshot IS NULL 
  AND w.batch_id IS NULL;

COMMENT ON TABLE write_offs IS 
  'Write-off journal with batch snapshots for historical consistency. '
  'batch_snapshot preserves enriched batch data (status, colors) at write-off time.';
