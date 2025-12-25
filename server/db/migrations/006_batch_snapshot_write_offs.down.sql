-- Rollback: Remove batch_snapshot column from write_offs
-- This reverses 006_batch_snapshot_write_offs.sql

ALTER TABLE write_offs DROP COLUMN IF EXISTS batch_snapshot;
