-- Migration: 055_scheduled_exports_rename_time.sql
-- Rename reserved word column "time" to send_time in scheduled_exports (for DBs created with 054 before the rename)
-- Date: 2026-02-02

DO $$
BEGIN
  -- Если есть столбец time (зарезервированное слово) — переименовать в send_time
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scheduled_exports' AND column_name = 'time'
  ) THEN
    ALTER TABLE scheduled_exports RENAME COLUMN "time" TO send_time;
  END IF;

  -- Если таблица есть, но нет send_time — добавить (на случай другой схемы)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_exports')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scheduled_exports' AND column_name = 'send_time')
  THEN
    ALTER TABLE scheduled_exports ADD COLUMN send_time TIME NOT NULL DEFAULT '06:00';
  END IF;
END $$;
