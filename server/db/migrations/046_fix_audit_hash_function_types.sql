-- Migration 046: Fix calculate_audit_hash function types
-- Fixes type mismatch: entity_id should be TEXT, created_at should be TIMESTAMPTZ

-- Ensure pgcrypto extension is enabled (required for digest function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop old function with old signature (VARCHAR, TIMESTAMP)
DROP FUNCTION IF EXISTS calculate_audit_hash(UUID, VARCHAR, VARCHAR, VARCHAR, UUID, JSONB, TIMESTAMP, VARCHAR);

-- Create function with correct types
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

-- Add comment
COMMENT ON FUNCTION calculate_audit_hash IS 'Calculates SHA256 hash for audit log entry (fixed types: TEXT for entity_id, TIMESTAMPTZ for created_at)';
