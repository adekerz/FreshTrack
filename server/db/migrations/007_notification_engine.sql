-- FreshTrack Migration 007: Notification Engine
-- ═══════════════════════════════════════════════════════════════
-- Phase 5: Centralized Notification System
-- 
-- Features:
-- - NotificationRules: WHO, WHEN, WHERE to notify
-- - TelegramChats: Bot-discovered chats linked to hotels/departments
-- - Enhanced notifications table with retry logic
-- - Deduplication via notification_hash
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Create notification_rules table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Context (null = system-wide rule)
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Rule type
  type VARCHAR(50) NOT NULL DEFAULT 'expiry',  -- expiry, low_stock, collection_reminder
  name VARCHAR(100),  -- Human-readable name
  description TEXT,
  
  -- Thresholds (for expiry rules)
  warning_days INTEGER NOT NULL DEFAULT 7,
  critical_days INTEGER NOT NULL DEFAULT 3,
  
  -- Channels (JSONB array)
  channels JSONB NOT NULL DEFAULT '["app"]',  -- ['app', 'telegram', 'email']
  
  -- Recipients (JSONB array of roles)
  recipient_roles JSONB NOT NULL DEFAULT '["HOTEL_ADMIN", "DEPARTMENT_MANAGER"]',
  
  -- Scheduling
  check_interval_hours INTEGER DEFAULT 1,  -- How often to check
  quiet_hours_start TIME,  -- Don't send between these hours
  quiet_hours_end TIME,
  
  -- Status
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  
  -- Note: Unique constraint with COALESCE handled via unique index below
  CONSTRAINT notification_rules_type_check 
    CHECK (type IN ('expiry', 'low_stock', 'collection_reminder', 'custom'))
);

-- Unique index for rule per context/type (functional index instead of constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_rules_unique 
  ON notification_rules(
    COALESCE(hotel_id, '00000000-0000-0000-0000-000000000000'), 
    COALESCE(department_id, '00000000-0000-0000-0000-000000000000'), 
    type
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_rules_hotel ON notification_rules(hotel_id) WHERE hotel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_rules_enabled ON notification_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_notification_rules_type ON notification_rules(type);

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Create telegram_chats table
-- Stores chats where the bot was added (groups/channels)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telegram_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Telegram identifiers
  chat_id BIGINT NOT NULL UNIQUE,  -- Telegram chat ID (can be negative for groups)
  chat_type VARCHAR(20) NOT NULL DEFAULT 'private',  -- private, group, supergroup, channel
  chat_title VARCHAR(255),  -- Group/channel name
  
  -- Link to FreshTrack context
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  
  -- What notifications to receive
  notification_types JSONB DEFAULT '["expiry", "low_stock"]',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  bot_removed BOOLEAN NOT NULL DEFAULT false,  -- True if bot was kicked
  
  -- Metadata
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by UUID REFERENCES users(id),  -- User who linked this chat
  last_message_at TIMESTAMP,
  
  -- Settings
  language VARCHAR(10) DEFAULT 'ru',
  silent_mode BOOLEAN DEFAULT false  -- Send without notification sound
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_chats_hotel ON telegram_chats(hotel_id) WHERE hotel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_chats_department ON telegram_chats(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_chats_active ON telegram_chats(is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Enhance notifications table with retry support
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Add retry_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE notifications ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add next_retry_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE notifications ADD COLUMN next_retry_at TIMESTAMP;
  END IF;
  
  -- Add failure_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE notifications ADD COLUMN failure_reason TEXT;
  END IF;
  
  -- Add notification_hash for deduplication
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'notification_hash'
  ) THEN
    ALTER TABLE notifications ADD COLUMN notification_hash VARCHAR(64);
  END IF;
  
  -- Add user_id for recipient tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  -- Add batch_id for linking to batch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;
  END IF;
  
  -- Add rule_id for linking to notification rule
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'rule_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL;
  END IF;
  
  -- Add telegram_chat_id for Telegram delivery tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'telegram_chat_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN telegram_chat_id BIGINT;
  END IF;
  
  -- Add telegram_message_id for edit/delete capability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'telegram_message_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN telegram_message_id BIGINT;
  END IF;
  
  -- Add priority for queue ordering
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE notifications ADD COLUMN priority INTEGER DEFAULT 0;
  END IF;
  
  -- Add status column if missing (for compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'status'
  ) THEN
    ALTER TABLE notifications ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 007 column additions skipped: %', SQLERRM;
END $$;

-- Indexes for retry queue processing
CREATE INDEX IF NOT EXISTS idx_notifications_retry 
  ON notifications(next_retry_at) 
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Index for deduplication check
CREATE INDEX IF NOT EXISTS idx_notifications_hash 
  ON notifications(notification_hash, created_at) 
  WHERE notification_hash IS NOT NULL;

-- Index for batch notifications
CREATE INDEX IF NOT EXISTS idx_notifications_batch 
  ON notifications(batch_id) 
  WHERE batch_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Remove legacy system notification rule
-- Users should create their own rules with custom thresholds
-- ═══════════════════════════════════════════════════════════════

-- Delete the old system rule if it exists
DELETE FROM notification_rules WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Create function for notification hash generation
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_notification_hash(
  p_type VARCHAR,
  p_batch_id UUID,
  p_user_id UUID,
  p_channel VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN MD5(
    COALESCE(p_type, '') || 
    COALESCE(p_batch_id::text, '') || 
    COALESCE(p_user_id::text, '') || 
    COALESCE(p_channel, '') ||
    TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')  -- Include date for 24h deduplication
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Create view for active notification queue
-- ═══════════════════════════════════════════════════════════════

-- Drop existing view first to allow column changes
DROP VIEW IF EXISTS v_notification_queue;

CREATE VIEW v_notification_queue AS
SELECT 
  n.*,
  u.name as user_name,
  u.telegram_chat_id as user_telegram_id,
  b.expiry_date,
  p.name as product_name
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
LEFT JOIN batches b ON n.batch_id = b.id
LEFT JOIN products p ON b.product_id = p.id
WHERE n.status IN ('pending', 'retry')
  AND (n.next_retry_at IS NULL OR n.next_retry_at <= NOW())
ORDER BY 
  n.priority DESC,
  n.created_at ASC;

COMMENT ON VIEW v_notification_queue IS 'Notifications ready to be sent (pending or due for retry)';
