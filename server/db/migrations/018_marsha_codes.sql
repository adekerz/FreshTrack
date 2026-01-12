-- Migration: Add MARSHA codes registry and update hotels
-- Created: 2026-01-02

-- Включаем расширение pg_trgm для fuzzy search (триграммы)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Таблица реестра MARSHA кодов Marriott
CREATE TABLE IF NOT EXISTS marsha_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(5) NOT NULL UNIQUE,
  hotel_name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  is_assigned BOOLEAN DEFAULT FALSE,
  assigned_to_hotel_id UUID REFERENCES hotels(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_marsha_codes_code ON marsha_codes(code);
CREATE INDEX IF NOT EXISTS idx_marsha_codes_hotel_name ON marsha_codes(hotel_name);
CREATE INDEX IF NOT EXISTS idx_marsha_codes_city ON marsha_codes(city);
CREATE INDEX IF NOT EXISTS idx_marsha_codes_country ON marsha_codes(country);
CREATE INDEX IF NOT EXISTS idx_marsha_codes_is_assigned ON marsha_codes(is_assigned);
CREATE INDEX IF NOT EXISTS idx_marsha_codes_assigned_to ON marsha_codes(assigned_to_hotel_id);

-- Полнотекстовый поиск для fuzzy matching по названию
CREATE INDEX IF NOT EXISTS idx_marsha_codes_name_trgm ON marsha_codes USING gin (hotel_name gin_trgm_ops);

-- Добавляем поле marsha_code в таблицу hotels
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS marsha_code VARCHAR(5);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS marsha_code_id UUID REFERENCES marsha_codes(id) ON DELETE SET NULL;

-- Индекс для поиска по marsha_code
CREATE INDEX IF NOT EXISTS idx_hotels_marsha_code ON hotels(marsha_code);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_marsha_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_marsha_codes_updated_at ON marsha_codes;
CREATE TRIGGER trigger_marsha_codes_updated_at
  BEFORE UPDATE ON marsha_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_marsha_codes_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE marsha_codes IS 'Registry of Marriott MARSHA hotel codes';
COMMENT ON COLUMN marsha_codes.code IS '5-character MARSHA code (e.g., TSEXR)';
COMMENT ON COLUMN marsha_codes.hotel_name IS 'Official Marriott hotel name';
COMMENT ON COLUMN marsha_codes.brand IS 'Marriott brand (St. Regis, Ritz-Carlton, etc.)';
COMMENT ON COLUMN marsha_codes.is_assigned IS 'Whether this code is assigned to a hotel in our system';
