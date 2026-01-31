-- Migration 049: Audit logs permissions (read, export, write for enrichment job)
-- resource = 'audit' (matches PermissionResource.AUDIT in auth.js)

-- Permissions для audit
INSERT INTO permissions (id, resource, action, scope, description)
VALUES
  (uuid_generate_v4(), 'audit', 'export', 'all', 'Export audit logs (system-wide)'),
  (uuid_generate_v4(), 'audit', 'export', 'hotel', 'Export audit logs for own hotel'),
  (uuid_generate_v4(), 'audit', 'write', 'all', 'Write audit metadata (enrichment job)')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- SUPER_ADMIN: audit export + write all (read all уже из 004)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'audit' AND p.action IN ('export', 'write') AND p.scope = 'all'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN: audit export hotel (read hotel уже из 004)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'audit' AND p.action = 'export' AND p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;
