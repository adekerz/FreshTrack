-- FreshTrack PostgreSQL Migration 022
-- Remove admin-only permissions from STAFF role
-- STAFF should not have access to: reports, statistics, audit, collections history

-- Remove reports:read from STAFF
DELETE FROM role_permissions 
WHERE role = 'STAFF' 
AND permission_id IN (
  SELECT id FROM permissions 
  WHERE resource = 'reports' AND action = 'read'
);

-- Remove audit:read from STAFF (if exists)
DELETE FROM role_permissions 
WHERE role = 'STAFF' 
AND permission_id IN (
  SELECT id FROM permissions 
  WHERE resource = 'audit' AND action = 'read'
);

-- Remove collections:read from STAFF
DELETE FROM role_permissions 
WHERE role = 'STAFF' 
AND permission_id IN (
  SELECT id FROM permissions 
  WHERE resource = 'collections' AND action = 'read'
);

-- Keep: inventory, products, batches, categories, notifications, settings:read, write_offs
-- STAFF can still work with inventory but cannot see global reports
