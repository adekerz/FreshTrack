-- Migration 073: Add session_id to collection_history
-- Groups all collection_history rows from a single FIFO collect call

ALTER TABLE collection_history
  ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS idx_collection_history_session_id
  ON collection_history (session_id)
  WHERE session_id IS NOT NULL;
