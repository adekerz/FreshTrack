-- Rollback 069: Restore task_planner as core module
UPDATE modules SET is_core = true WHERE code = 'task_planner';
