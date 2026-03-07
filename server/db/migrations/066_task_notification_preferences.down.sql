-- Rollback: 066_task_notification_preferences.sql
-- Drops task notification preferences and removes task RBAC permissions

-- Drop trigger
DROP TRIGGER IF EXISTS tr_task_notif_pref_updated_at ON task_notification_preferences;

-- Drop table
DROP TABLE IF EXISTS task_notification_preferences CASCADE;

-- Remove task-related role_permissions (via JOIN to permissions table)
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE resource IN ('tasks', 'task_boards')
);

-- Remove task-related permissions
DELETE FROM permissions WHERE resource IN ('tasks', 'task_boards');
