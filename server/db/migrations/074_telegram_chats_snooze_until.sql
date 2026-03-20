-- Migration 074: Add snooze_until to telegram_chats
ALTER TABLE telegram_chats
  ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;
