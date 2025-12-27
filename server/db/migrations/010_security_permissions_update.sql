-- FreshTrack PostgreSQL Migration 010
-- Security Update: Add missing permission resources
-- Phase A Security remediation - adds COLLECTIONS, DELIVERY_TEMPLATES, EXPORT resources

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Add COLLECTIONS permissions
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
-- COLLECTIONS permissions
(uuid_generate_v4(), 'collections', 'read', 'all', 'Read all collections across system'),
(uuid_generate_v4(), 'collections', 'read', 'hotel', 'Read collections within own hotel'),
(uuid_generate_v4(), 'collections', 'read', 'department', 'Read collections within own department'),
(uuid_generate_v4(), 'collections', 'create', 'hotel', 'Create collections in own hotel'),
(uuid_generate_v4(), 'collections', 'create', 'department', 'Create collections in own department'),
(uuid_generate_v4(), 'collections', 'update', 'hotel', 'Update collections in own hotel'),
(uuid_generate_v4(), 'collections', 'update', 'department', 'Update collections in own department'),
(uuid_generate_v4(), 'collections', 'delete', 'hotel', 'Delete collections in own hotel'),
(uuid_generate_v4(), 'collections', 'delete', 'department', 'Delete collections in own department'),
(uuid_generate_v4(), 'collections', 'manage', 'all', 'Full collections management across system')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Add DELIVERY_TEMPLATES permissions
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
-- DELIVERY_TEMPLATES permissions
(uuid_generate_v4(), 'delivery_templates', 'read', 'all', 'Read all delivery templates across system'),
(uuid_generate_v4(), 'delivery_templates', 'read', 'hotel', 'Read delivery templates within own hotel'),
(uuid_generate_v4(), 'delivery_templates', 'read', 'department', 'Read delivery templates within own department'),
(uuid_generate_v4(), 'delivery_templates', 'create', 'hotel', 'Create delivery templates in own hotel'),
(uuid_generate_v4(), 'delivery_templates', 'create', 'department', 'Create delivery templates in own department'),
(uuid_generate_v4(), 'delivery_templates', 'update', 'hotel', 'Update delivery templates in own hotel'),
(uuid_generate_v4(), 'delivery_templates', 'update', 'department', 'Update delivery templates in own department'),
(uuid_generate_v4(), 'delivery_templates', 'delete', 'hotel', 'Delete delivery templates in own hotel'),
(uuid_generate_v4(), 'delivery_templates', 'delete', 'department', 'Delete delivery templates in own department'),
(uuid_generate_v4(), 'delivery_templates', 'manage', 'all', 'Full delivery templates management across system')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Add EXPORT permissions
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
-- EXPORT permissions (standalone resource for data export functionality)
(uuid_generate_v4(), 'export', 'read', 'all', 'Export all data across system'),
(uuid_generate_v4(), 'export', 'read', 'hotel', 'Export data from own hotel'),
(uuid_generate_v4(), 'export', 'read', 'department', 'Export data from own department')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Add CATEGORIES permissions (if missing)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
(uuid_generate_v4(), 'categories', 'read', 'all', 'Read all categories across system'),
(uuid_generate_v4(), 'categories', 'read', 'hotel', 'Read categories within own hotel'),
(uuid_generate_v4(), 'categories', 'read', 'department', 'Read categories within own department'),
(uuid_generate_v4(), 'categories', 'create', 'hotel', 'Create categories in own hotel'),
(uuid_generate_v4(), 'categories', 'create', 'department', 'Create categories in own department'),
(uuid_generate_v4(), 'categories', 'update', 'hotel', 'Update categories in own hotel'),
(uuid_generate_v4(), 'categories', 'update', 'department', 'Update categories in own department'),
(uuid_generate_v4(), 'categories', 'delete', 'hotel', 'Delete categories in own hotel'),
(uuid_generate_v4(), 'categories', 'delete', 'department', 'Delete categories in own department'),
(uuid_generate_v4(), 'categories', 'manage', 'all', 'Full categories management across system')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Add WRITE_OFFS update/delete permissions (if missing)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (id, resource, action, scope, description) VALUES
(uuid_generate_v4(), 'write_offs', 'update', 'hotel', 'Update write-offs in own hotel'),
(uuid_generate_v4(), 'write_offs', 'update', 'department', 'Update write-offs in own department'),
(uuid_generate_v4(), 'write_offs', 'delete', 'hotel', 'Delete write-offs in own hotel'),
(uuid_generate_v4(), 'write_offs', 'delete', 'department', 'Delete write-offs in own department'),
(uuid_generate_v4(), 'write_offs', 'manage', 'all', 'Full write-offs management across system')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Assign new permissions to SUPER_ADMIN
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role = 'SUPER_ADMIN' AND rp.permission_id = p.id
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 7: Assign hotel-scope permissions to HOTEL_ADMIN
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'hotel'
  AND p.resource IN ('collections', 'delivery_templates', 'export', 'categories', 'write_offs')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role = 'HOTEL_ADMIN' AND rp.permission_id = p.id
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 8: Assign department-scope READ permissions to DEPARTMENT_MANAGER
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.scope = 'department'
  AND p.resource IN ('collections', 'delivery_templates', 'categories')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 9: Assign department-scope READ permissions to STAFF
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.scope = 'department'
  AND p.action = 'read'
  AND p.resource IN ('collections', 'delivery_templates', 'categories')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role = 'STAFF' AND rp.permission_id = p.id
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DONE: Security permissions update complete
-- ═══════════════════════════════════════════════════════════════
