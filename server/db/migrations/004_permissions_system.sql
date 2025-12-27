-- FreshTrack PostgreSQL Migration 004
-- Permission-Based Access Control System
-- Replaces rigid role checks with granular permissions

-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Create permissions table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource VARCHAR(50) NOT NULL,  -- inventory, products, users, settings, batches, etc.
  action VARCHAR(50) NOT NULL,    -- read, create, update, delete, export, manage
  scope VARCHAR(20) NOT NULL,     -- own, department, hotel, all
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action, scope)
);

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Create role_permissions junction table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,      -- SUPER_ADMIN, HOTEL_ADMIN, DEPARTMENT_MANAGER, STAFF
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- ═══════════════════════════════════════════════════════════════
-- STEP 3: Seed default permissions
-- ═══════════════════════════════════════════════════════════════

-- Resources: inventory, products, batches, categories, users, departments, settings, reports, notifications, write_offs, audit

-- Insert base permissions (resource:action:scope combinations)
INSERT INTO permissions (id, resource, action, scope, description) VALUES
-- INVENTORY permissions
(uuid_generate_v4(), 'inventory', 'read', 'all', 'Read all inventory across system'),
(uuid_generate_v4(), 'inventory', 'read', 'hotel', 'Read inventory within own hotel'),
(uuid_generate_v4(), 'inventory', 'read', 'department', 'Read inventory within own department'),
(uuid_generate_v4(), 'inventory', 'create', 'hotel', 'Create inventory items in own hotel'),
(uuid_generate_v4(), 'inventory', 'create', 'department', 'Create inventory items in own department'),
(uuid_generate_v4(), 'inventory', 'update', 'hotel', 'Update inventory in own hotel'),
(uuid_generate_v4(), 'inventory', 'update', 'department', 'Update inventory in own department'),
(uuid_generate_v4(), 'inventory', 'delete', 'hotel', 'Delete inventory in own hotel'),
(uuid_generate_v4(), 'inventory', 'export', 'hotel', 'Export inventory data from own hotel'),
(uuid_generate_v4(), 'inventory', 'export', 'department', 'Export inventory data from own department'),

-- PRODUCTS permissions
(uuid_generate_v4(), 'products', 'read', 'all', 'Read all products across system'),
(uuid_generate_v4(), 'products', 'read', 'hotel', 'Read products within own hotel'),
(uuid_generate_v4(), 'products', 'read', 'department', 'Read products within own department'),
(uuid_generate_v4(), 'products', 'create', 'hotel', 'Create products in own hotel'),
(uuid_generate_v4(), 'products', 'update', 'hotel', 'Update products in own hotel'),
(uuid_generate_v4(), 'products', 'delete', 'hotel', 'Delete products in own hotel'),
(uuid_generate_v4(), 'products', 'manage', 'all', 'Full product management across system'),

-- BATCHES permissions
(uuid_generate_v4(), 'batches', 'read', 'all', 'Read all batches across system'),
(uuid_generate_v4(), 'batches', 'read', 'hotel', 'Read batches within own hotel'),
(uuid_generate_v4(), 'batches', 'read', 'department', 'Read batches within own department'),
(uuid_generate_v4(), 'batches', 'create', 'hotel', 'Create batches in own hotel'),
(uuid_generate_v4(), 'batches', 'create', 'department', 'Create batches in own department'),
(uuid_generate_v4(), 'batches', 'update', 'hotel', 'Update batches in own hotel'),
(uuid_generate_v4(), 'batches', 'update', 'department', 'Update batches in own department'),
(uuid_generate_v4(), 'batches', 'delete', 'hotel', 'Delete batches in own hotel'),
(uuid_generate_v4(), 'batches', 'collect', 'department', 'Collect/use batches in own department'),

-- USERS permissions
(uuid_generate_v4(), 'users', 'read', 'all', 'Read all users across system'),
(uuid_generate_v4(), 'users', 'read', 'hotel', 'Read users within own hotel'),
(uuid_generate_v4(), 'users', 'read', 'department', 'Read users within own department'),
(uuid_generate_v4(), 'users', 'create', 'all', 'Create users anywhere in system'),
(uuid_generate_v4(), 'users', 'create', 'hotel', 'Create users in own hotel'),
(uuid_generate_v4(), 'users', 'update', 'all', 'Update any user in system'),
(uuid_generate_v4(), 'users', 'update', 'hotel', 'Update users in own hotel'),
(uuid_generate_v4(), 'users', 'update', 'own', 'Update own user profile'),
(uuid_generate_v4(), 'users', 'delete', 'all', 'Delete any user in system'),
(uuid_generate_v4(), 'users', 'delete', 'hotel', 'Delete users in own hotel'),
(uuid_generate_v4(), 'users', 'manage', 'all', 'Full user management across system'),

-- DEPARTMENTS permissions
(uuid_generate_v4(), 'departments', 'read', 'all', 'Read all departments across system'),
(uuid_generate_v4(), 'departments', 'read', 'hotel', 'Read departments within own hotel'),
(uuid_generate_v4(), 'departments', 'create', 'hotel', 'Create departments in own hotel'),
(uuid_generate_v4(), 'departments', 'update', 'hotel', 'Update departments in own hotel'),
(uuid_generate_v4(), 'departments', 'delete', 'hotel', 'Delete departments in own hotel'),
(uuid_generate_v4(), 'departments', 'manage', 'all', 'Full department management across system'),

-- SETTINGS permissions
(uuid_generate_v4(), 'settings', 'read', 'all', 'Read all settings across system'),
(uuid_generate_v4(), 'settings', 'read', 'hotel', 'Read settings for own hotel'),
(uuid_generate_v4(), 'settings', 'read', 'department', 'Read settings for own department'),
(uuid_generate_v4(), 'settings', 'update', 'all', 'Update any settings in system'),
(uuid_generate_v4(), 'settings', 'update', 'hotel', 'Update settings for own hotel'),
(uuid_generate_v4(), 'settings', 'update', 'department', 'Update settings for own department'),
(uuid_generate_v4(), 'settings', 'manage', 'all', 'Full settings management across system'),

-- REPORTS permissions
(uuid_generate_v4(), 'reports', 'read', 'all', 'View all reports across system'),
(uuid_generate_v4(), 'reports', 'read', 'hotel', 'View reports for own hotel'),
(uuid_generate_v4(), 'reports', 'read', 'department', 'View reports for own department'),
(uuid_generate_v4(), 'reports', 'export', 'hotel', 'Export reports from own hotel'),
(uuid_generate_v4(), 'reports', 'export', 'department', 'Export reports from own department'),

-- NOTIFICATIONS permissions
(uuid_generate_v4(), 'notifications', 'read', 'hotel', 'Read notifications for own hotel'),
(uuid_generate_v4(), 'notifications', 'read', 'department', 'Read notifications for own department'),
(uuid_generate_v4(), 'notifications', 'create', 'hotel', 'Create notifications for own hotel'),
(uuid_generate_v4(), 'notifications', 'update', 'hotel', 'Update notifications in own hotel'),
(uuid_generate_v4(), 'notifications', 'delete', 'hotel', 'Delete notifications in own hotel'),

-- WRITE_OFFS permissions
(uuid_generate_v4(), 'write_offs', 'read', 'all', 'Read all write-offs across system'),
(uuid_generate_v4(), 'write_offs', 'read', 'hotel', 'Read write-offs within own hotel'),
(uuid_generate_v4(), 'write_offs', 'read', 'department', 'Read write-offs within own department'),
(uuid_generate_v4(), 'write_offs', 'create', 'hotel', 'Create write-offs in own hotel'),
(uuid_generate_v4(), 'write_offs', 'create', 'department', 'Create write-offs in own department'),

-- AUDIT permissions
(uuid_generate_v4(), 'audit', 'read', 'all', 'Read all audit logs across system'),
(uuid_generate_v4(), 'audit', 'read', 'hotel', 'Read audit logs for own hotel'),

-- HOTELS permissions (system-level)
(uuid_generate_v4(), 'hotels', 'read', 'all', 'Read all hotels'),
(uuid_generate_v4(), 'hotels', 'create', 'all', 'Create new hotels'),
(uuid_generate_v4(), 'hotels', 'update', 'all', 'Update any hotel'),
(uuid_generate_v4(), 'hotels', 'delete', 'all', 'Delete any hotel'),
(uuid_generate_v4(), 'hotels', 'manage', 'all', 'Full hotel management')

ON CONFLICT (resource, action, scope) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 4: Assign permissions to roles
-- ═══════════════════════════════════════════════════════════════

-- SUPER_ADMIN: ALL permissions with 'all' scope
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'all'
ON CONFLICT (role, permission_id) DO NOTHING;

-- SUPER_ADMIN also gets hotel-level permissions for flexibility
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN: hotel-scoped permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

-- HOTEL_ADMIN also gets department-level permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- DEPARTMENT_MANAGER: department-scoped permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.scope = 'department'
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF: limited department permissions (read + create batches/write_offs)
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.scope = 'department' 
  AND (
    (p.resource IN ('inventory', 'products', 'batches', 'notifications', 'reports') AND p.action = 'read')
    OR (p.resource = 'batches' AND p.action IN ('create', 'collect'))
    OR (p.resource = 'write_offs' AND p.action IN ('read', 'create'))
    OR (p.resource = 'settings' AND p.action = 'read')
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- STAFF: own profile update
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'STAFF', p.id
FROM permissions p
WHERE p.resource = 'users' AND p.action = 'update' AND p.scope = 'own'
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- STEP 5: Create helper view for permission checks
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_role_permissions AS
SELECT 
  rp.role,
  p.resource,
  p.action,
  p.scope,
  p.description
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
ORDER BY rp.role, p.resource, p.action;

-- ═══════════════════════════════════════════════════════════════
-- STEP 6: Create function for permission check
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_permission(
  p_role VARCHAR,
  p_resource VARCHAR,
  p_action VARCHAR
) RETURNS TABLE(has_permission BOOLEAN, scope VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_permission,
    p.scope
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE rp.role = p_role 
    AND p.resource = p_resource 
    AND p.action = p_action
  LIMIT 1;
  
  -- Return false if no permission found
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;
