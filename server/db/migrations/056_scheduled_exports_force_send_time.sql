-- Migration: 056_scheduled_exports_force_send_time.sql
-- Гарантирует колонку send_time: переименовывает "time" в send_time или добавляет send_time
-- Date: 2026-02-02

DO $$
BEGIN
  -- Переименовать "time" в send_time; если колонки "time" нет — игнорировать
  BEGIN
    ALTER TABLE scheduled_exports RENAME COLUMN "time" TO send_time;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Если send_time всё ещё нет (таблица без time/send_time) — добавить
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scheduled_exports' AND column_name = 'send_time'
  ) THEN
    ALTER TABLE scheduled_exports ADD COLUMN send_time TIME NOT NULL DEFAULT '06:00:00';
  END IF;
END $$;
