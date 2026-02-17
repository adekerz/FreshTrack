-- Migration 063: Backfill hotel_id in audit_logs for records where it is NULL
-- Matches audit log entries to hotels via the user who performed the action

UPDATE audit_logs al
SET hotel_id = u.hotel_id
FROM users u
WHERE al.user_id = u.id
  AND al.hotel_id IS NULL
  AND u.hotel_id IS NOT NULL;
