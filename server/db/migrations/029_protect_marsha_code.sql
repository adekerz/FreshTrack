-- ============================================================================
-- Migration 029: Защита marsha_code от прямого редактирования
-- ============================================================================
-- Проблема: hotels.marsha_code может быть изменён напрямую через UPDATE
-- Решение: Триггер, который разрешает изменение ТОЛЬКО через marsha_code_id
-- ============================================================================

-- Функция-триггер для защиты marsha_code
CREATE OR REPLACE FUNCTION protect_marsha_code_update()
RETURNS TRIGGER AS $$
DECLARE
  expected_code VARCHAR(5);
BEGIN
  -- Если marsha_code_id не изменился, но marsha_code изменился — это прямое редактирование
  IF OLD.marsha_code_id IS NOT DISTINCT FROM NEW.marsha_code_id 
     AND OLD.marsha_code IS DISTINCT FROM NEW.marsha_code THEN
    RAISE EXCEPTION 'Direct UPDATE of hotels.marsha_code is forbidden. Use marsha_code_id to change the MARSHA code.';
  END IF;

  -- Если marsha_code_id изменился — автоматически синхронизируем marsha_code
  IF NEW.marsha_code_id IS DISTINCT FROM OLD.marsha_code_id THEN
    IF NEW.marsha_code_id IS NULL THEN
      -- Если marsha_code_id обнулён — обнуляем и marsha_code
      NEW.marsha_code := NULL;
    ELSE
      -- Получаем код из справочника
      SELECT code INTO expected_code 
      FROM marsha_codes 
      WHERE id = NEW.marsha_code_id;
      
      IF expected_code IS NULL THEN
        RAISE EXCEPTION 'Invalid marsha_code_id: code not found in marsha_codes table';
      END IF;
      
      -- Автоматически устанавливаем правильный код
      NEW.marsha_code := expected_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер если есть
DROP TRIGGER IF EXISTS trigger_protect_marsha_code ON hotels;

-- Создаём триггер
CREATE TRIGGER trigger_protect_marsha_code
  BEFORE UPDATE ON hotels
  FOR EACH ROW
  EXECUTE FUNCTION protect_marsha_code_update();

-- Комментарий
COMMENT ON FUNCTION protect_marsha_code_update() IS 
'Защищает hotels.marsha_code от прямого редактирования. 
Изменение возможно ТОЛЬКО через обновление marsha_code_id.
При изменении marsha_code_id автоматически синхронизирует marsha_code из справочника.';

-- ============================================================================
-- Добавляем permissions для marsha_codes
-- ============================================================================

-- Добавляем новые permissions (если не существуют)
-- scope = 'all' — marsha_codes управляются на уровне всей системы
INSERT INTO permissions (resource, action, scope, description)
SELECT 'marsha_codes', 'view', 'all', 'Просмотр справочника MARSHA кодов'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'marsha_codes' AND action = 'view');

INSERT INTO permissions (resource, action, scope, description)
SELECT 'marsha_codes', 'create', 'all', 'Создание новых MARSHA кодов в справочнике'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'marsha_codes' AND action = 'create');

INSERT INTO permissions (resource, action, scope, description)
SELECT 'marsha_codes', 'assign', 'all', 'Назначение MARSHA кода отелю'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'marsha_codes' AND action = 'assign');

INSERT INTO permissions (resource, action, scope, description)
SELECT 'marsha_codes', 'unassign', 'all', 'Отвязка MARSHA кода от отеля'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'marsha_codes' AND action = 'unassign');

-- Даём ВСЕ права SUPER_ADMIN на marsha_codes
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'SUPER_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'marsha_codes'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'SUPER_ADMIN' AND rp.permission_id = p.id
);

-- HOTEL_ADMIN может только просматривать
INSERT INTO role_permissions (id, role, permission_id)
SELECT uuid_generate_v4(), 'HOTEL_ADMIN', p.id
FROM permissions p
WHERE p.resource = 'marsha_codes' AND p.action = 'view'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role = 'HOTEL_ADMIN' AND rp.permission_id = p.id
);

-- Логируем
DO $$
BEGIN
  RAISE NOTICE 'Migration 029: marsha_code protection trigger created, permissions added';
END $$;
