-- Rollback 070: Restore telegram_chats threshold defaults to 7/3
ALTER TABLE telegram_chats
  ALTER COLUMN warning_days  SET DEFAULT 7,
  ALTER COLUMN critical_days SET DEFAULT 3;
