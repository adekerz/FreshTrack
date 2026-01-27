-- Migration 038: Audit Trail Integrity with Hash Chain
-- Implements cryptographic hash chain to detect tampering

-- Enable pgcrypto extension for digest function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add hash chain columns to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;

-- Index для быстрой верификации
CREATE INDEX IF NOT EXISTS idx_audit_hash_chain ON audit_logs(created_at, current_hash);

-- Таблица для хранения последнего хеша
CREATE TABLE IF NOT EXISTS audit_chain_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_hash VARCHAR(64) NOT NULL,
  last_entry_id UUID NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize с genesis hash (если таблица пустая)
DO $$
DECLARE
  first_entry_id UUID;
BEGIN
  -- Get first audit log entry if exists
  SELECT id INTO first_entry_id
  FROM audit_logs
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Initialize state if not exists
  IF NOT EXISTS (SELECT 1 FROM audit_chain_state WHERE id = 1) THEN
    INSERT INTO audit_chain_state (id, last_hash, last_entry_id)
    VALUES (
      1,
      '0000000000000000000000000000000000000000000000000000000000000000',
      COALESCE(first_entry_id, gen_random_uuid())
    );
  END IF;
END $$;

-- Function для вычисления хеша
CREATE OR REPLACE FUNCTION calculate_audit_hash(
  p_id UUID,
  p_entity_type VARCHAR,
  p_entity_id TEXT,
  p_action VARCHAR,
  p_user_id UUID,
  p_snapshot JSONB,
  p_created_at TIMESTAMPTZ,
  p_previous_hash VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_data TEXT;
BEGIN
  -- Concatenate все поля в deterministic order
  v_data := p_id::TEXT || 
            COALESCE(p_entity_type, '') || 
            COALESCE(p_entity_id::TEXT, '') || 
            COALESCE(p_action, '') || 
            COALESCE(p_user_id::TEXT, '') ||
            COALESCE(p_snapshot::TEXT, '{}') ||
            p_created_at::TEXT ||
            COALESCE(p_previous_hash, '0000000000000000000000000000000000000000000000000000000000000000');
  
  -- SHA256 hash
  RETURN encode(digest(v_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger для автоматического хеширования
CREATE OR REPLACE FUNCTION audit_log_hash_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_last_hash VARCHAR(64);
BEGIN
  -- Получаем последний хеш (с блокировкой для concurrency)
  SELECT last_hash INTO v_last_hash
  FROM audit_chain_state
  WHERE id = 1
  FOR UPDATE; -- Lock для concurrency
  
  -- Если нет предыдущего хеша, используем genesis hash
  IF v_last_hash IS NULL THEN
    v_last_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;
  
  -- Вычисляем хеши
  NEW.previous_hash := v_last_hash;
  NEW.current_hash := calculate_audit_hash(
    NEW.id,
    NEW.entity_type,
    NEW.entity_id::TEXT,
    NEW.action,
    NEW.user_id,
    COALESCE(NEW.snapshot_after, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW()),
    v_last_hash
  );
  
  -- Обновляем state
  UPDATE audit_chain_state
  SET last_hash = NEW.current_hash,
      last_entry_id = NEW.id,
      updated_at = NOW()
  WHERE id = 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS audit_log_hash_trigger ON audit_logs;

-- Create trigger
CREATE TRIGGER audit_log_hash_trigger
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_hash_trigger();

-- Add comments
COMMENT ON COLUMN audit_logs.previous_hash IS 'Hash of previous audit log entry (forms chain)';
COMMENT ON COLUMN audit_logs.current_hash IS 'Hash of this audit log entry (includes previous_hash)';
COMMENT ON COLUMN audit_logs.verified IS 'Whether this entry has been verified (set to false if tampering detected)';
