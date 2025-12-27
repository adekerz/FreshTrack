-- FreshTrack PostgreSQL Migration 013
-- Fix: Add batches:create permission for STAFF role
-- STAFF needs to be able to add batches in their department

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Ensure batches:create department permission exists
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
(uuid_generate_v4(), 'batches', 'create', 'department', 'Create batches in own department')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Add batches:create to STAFF role
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'batches' AND p.action = 'create' AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Also ensure DEPARTMENT_MANAGER has batches:create
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'batches' AND p.action = 'create' AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Add batches:update for STAFF (to modify quantities)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
(uuid_generate_v4(), 'batches', 'update', 'department', 'Update batches in own department')
ON CONFLICT (resource, action, scope) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'batches' AND p.action = 'update' AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;
