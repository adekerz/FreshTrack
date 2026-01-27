-- Migration 043: Consolidate Email Verification Fields
-- Consolidates email_verified into email_confirmed for departments
-- Removes deprecated code-based verification fields

-- Переносим данные из email_verified в email_confirmed для departments
UPDATE departments
SET email_confirmed = COALESCE(email_verified, FALSE),
    email_confirmed_at = CASE 
      WHEN email_verified = TRUE THEN COALESCE(email_confirmed_at, NOW())
      ELSE NULL 
    END
WHERE email_verified IS NOT NULL OR email_confirmed IS NULL;

-- Удаляем старое поле email_verified
ALTER TABLE departments DROP COLUMN IF EXISTS email_verified;

-- Удаляем deprecated code-based verification fields
ALTER TABLE departments DROP COLUMN IF EXISTS email_verification_code;
ALTER TABLE departments DROP COLUMN IF EXISTS email_verification_expires;
ALTER TABLE departments DROP COLUMN IF EXISTS email_verification_attempts;

-- Add comments
COMMENT ON COLUMN departments.email_confirmed IS 'Whether department email has been confirmed (link-based, simplified)';
COMMENT ON COLUMN departments.email_confirmed_at IS 'Timestamp when email was confirmed';
COMMENT ON COLUMN departments.email_unsubscribe_token IS 'Token for unsubscribing from department emails';
