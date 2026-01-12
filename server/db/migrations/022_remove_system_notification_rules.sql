-- Migration 022: Remove system notification rules
-- These rules with hotel_id IS NULL were causing issues with hotel-specific operations

-- Delete all system-wide notification rules
DELETE FROM notification_rules WHERE hotel_id IS NULL;

-- Comment out the seed in migration 007 is not needed since ON CONFLICT DO NOTHING
-- and we're deleting them here
