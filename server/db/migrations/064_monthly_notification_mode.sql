-- Migration 064: Monthly notification mode
-- Adds notification_mode (daily|monthly) and warning_months to notification_rules

ALTER TABLE notification_rules
  ADD COLUMN IF NOT EXISTS notification_mode VARCHAR(20) NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS warning_months    INTEGER DEFAULT 2;

-- Constraint: valid modes only
ALTER TABLE notification_rules
  DROP CONSTRAINT IF EXISTS chk_notification_mode;
ALTER TABLE notification_rules
  ADD CONSTRAINT chk_notification_mode
  CHECK (notification_mode IN ('daily', 'monthly'));

-- Also copy new columns when toggling a system rule into a hotel-specific copy
-- (handled in application code, no SQL change needed here)

COMMENT ON COLUMN notification_rules.notification_mode IS
  'daily = notify when days_left <= warning_days (existing); monthly = group by expiry month within warning_months lookahead';
COMMENT ON COLUMN notification_rules.warning_months IS
  'For monthly mode: how many months ahead to include in the report (e.g. 2 = this month + next month)';
