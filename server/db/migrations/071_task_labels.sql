-- Migration: 071_task_labels.sql
-- Description: Labels system for Task Planner (MS Planner color tags)
-- Date: 2026-03-03

-- 1. Labels per board (up to 25, like MS Planner)
CREATE TABLE IF NOT EXISTS task_plan_labels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL DEFAULT '',
    color       VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (board_id, position)
);

-- 2. Many-to-many: task <-> label
CREATE TABLE IF NOT EXISTS task_label_assignments (
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id    UUID NOT NULL REFERENCES task_plan_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_task_labels_board ON task_plan_labels(board_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_task ON task_label_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_label ON task_label_assignments(label_id);
