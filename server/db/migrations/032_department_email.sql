-- Add email field to departments table
-- Department inbox for system emails (expiry alerts, daily reports).
-- Example: kitchen@hotel.com

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_departments_email ON departments(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN departments.email IS 'Department inbox for system notifications (expiry alerts, daily reports). Not used for user/auth emails.';
