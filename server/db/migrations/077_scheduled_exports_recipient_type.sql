-- Migration: 077_scheduled_exports_recipient_type.sql
-- Description: Add recipient_type to scheduled_exports to support personal delivery
-- Date: 2026-03-11
--
-- 'department' (default) — send to department email/telegram as before
-- 'personal'             — send to the email/telegram of the user who created the schedule (created_by)

ALTER TABLE scheduled_exports
  ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20) NOT NULL DEFAULT 'department'
    CHECK (recipient_type IN ('department', 'personal'));

COMMENT ON COLUMN scheduled_exports.recipient_type IS
  'Delivery target: department (dept email/telegram) or personal (creator user email/telegram)';
