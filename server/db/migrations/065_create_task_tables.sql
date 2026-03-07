-- Migration: 065_create_task_tables.sql
-- Description: Core tables for Task Planner module
-- Date: 2026-02-24
-- Module: Task Planner (базовый модуль для всех отделов)

-- ============================================
-- 1. TASK BOARDS (группировка задач)
-- ============================================
CREATE TABLE IF NOT EXISTS task_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hotel_id UUID NOT NULL,
    department_id UUID, -- NULL = hotel-wide board
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{
        "defaultView": "board",
        "allowComments": true,
        "allowAttachments": true,
        "requireApproval": false
    }'::jsonb,
    
    CONSTRAINT fk_task_board_hotel FOREIGN KEY (hotel_id) 
        REFERENCES hotels(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_board_department FOREIGN KEY (department_id) 
        REFERENCES departments(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_board_creator FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_task_boards_hotel ON task_boards(hotel_id) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_task_boards_department ON task_boards(department_id) WHERE NOT is_archived;

-- ============================================
-- 2. TASK BUCKETS (колонки Kanban)
-- ============================================
CREATE TABLE IF NOT EXISTS task_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280', -- hex color
    position INTEGER NOT NULL, -- порядок колонок
    is_default BOOLEAN DEFAULT FALSE, -- дефолтная колонка для новых задач
    is_completed_bucket BOOLEAN DEFAULT FALSE, -- колонка "Завершено"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_bucket_board FOREIGN KEY (board_id) 
        REFERENCES task_boards(id) ON DELETE CASCADE,
    CONSTRAINT chk_bucket_position_positive CHECK (position >= 0)
);

CREATE INDEX IF NOT EXISTS idx_buckets_board ON task_buckets(board_id, position);

-- ============================================
-- 3. ENUM TYPES (если ещё не существуют)
-- ============================================
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. TASKS (основная таблица задач)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL,
    bucket_id UUID NOT NULL,
    
    -- Основная информация
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Классификация
    priority task_priority DEFAULT 'MEDIUM',
    status task_status DEFAULT 'TODO',
    
    -- Временные рамки
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Прогресс
    percent_complete INTEGER DEFAULT 0,
    
    -- Позиционирование (для drag & drop)
    order_hint VARCHAR(255) NOT NULL, -- lexicographic ordering
    
    -- Связь с inventory (опционально)
    related_product_id UUID,
    related_batch_id UUID,
    
    -- Повторяющиеся задачи
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    parent_task_id UUID,
    
    -- Метаданные
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Счетчики (denormalized для производительности)
    checklist_item_count INTEGER DEFAULT 0,
    completed_checklist_item_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    attachment_count INTEGER DEFAULT 0,
    
    CONSTRAINT fk_task_board FOREIGN KEY (board_id) 
        REFERENCES task_boards(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_bucket FOREIGN KEY (bucket_id) 
        REFERENCES task_buckets(id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_product FOREIGN KEY (related_product_id) 
        REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_task_batch FOREIGN KEY (related_batch_id) 
        REFERENCES batches(id) ON DELETE SET NULL,
    CONSTRAINT fk_task_parent FOREIGN KEY (parent_task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_creator FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_updater FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_percent_range CHECK (percent_complete BETWEEN 0 AND 100),
    CONSTRAINT chk_dates_order CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_board_bucket ON tasks(board_id, bucket_id, order_hint);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL AND completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status) WHERE status != 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_tasks_product ON tasks(related_product_id) WHERE related_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_batch ON tasks(related_batch_id) WHERE related_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(is_recurring, parent_task_id) WHERE is_recurring = TRUE;

-- ============================================
-- 5. TASK ASSIGNMENTS (назначение задач)
-- ============================================
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_order_hint VARCHAR(255),
    
    CONSTRAINT fk_assignment_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_assigner FOREIGN KEY (assigned_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT uq_task_user UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON task_assignments(user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);

-- ============================================
-- 6. TASK CHECKLISTS (чек-листы)
-- ============================================
CREATE TABLE IF NOT EXISTS task_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    order_hint VARCHAR(255) NOT NULL,
    checked_by UUID,
    checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_checklist_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_checklist_checker FOREIGN KEY (checked_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklist_items(task_id, order_hint);

-- ============================================
-- 7. TASK COMMENTS (комментарии)
-- ============================================
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_edited BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID,
    
    CONSTRAINT fk_comment_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) 
        REFERENCES task_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON task_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;

-- ============================================
-- 8. TASK ATTACHMENTS (файловые вложения)
-- ============================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255),
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_attachment_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_attachment_uploader FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_file_size_positive CHECK (file_size > 0)
);

CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id, uploaded_at DESC);

-- ============================================
-- 9. TASK ACTIVITIES (audit log)
-- ============================================
DO $$ BEGIN
    CREATE TYPE task_activity_type AS ENUM (
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_COMPLETED',
        'TASK_REOPENED',
        'TASK_MOVED',
        'TASK_ASSIGNED',
        'TASK_UNASSIGNED',
        'COMMENT_ADDED',
        'COMMENT_EDITED',
        'COMMENT_DELETED',
        'ATTACHMENT_ADDED',
        'ATTACHMENT_REMOVED',
        'CHECKLIST_ITEM_ADDED',
        'CHECKLIST_ITEM_CHECKED',
        'CHECKLIST_ITEM_UNCHECKED',
        'DUE_DATE_CHANGED',
        'PRIORITY_CHANGED',
        'STATUS_CHANGED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    board_id UUID NOT NULL,
    user_id UUID NOT NULL,
    activity_type task_activity_type NOT NULL,
    activity_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_activity_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_board FOREIGN KEY (board_id) 
        REFERENCES task_boards(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_board ON task_activities(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user ON task_activities(user_id, created_at DESC);

-- ============================================
-- 10. TASK WATCHERS (подписчики на задачу)
-- ============================================
CREATE TABLE IF NOT EXISTS task_watchers (
    task_id UUID NOT NULL,
    user_id UUID NOT NULL,
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (task_id, user_id),
    CONSTRAINT fk_watcher_task FOREIGN KEY (task_id) 
        REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_watcher_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watchers_user ON task_watchers(user_id);

-- ============================================
-- 11. TRIGGERS для автоматических обновлений
-- ============================================

-- update_updated_at_column() уже существует в проекте,
-- но создаём OR REPLACE на случай если нет
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры updated_at (DROP IF EXISTS для идемпотентности)
DROP TRIGGER IF EXISTS tr_task_boards_updated_at ON task_boards;
CREATE TRIGGER tr_task_boards_updated_at
    BEFORE UPDATE ON task_boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_tasks_updated_at ON tasks;
CREATE TRIGGER tr_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер: обновление счетчиков в tasks
CREATE OR REPLACE FUNCTION update_task_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'task_checklist_items' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tasks 
            SET checklist_item_count = checklist_item_count + 1
            WHERE id = NEW.task_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tasks 
            SET checklist_item_count = checklist_item_count - 1,
                completed_checklist_item_count = CASE 
                    WHEN OLD.is_checked THEN completed_checklist_item_count - 1 
                    ELSE completed_checklist_item_count 
                END
            WHERE id = OLD.task_id;
        ELSIF TG_OP = 'UPDATE' AND OLD.is_checked != NEW.is_checked THEN
            UPDATE tasks 
            SET completed_checklist_item_count = completed_checklist_item_count + 
                CASE WHEN NEW.is_checked THEN 1 ELSE -1 END
            WHERE id = NEW.task_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'task_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tasks SET comment_count = comment_count + 1 WHERE id = NEW.task_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tasks SET comment_count = comment_count - 1 WHERE id = OLD.task_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'task_attachments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE tasks SET attachment_count = attachment_count + 1 WHERE id = NEW.task_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE tasks SET attachment_count = attachment_count - 1 WHERE id = OLD.task_id;
        END IF;
    END IF;
    
    -- For DELETE triggers, must return OLD
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_checklist_counters ON task_checklist_items;
CREATE TRIGGER tr_checklist_counters
    AFTER INSERT OR UPDATE OR DELETE ON task_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_task_counters();

DROP TRIGGER IF EXISTS tr_comment_counters ON task_comments;
CREATE TRIGGER tr_comment_counters
    AFTER INSERT OR DELETE ON task_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_task_counters();

DROP TRIGGER IF EXISTS tr_attachment_counters ON task_attachments;
CREATE TRIGGER tr_attachment_counters
    AFTER INSERT OR DELETE ON task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_task_counters();

-- Триггер: автоматическая подписка создателя
CREATE OR REPLACE FUNCTION auto_subscribe_task_participants()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_watchers (task_id, user_id)
        VALUES (NEW.id, NEW.created_by)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_subscribe_creator ON tasks;
CREATE TRIGGER tr_auto_subscribe_creator
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION auto_subscribe_task_participants();

-- Триггер: автоматическая подписка назначенных
CREATE OR REPLACE FUNCTION auto_subscribe_assignees()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_watchers (task_id, user_id)
        VALUES (NEW.task_id, NEW.user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_auto_subscribe_assignee ON task_assignments;
CREATE TRIGGER tr_auto_subscribe_assignee
    AFTER INSERT ON task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION auto_subscribe_assignees();

-- ============================================
-- 12. Функция для дефолтных buckets
-- ============================================
CREATE OR REPLACE FUNCTION create_default_buckets()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO task_buckets (board_id, name, color, position, is_default, is_completed_bucket)
    VALUES 
        (NEW.id, 'To Do', '#EF4444', 0, TRUE, FALSE),
        (NEW.id, 'In Progress', '#F59E0B', 1, FALSE, FALSE),
        (NEW.id, 'Review', '#3B82F6', 2, FALSE, FALSE),
        (NEW.id, 'Completed', '#10B981', 3, FALSE, TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_create_default_buckets ON task_boards;
CREATE TRIGGER tr_create_default_buckets
    AFTER INSERT ON task_boards
    FOR EACH ROW
    EXECUTE FUNCTION create_default_buckets();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE task_boards IS 'Доски задач (board-level grouping по отелю или департаменту)';
COMMENT ON TABLE task_buckets IS 'Колонки Kanban board (To Do, In Progress, Done и т.д.)';
COMMENT ON TABLE tasks IS 'Основная таблица задач с поддержкой recurring tasks и связей с inventory';
COMMENT ON TABLE task_assignments IS 'Назначение задач пользователям (многие ко многим)';
COMMENT ON TABLE task_checklist_items IS 'Чек-листы внутри задач';
COMMENT ON TABLE task_comments IS 'Комментарии и обсуждения к задачам';
COMMENT ON TABLE task_attachments IS 'Файловые вложения к задачам';
COMMENT ON TABLE task_activities IS 'Журнал всех действий с задачами (audit log)';
COMMENT ON TABLE task_watchers IS 'Подписчики задачи (получают уведомления)';

COMMENT ON COLUMN tasks.order_hint IS 'Лексикографическая строка для ordering при drag-and-drop (как в MS Planner)';
COMMENT ON COLUMN tasks.recurrence_pattern IS 'JSON с паттерном повторения: {frequency, interval, daysOfWeek, endDate}';
COMMENT ON COLUMN tasks.parent_task_id IS 'Ссылка на родительскую задачу для recurring instances';
