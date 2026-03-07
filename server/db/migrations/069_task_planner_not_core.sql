-- Migration 069: Make task_planner non-core so Hotel Admins can toggle it per department
UPDATE modules SET is_core = false WHERE code = 'task_planner';
