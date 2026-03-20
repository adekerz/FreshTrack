-- Migration 075: Change collection_history.department_id FK to SET NULL on department delete
-- Prevents cascade deletion of history when department is deleted

ALTER TABLE collection_history
  DROP CONSTRAINT IF EXISTS collection_history_department_id_fkey;

ALTER TABLE collection_history
  ALTER COLUMN department_id DROP NOT NULL;

ALTER TABLE collection_history
  ADD CONSTRAINT collection_history_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
