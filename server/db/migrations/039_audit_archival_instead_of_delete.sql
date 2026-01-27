-- Migration 039: Audit Archival Instead of Delete
-- Fixes hash chain integrity by archiving instead of deleting old audit logs

-- Добавить колонку для архивации
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- Index для быстрого поиска активных записей
CREATE INDEX IF NOT EXISTS idx_audit_active ON audit_logs(created_at) WHERE archived = FALSE;

-- Функция для безопасной архивации (preserves hash chain)
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_years INTEGER)
RETURNS INTEGER AS $$
DECLARE
  cutoff_date TIMESTAMP;
  archived_count INTEGER;
BEGIN
  cutoff_date := NOW() - (retention_years || ' years')::INTERVAL;
  
  UPDATE audit_logs
  SET archived = TRUE,
      archived_at = NOW()
  WHERE created_at < cutoff_date
    AND archived = FALSE
    AND entity_type NOT IN ('USER_DELETE', 'SECURITY_INCIDENT')
    AND action NOT IN ('gdpr_account_deletion', 'security_breach')
  RETURNING COUNT(*) INTO archived_count;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON COLUMN audit_logs.archived IS 'Whether this audit log entry has been archived (preserves hash chain)';
COMMENT ON COLUMN audit_logs.archived_at IS 'Timestamp when entry was archived';
