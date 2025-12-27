-- FreshTrack Migration 014: Fix v_notification_queue view
-- This migration drops and recreates the view to fix column structure issues

-- Drop the existing view to allow recreation with new columns
DROP VIEW IF EXISTS v_notification_queue;

-- Recreate the view with correct structure
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
