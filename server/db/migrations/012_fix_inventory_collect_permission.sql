-- FreshTrack PostgreSQL Migration 012
-- Fix: Add missing 'inventory:collect' permission
-- The code uses PermissionResource.INVENTORY + PermissionAction.COLLECT
-- but migration 004 only defines 'batches:collect'

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Add inventory:collect permissions
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
(uuid_generate_v4(), 'inventory', 'collect', 'all', 'Collect inventory items across system'),
(uuid_generate_v4(), 'inventory', 'collect', 'hotel', 'Collect inventory items within own hotel'),
(uuid_generate_v4(), 'inventory', 'collect', 'department', 'Collect inventory items within own department')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Assign inventory:collect to roles
-- ═══════════════════════════════════════════════════════════════

-- SUPER_ADMIN: all scopes
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'inventory' AND p.action = 'collect'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN: hotel and department scope
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'inventory' AND p.action = 'collect' 
  AND p.scope IN ('hotel', 'department')
ON CONFLICT (role, permission_id) DO NOTHING;

-- DEPARTMENT_MANAGER: department scope
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'inventory' AND p.action = 'collect' 
  AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF: department scope (they need to collect items)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'inventory' AND p.action = 'collect' 
  AND p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;
