-- Migration: 054_scheduled_exports.sql
-- Description: Create tables for scheduled export functionality
-- Date: 2026-02-02

-- ============================================
-- TABLE: scheduled_exports
-- ============================================
-- Stores scheduled export configurations for departments
-- Allows automatic generation and delivery of reports via email/Telegram

CREATE TABLE IF NOT EXISTS scheduled_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,

  -- Schedule configuration
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc. (for weekly)
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31), -- 1-31 (for monthly)
  send_time TIME NOT NULL, -- Time of day to send (e.g., '06:00:00')
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Almaty',

  -- Export configuration
  export_types JSONB NOT NULL, -- ['inventory', 'collections', 'audit']
  export_formats JSONB NOT NULL DEFAULT '["excel"]'::jsonb, -- ['excel', 'pdf']

  -- Filters for exports (optional)
  filters JSONB DEFAULT '{}'::jsonb,

  -- Delivery configuration
  delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('email', 'telegram', 'both')),

  -- Override settings (if NULL, use department/hotel settings)
  email_override VARCHAR(255),
  telegram_chat_id_override VARCHAR(100),

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Execution tracking
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(20) CHECK (last_run_status IN ('success', 'failed', 'partial')),
  last_run_error TEXT,
  next_run_at TIMESTAMP, -- Computed when creating/updating schedule

  -- Constraints
  CONSTRAINT valid_schedule CHECK (
    (schedule_type = 'daily') OR
    (schedule_type = 'weekly' AND day_of_week IS NOT NULL) OR
    (schedule_type = 'monthly' AND day_of_month IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_hotel ON scheduled_exports(hotel_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_department ON scheduled_exports(department_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run ON scheduled_exports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_active ON scheduled_exports(is_active);

-- ============================================
-- TABLE: scheduled_export_logs
-- ============================================
-- Logs execution history of scheduled exports

CREATE TABLE IF NOT EXISTS scheduled_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_export_id UUID NOT NULL REFERENCES scheduled_exports(id) ON DELETE CASCADE,

  -- Execution details
  run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),

  -- Results
  exports_generated INTEGER DEFAULT 0, -- Number of files created
  email_sent BOOLEAN DEFAULT false,
  telegram_sent BOOLEAN DEFAULT false,

  -- Error tracking
  error_message TEXT,
  details JSONB, -- { "inventory": { "records": 150, "size": "2.3MB" }, ... }

  -- Performance tracking
  duration_ms INTEGER, -- Execution time in milliseconds

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for logs
CREATE INDEX IF NOT EXISTS idx_scheduled_export_logs_scheduled_export ON scheduled_export_logs(scheduled_export_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_export_logs_run_at ON scheduled_export_logs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_export_logs_status ON scheduled_export_logs(status);

-- ============================================
-- FUNCTION: update_scheduled_export_timestamp
-- ============================================
-- Trigger function to update updated_at timestamp

CREATE OR REPLACE FUNCTION update_scheduled_export_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_scheduled_export_timestamp ON scheduled_exports;
CREATE TRIGGER trigger_update_scheduled_export_timestamp
  BEFORE UPDATE ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_export_timestamp();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE scheduled_exports IS 'Scheduled export configurations for automatic report generation and delivery';
COMMENT ON COLUMN scheduled_exports.schedule_type IS 'Type of schedule: daily, weekly, or monthly';
COMMENT ON COLUMN scheduled_exports.day_of_week IS 'Day of week (0-6, Sunday=0) for weekly schedules';
COMMENT ON COLUMN scheduled_exports.day_of_month IS 'Day of month (1-31) for monthly schedules';
COMMENT ON COLUMN scheduled_exports.export_types IS 'Array of export types to generate, e.g., ["inventory", "collections"]';
COMMENT ON COLUMN scheduled_exports.export_formats IS 'Array of file formats, e.g., ["excel", "pdf"]';
COMMENT ON COLUMN scheduled_exports.filters IS 'Optional filters to apply to exports';
COMMENT ON COLUMN scheduled_exports.delivery_method IS 'How to deliver reports: email, telegram, or both';
COMMENT ON COLUMN scheduled_exports.next_run_at IS 'Next scheduled execution time';

COMMENT ON TABLE scheduled_export_logs IS 'Execution history and logs for scheduled exports';
COMMENT ON COLUMN scheduled_export_logs.status IS 'Execution result: success, failed, or partial';
COMMENT ON COLUMN scheduled_export_logs.details IS 'JSON object with export details and statistics';
