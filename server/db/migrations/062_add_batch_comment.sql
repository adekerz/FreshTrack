-- Migration 062: Add comment column to batches table
-- Allows storing a comment per batch (e.g. from fast intake template)

ALTER TABLE batches ADD COLUMN IF NOT EXISTS comment TEXT;
