-- Migration: 057_departments_telegram_chat_id.sql
-- Добавляет telegram_chat_id в departments для scheduled exports и доставки отчётов в Telegram
-- Date: 2026-02-02

ALTER TABLE departments ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);

COMMENT ON COLUMN departments.telegram_chat_id IS 'Telegram chat ID for department notifications and scheduled reports';
