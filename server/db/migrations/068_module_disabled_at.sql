-- ═══════════════════════════════════════════════════════════════
-- Migration 068: Module disabled_at tracking
-- Добавляем disabled_at/disabled_by для отслеживания периода неактивности
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'department_modules' AND column_name = 'disabled_at'
  ) THEN
    ALTER TABLE department_modules ADD COLUMN disabled_at TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'department_modules' AND column_name = 'disabled_by'
  ) THEN
    ALTER TABLE department_modules ADD COLUMN disabled_by UUID REFERENCES users(id);
  END IF;
END $$;
