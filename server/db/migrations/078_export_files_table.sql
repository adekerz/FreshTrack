CREATE TABLE IF NOT EXISTS export_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  scheduled_export_id UUID REFERENCES scheduled_exports(id) ON DELETE SET NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  file_data BYTEA NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_export_files_token ON export_files (token);
CREATE INDEX idx_export_files_expires ON export_files (expires_at) WHERE NOT is_revoked;
CREATE INDEX idx_export_files_hotel ON export_files (hotel_id, department_id);
