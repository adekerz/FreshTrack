-- Migration: Add basic read permissions for DEPARTMENT_MANAGER
-- Similar to migration 021 for STAFF, DEPARTMENT_MANAGER needs hotels:read and departments:read

-- STEP 1: Add hotels:read:hotel permission for DEPARTMENT_MANAGER
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'hotels' AND p.action = 'read' AND p.scope = 'hotel'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- STEP 2: Add departments:read:hotel permission for DEPARTMENT_MANAGER
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'departments' AND p.action = 'read' AND p.scope = 'hotel'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- Verify
SELECT rp.role, p.resource, p.action, p.scope
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role = 'DEPARTMENT_MANAGER' AND p.resource IN ('hotels', 'departments');
