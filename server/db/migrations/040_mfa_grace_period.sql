-- Migration 040: MFA Grace Period
-- Adds grace period for SUPER_ADMIN to set up MFA

-- Grace period для SUPER_ADMIN
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_grace_period_ends TIMESTAMP;

-- Функция для установки grace period при назначении роли SUPER_ADMIN
CREATE OR REPLACE FUNCTION set_mfa_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Если роль изменена на SUPER_ADMIN
  IF NEW.role = 'SUPER_ADMIN' AND (OLD.role IS NULL OR OLD.role != 'SUPER_ADMIN') THEN
    NEW.mfa_required := TRUE;
    -- Устанавливаем grace period только если MFA еще не включен
    IF NOT NEW.mfa_enabled THEN
      NEW.mfa_grace_period_ends := NOW() + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS mfa_grace_period_trigger ON users;

-- Create trigger
CREATE TRIGGER mfa_grace_period_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'SUPER_ADMIN')
  EXECUTE FUNCTION set_mfa_grace_period();

-- Set grace period для существующих SUPER_ADMIN (если MFA не включен)
UPDATE users
SET mfa_grace_period_ends = NOW() + INTERVAL '30 days'
WHERE role = 'SUPER_ADMIN'
  AND mfa_required = TRUE
  AND NOT mfa_enabled
  AND mfa_grace_period_ends IS NULL;

-- Add comment
COMMENT ON COLUMN users.mfa_grace_period_ends IS 'End date of grace period for MFA setup (30 days from role assignment)';
