-- Set development email for all active departments
-- This migration sets esimadilet@gmail.com for all active departments
-- to enable email notifications (system emails: daily reports, expiry warnings)

UPDATE departments
SET email = 'esimadilet@gmail.com'
WHERE is_active = TRUE
  AND (email IS NULL OR TRIM(email) = '');

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % departments with esimadilet@gmail.com', updated_count;
END $$;

COMMENT ON COLUMN departments.email IS 'Department inbox for system notifications (expiry alerts, daily reports). Not used for user/auth emails.';
