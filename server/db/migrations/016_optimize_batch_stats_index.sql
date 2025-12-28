-- ============================================
-- Migration 016: Optimize getBatchStats query
-- Composite index for status-based batch counting
-- ============================================

-- Composite index for getBatchStats optimization
-- Covers: hotel_id, department_id, status, expiry_date (in that order for query pattern)
CREATE INDEX IF NOT EXISTS idx_batches_stats_composite 
  ON batches(hotel_id, department_id, status, expiry_date);

-- Partial index for active batches only (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_batches_active_expiry 
  ON batches(hotel_id, department_id, expiry_date) 
  WHERE status = 'active';
