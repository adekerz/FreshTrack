-- Migration 025: Add warning/critical days thresholds to telegram_chats
-- Allows per-chat customization of notification thresholds
-- Hotel admins can set for all chats, department managers only for their department

-- Add columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'telegram_chats' AND column_name = 'warning_days') THEN
    ALTER TABLE telegram_chats ADD COLUMN warning_days INTEGER DEFAULT 7;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'telegram_chats' AND column_name = 'critical_days') THEN
    ALTER TABLE telegram_chats ADD COLUMN critical_days INTEGER DEFAULT 3;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'telegram_chats' AND column_name = 'updated_at') THEN
    ALTER TABLE telegram_chats ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN telegram_chats.warning_days IS 'Days before expiry to send warning notifications';
COMMENT ON COLUMN telegram_chats.critical_days IS 'Days before expiry to send critical notifications';
