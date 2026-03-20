-- Add bundle_token to group export files from the same export run
ALTER TABLE export_files
  ADD COLUMN IF NOT EXISTS bundle_token UUID;

CREATE INDEX idx_export_files_bundle ON export_files (bundle_token) WHERE bundle_token IS NOT NULL;
