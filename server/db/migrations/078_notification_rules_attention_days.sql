-- Add attention_days column for intermediate severity level (between warning and critical)
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS attention_days INTEGER DEFAULT 5;
