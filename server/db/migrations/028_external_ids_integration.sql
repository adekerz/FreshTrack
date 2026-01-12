-- ============================================================================
-- Migration 028: Таблица external_ids для интеграции с внешними системами
-- ============================================================================
-- Подготовка к интеграции с:
--   - OPERA (Oracle Hospitality)
--   - SAP
--   - PMS (Property Management System)
--   - Другие системы идентификации отелей
-- ============================================================================

-- Создаём enum для типов внешних систем
DO $$ BEGIN
  CREATE TYPE external_system AS ENUM ('MARSHA', 'OPERA', 'SAP', 'PMS', 'ORACLE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Таблица внешних идентификаторов
CREATE TABLE IF NOT EXISTS external_ids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  system external_system NOT NULL,
  external_code VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',  -- Дополнительные данные от внешней системы
  is_primary BOOLEAN DEFAULT false,  -- Основной идентификатор для этой системы
  verified_at TIMESTAMP,  -- Когда последний раз проверялся
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальность: один код на систему
  CONSTRAINT unique_external_code_per_system UNIQUE (system, external_code),
  -- Один отель может иметь только один код в каждой системе
  CONSTRAINT unique_hotel_per_system UNIQUE (hotel_id, system)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_external_ids_hotel ON external_ids(hotel_id);
CREATE INDEX IF NOT EXISTS idx_external_ids_system ON external_ids(system);
CREATE INDEX IF NOT EXISTS idx_external_ids_code ON external_ids(external_code);
CREATE INDEX IF NOT EXISTS idx_external_ids_system_code ON external_ids(system, external_code);

-- Триггер обновления updated_at
CREATE OR REPLACE FUNCTION update_external_ids_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_external_ids_updated_at ON external_ids;
CREATE TRIGGER trigger_external_ids_updated_at
  BEFORE UPDATE ON external_ids
  FOR EACH ROW
  EXECUTE FUNCTION update_external_ids_timestamp();

-- Комментарии
COMMENT ON TABLE external_ids IS 
'Внешние идентификаторы отелей для интеграции с системами: MARSHA (Marriott), OPERA, SAP, PMS и др.';

COMMENT ON COLUMN external_ids.system IS 
'Тип внешней системы: MARSHA, OPERA, SAP, PMS, ORACLE, OTHER';

COMMENT ON COLUMN external_ids.external_code IS 
'Код отеля во внешней системе (например, TSERZ для MARSHA)';

COMMENT ON COLUMN external_ids.metadata IS 
'Дополнительные данные от внешней системы в формате JSON';

COMMENT ON COLUMN external_ids.is_primary IS 
'Является ли этот идентификатор основным для данной системы';

COMMENT ON COLUMN external_ids.verified_at IS 
'Дата последней верификации кода во внешней системе';

-- ============================================================================
-- Миграция существующих MARSHA кодов в external_ids
-- ============================================================================
INSERT INTO external_ids (hotel_id, system, external_code, is_primary, verified_at)
SELECT 
  h.id,
  'MARSHA'::external_system,
  h.marsha_code,
  true,
  CURRENT_TIMESTAMP
FROM hotels h
WHERE h.marsha_code IS NOT NULL 
  AND h.marsha_code != ''
  AND h.is_active = true
ON CONFLICT (system, external_code) DO NOTHING;

-- Логируем результат миграции
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM external_ids WHERE system = 'MARSHA';
  RAISE NOTICE 'Migrated % MARSHA codes to external_ids table', migrated_count;
END $$;
