-- FreshTrack PostgreSQL Migration 021
-- Add basic read permissions for STAFF role
-- STAFF needs to see their hotel and departments to function

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Add hotels:read:hotel permission if missing
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description)
VALUES (uuid_generate_v4(), 'hotels', 'read', 'hotel', 'Read own hotel info')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Assign basic read permissions to STAFF
-- ═══════════════════════════════════════════════════════════════

-- STAFF can read their own hotel
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'hotels' AND p.action = 'read' AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF can read departments in their hotel (needed for navigation)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'departments' AND p.action = 'read' AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Also ensure STAFF has department-level department read if hotel-level doesn't exist
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'departments' AND p.action = 'read' AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF can read categories (needed for inventory display)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'categories' AND p.action = 'read' AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'categories' AND p.action = 'read' AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Add categories permissions if not exist
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description)
VALUES 
  (uuid_generate_v4(), 'categories', 'read', 'all', 'Read all categories'),
  (uuid_generate_v4(), 'categories', 'read', 'hotel', 'Read categories in hotel'),
  (uuid_generate_v4(), 'categories', 'read', 'department', 'Read categories in department'),
  (uuid_generate_v4(), 'categories', 'create', 'hotel', 'Create categories in hotel'),
  (uuid_generate_v4(), 'categories', 'update', 'hotel', 'Update categories in hotel'),
  (uuid_generate_v4(), 'categories', 'delete', 'hotel', 'Delete categories in hotel'),
  (uuid_generate_v4(), 'categories', 'manage', 'all', 'Full category management')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Assign category permissions to HOTEL_ADMIN
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'categories' AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Assign categories:read to STAFF
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'categories' AND p.action = 'read' AND p.scope IN ('hotel', 'department')
ON CONFLICT (role, permission_id) DO NOTHING;
