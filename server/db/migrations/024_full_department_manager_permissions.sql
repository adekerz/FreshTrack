-- Migration: Full DEPARTMENT_MANAGER permissions
-- Добавляем все необходимые права для менеджера департамента

-- ============================================
-- 1. Создаём недостающие department-scope permissions
-- ============================================

-- products:create:department
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'products', 'create', 'department', 'Create products within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'products' AND action = 'create' AND scope = 'department'
);

-- products:update:department
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'products', 'update', 'department', 'Update products within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'products' AND action = 'update' AND scope = 'department'
);

-- products:delete:department
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'products', 'delete', 'department', 'Delete products within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'products' AND action = 'delete' AND scope = 'department'
);

-- batches:delete:department (если ещё нет)
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'batches', 'delete', 'department', 'Delete batches within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'batches' AND action = 'delete' AND scope = 'department'
);

-- notifications:update:department (для управления правилами уведомлений)
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'notifications', 'update', 'department', 'Update notification settings within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'notifications' AND action = 'update' AND scope = 'department'
);

-- audit:read:department (для просмотра аудита в своём департаменте)
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'audit', 'read', 'department', 'Read audit logs within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'audit' AND action = 'read' AND scope = 'department'
);

-- ============================================
-- 2. Назначаем новые права для DEPARTMENT_MANAGER
-- ============================================

-- products:create:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'create' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- products:update:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'update' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- products:delete:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'delete' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- batches:delete:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'batches' AND p.action = 'delete' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- notifications:update:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'notifications' AND p.action = 'update' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- audit:read:department
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'audit' AND p.action = 'read' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- ============================================
-- 3. Проверяем существующие права и добавляем если нужно
-- ============================================

-- users:update:department (для управления пользователями в департаменте)
INSERT INTO permissions (id, resource, action, scope, description)
SELECT uuid_generate_v4(), 'users', 'update', 'department', 'Update users within own department'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE resource = 'users' AND action = 'update' AND scope = 'department'
);

INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'DEPARTMENT_MANAGER', p.id
FROM permissions p
WHERE p.resource = 'users' AND p.action = 'update' AND p.scope = 'department'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'DEPARTMENT_MANAGER' AND rp.permission_id = p.id
);

-- ============================================
-- Результат: DEPARTMENT_MANAGER теперь имеет полный набор прав
-- ============================================

-- Вывод для проверки
SELECT 'DEPARTMENT_MANAGER permissions after migration:' as info;
SELECT p.resource, p.action, p.scope 
FROM role_permissions rp 
JOIN permissions p ON rp.permission_id = p.id 
WHERE rp.role = 'DEPARTMENT_MANAGER' 
ORDER BY p.resource, p.action;
