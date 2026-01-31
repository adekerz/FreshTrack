-- Координаты отеля и флаг автоопределения timezone (GeoNames)
-- Для автоопределения timezone по городу и будущих гео-фич

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS timezone_auto_detected BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_hotels_coordinates ON hotels(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN hotels.latitude IS 'Hotel latitude (auto-detected via GeoNames)';
COMMENT ON COLUMN hotels.longitude IS 'Hotel longitude (auto-detected via GeoNames)';
COMMENT ON COLUMN hotels.timezone_auto_detected IS 'Whether timezone was auto-detected or manually set';
