-- Migration: Remove legacy hotel.code column
-- Hotels now use only marsha_code for identification

-- Make marsha_code the primary identifier (NOT NULL for new hotels)
-- Existing hotels without MARSHA code will keep NULL

-- Remove the legacy code column
ALTER TABLE hotels DROP COLUMN IF EXISTS code;

-- Add comment
COMMENT ON COLUMN hotels.marsha_code IS 'Marriott MARSHA code - primary hotel identifier';
