-- Rollback: 065_create_task_tables.sql
-- Drops all Task Planner tables, triggers, functions, and types

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_auto_subscribe_assignee ON task_assignments;
DROP TRIGGER IF EXISTS tr_auto_subscribe_creator ON tasks;
DROP TRIGGER IF EXISTS tr_attachment_counters ON task_attachments;
DROP TRIGGER IF EXISTS tr_comment_counters ON task_comments;
DROP TRIGGER IF EXISTS tr_checklist_counters ON task_checklist_items;
DROP TRIGGER IF EXISTS tr_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS tr_task_boards_updated_at ON task_boards;
DROP TRIGGER IF EXISTS tr_create_default_buckets ON task_boards;

-- Drop functions
DROP FUNCTION IF EXISTS auto_subscribe_assignees();
DROP FUNCTION IF EXISTS auto_subscribe_task_participants();
DROP FUNCTION IF EXISTS update_task_counters();
DROP FUNCTION IF EXISTS create_default_buckets();

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS task_watchers CASCADE;
DROP TABLE IF EXISTS task_activities CASCADE;
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_checklist_items CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_buckets CASCADE;
DROP TABLE IF EXISTS task_boards CASCADE;

-- Drop types
DROP TYPE IF EXISTS task_activity_type;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS task_priority;
