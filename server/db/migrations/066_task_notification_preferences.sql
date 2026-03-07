-- Migration: 066_task_notification_preferences.sql
-- Description: Task notification preferences table
-- Date: 2026-02-24
-- Module: Task Planner notifications integration

-- ============================================
-- Настройки уведомлений по задачам для пользователей
-- ============================================
CREATE TABLE IF NOT EXISTS task_notification_preferences (
    user_id UUID PRIMARY KEY,
    
    -- In-app notifications
    inapp_task_assigned BOOLEAN DEFAULT TRUE,
    inapp_task_due_soon BOOLEAN DEFAULT TRUE,
    inapp_task_overdue BOOLEAN DEFAULT TRUE,
    inapp_task_completed BOOLEAN DEFAULT TRUE,
    inapp_task_comment BOOLEAN DEFAULT TRUE,
    inapp_task_updated BOOLEAN DEFAULT TRUE,
    inapp_task_mention BOOLEAN DEFAULT TRUE,
    
    -- Telegram notifications
    telegram_task_assigned BOOLEAN DEFAULT TRUE,
    telegram_task_due_soon BOOLEAN DEFAULT TRUE,
    telegram_task_overdue BOOLEAN DEFAULT TRUE,
    
    -- Digest settings
    digest_frequency VARCHAR(20) DEFAULT 'NONE',
    digest_time TIME DEFAULT '09:00:00',
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_task_notif_pref_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_digest_frequency CHECK (
        digest_frequency IN ('NONE', 'DAILY', 'WEEKLY')
    )
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_task_notif_pref_updated_at ON task_notification_preferences;
CREATE TRIGGER tr_task_notif_pref_updated_at
    BEFORE UPDATE ON task_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create default preferences for all existing users
INSERT INTO task_notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- STEP 1: Seed task permissions into the permissions table
-- ============================================

INSERT INTO permissions (id, resource, action, scope, description) VALUES
-- TASKS permissions (various scopes)
(uuid_generate_v4(), 'tasks', 'read', 'all', 'Read all tasks across system'),
(uuid_generate_v4(), 'tasks', 'read', 'hotel', 'Read tasks within own hotel'),
(uuid_generate_v4(), 'tasks', 'read', 'department', 'Read tasks within own department'),
(uuid_generate_v4(), 'tasks', 'create', 'all', 'Create tasks anywhere in system'),
(uuid_generate_v4(), 'tasks', 'create', 'hotel', 'Create tasks in own hotel'),
(uuid_generate_v4(), 'tasks', 'create', 'department', 'Create tasks in own department'),
(uuid_generate_v4(), 'tasks', 'update', 'all', 'Update any task in system'),
(uuid_generate_v4(), 'tasks', 'update', 'hotel', 'Update tasks in own hotel'),
(uuid_generate_v4(), 'tasks', 'update', 'department', 'Update tasks in own department'),
(uuid_generate_v4(), 'tasks', 'update', 'own', 'Update own assigned tasks'),
(uuid_generate_v4(), 'tasks', 'delete', 'all', 'Delete any task in system'),
(uuid_generate_v4(), 'tasks', 'delete', 'hotel', 'Delete tasks in own hotel'),
(uuid_generate_v4(), 'tasks', 'delete', 'department', 'Delete tasks in own department'),
(uuid_generate_v4(), 'tasks', 'manage', 'all', 'Full task management across system'),
(uuid_generate_v4(), 'tasks', 'manage', 'hotel', 'Full task management in own hotel'),

-- TASK_BOARDS permissions
(uuid_generate_v4(), 'task_boards', 'read', 'all', 'Read all task boards across system'),
(uuid_generate_v4(), 'task_boards', 'read', 'hotel', 'Read task boards in own hotel'),
(uuid_generate_v4(), 'task_boards', 'read', 'department', 'Read task boards in own department'),
(uuid_generate_v4(), 'task_boards', 'create', 'all', 'Create task boards anywhere'),
(uuid_generate_v4(), 'task_boards', 'create', 'hotel', 'Create task boards in own hotel'),
(uuid_generate_v4(), 'task_boards', 'create', 'department', 'Create task boards in own department'),
(uuid_generate_v4(), 'task_boards', 'update', 'all', 'Update any task board'),
(uuid_generate_v4(), 'task_boards', 'update', 'hotel', 'Update task boards in own hotel'),
(uuid_generate_v4(), 'task_boards', 'update', 'department', 'Update task boards in own department'),
(uuid_generate_v4(), 'task_boards', 'delete', 'all', 'Delete any task board'),
(uuid_generate_v4(), 'task_boards', 'delete', 'hotel', 'Delete task boards in own hotel')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ============================================
-- STEP 2: Assign task permissions to roles
-- ============================================

-- SUPER_ADMIN: all task/board permissions with 'all' scope
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards') AND p.scope = 'all'
ON CONFLICT (role, permission_id) DO NOTHING;

-- SUPER_ADMIN also gets hotel-level task permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards') AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN: hotel-scoped task/board permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards') AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN also gets department-level task permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards') AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- DEPARTMENT_MANAGER: department-scoped task/board permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards') AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF: read tasks/boards in department + update own tasks
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource IN ('tasks', 'task_boards')
  AND p.scope = 'department'
  AND p.action = 'read'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'tasks' AND p.action = 'update' AND p.scope = 'own'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE task_notification_preferences IS 'Настройки уведомлений о задачах для каждого пользователя';
