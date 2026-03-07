-- Migration 070: Fix telegram_chats threshold defaults
-- Problem: Migration 025 added warning_days DEFAULT 7 and critical_days DEFAULT 3
-- to telegram_chats. Since every row gets these non-NULL values, getNotificationThresholds()
-- always short-circuits on the per-chat override and never reads notification_rules.
-- Fix: Change defaults to NULL and reset existing rows that have the original default
-- values (7/3) back to NULL so they fall through to the hotel notification_rules.

ALTER TABLE telegram_chats
  ALTER COLUMN warning_days  SET DEFAULT NULL,
  ALTER COLUMN critical_days SET DEFAULT NULL;

-- Reset rows that only have the old hardcoded defaults (not explicitly customised)
UPDATE telegram_chats
SET warning_days  = NULL
WHERE warning_days = 7;

UPDATE telegram_chats
SET critical_days = NULL
WHERE critical_days = 3;
