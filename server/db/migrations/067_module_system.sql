-- ═══════════════════════════════════════════════════════════════
-- Migration 067: Module System
-- Модульная архитектура FreshTrack
-- Каждый отдел получает доступ только к необходимым модулям
-- ═══════════════════════════════════════════════════════════════

-- 1. Таблица модулей системы
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_core BOOLEAN DEFAULT false,
  tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Связующая таблица: department_modules
CREATE TABLE IF NOT EXISTS department_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  module_code VARCHAR(50) NOT NULL REFERENCES modules(code) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enabled_by UUID REFERENCES users(id),
  settings JSONB DEFAULT '{}',

  UNIQUE(department_id, module_code)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_dept_modules_dept ON department_modules(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_modules_module ON department_modules(module_code);
CREATE INDEX IF NOT EXISTS idx_dept_modules_enabled ON department_modules(is_enabled);

-- 3. Обновление таблицы departments
-- Добавить тип отдела (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'department_type'
  ) THEN
    ALTER TABLE departments ADD COLUMN department_type VARCHAR(50) DEFAULT 'other';
  END IF;
END $$;

-- Добавить флаг "работает с продуктами"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'handles_food_products'
  ) THEN
    ALTER TABLE departments ADD COLUMN handles_food_products BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Обновление таблицы users — кэш доступных модулей
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'cached_modules'
  ) THEN
    ALTER TABLE users ADD COLUMN cached_modules JSONB DEFAULT '[]';
  END IF;
END $$;

-- 5. Заполнение базовых модулей
INSERT INTO modules (code, name, description, icon, is_core, tier) VALUES
  ('task_planner', 'Task Planner', 'Управление задачами и планирование', 'layout-grid', true, 'free'),
  ('inventory', 'Inventory Management', 'Отслеживание сроков годности', 'package', false, 'basic'),
  ('logbook_scanner', 'IRD Logbook Scanner', 'Сканирование чеков гостей', 'scan', false, 'pro'),
  ('analytics', 'Advanced Analytics', 'Детальная аналитика и отчеты', 'bar-chart-3', false, 'enterprise')
ON CONFLICT (code) DO NOTHING;

-- 6. Триггер: автоматическое назначение модулей при создании отдела
CREATE OR REPLACE FUNCTION assign_default_modules()
RETURNS TRIGGER AS $$
BEGIN
  -- Task Planner доступен всем (core module)
  INSERT INTO department_modules (department_id, module_code)
  VALUES (NEW.id, 'task_planner')
  ON CONFLICT (department_id, module_code) DO NOTHING;

  -- Inventory только для отделов работающих с продуктами
  IF NEW.handles_food_products = true THEN
    INSERT INTO department_modules (department_id, module_code)
    VALUES (NEW.id, 'inventory')
    ON CONFLICT (department_id, module_code) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Убедимся что старый триггер удалён перед созданием
DROP TRIGGER IF EXISTS trigger_assign_default_modules ON departments;

CREATE TRIGGER trigger_assign_default_modules
  AFTER INSERT ON departments
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_modules();

-- 7. Функция обновления кэша модулей пользователя
CREATE OR REPLACE FUNCTION update_user_modules_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET cached_modules = (
    SELECT COALESCE(JSONB_AGG(dm.module_code), '[]'::jsonb)
    FROM department_modules dm
    WHERE dm.department_id = COALESCE(NEW.department_id, OLD.department_id)
      AND dm.is_enabled = true
  )
  WHERE department_id = COALESCE(NEW.department_id, OLD.department_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_modules ON department_modules;

CREATE TRIGGER trigger_update_user_modules
  AFTER INSERT OR UPDATE OR DELETE ON department_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_user_modules_cache();

-- 8. Триггер: обновление кэша модулей при смене отдела пользователем
CREATE OR REPLACE FUNCTION update_user_department_modules()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    UPDATE users
    SET cached_modules = (
      SELECT COALESCE(JSONB_AGG(dm.module_code), '[]'::jsonb)
      FROM department_modules dm
      WHERE dm.department_id = NEW.department_id
        AND dm.is_enabled = true
    )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_department_modules ON users;

CREATE TRIGGER trigger_update_user_department_modules
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_department_modules();

-- 9. Назначить модули для существующих отделов (миграция данных)
-- Все существующие отделы получают task_planner
INSERT INTO department_modules (department_id, module_code)
SELECT d.id, 'task_planner'
FROM departments d
WHERE NOT EXISTS (
  SELECT 1 FROM department_modules dm
  WHERE dm.department_id = d.id AND dm.module_code = 'task_planner'
)
ON CONFLICT (department_id, module_code) DO NOTHING;

-- Все существующие отделы получают inventory (обратная совместимость)
INSERT INTO department_modules (department_id, module_code)
SELECT d.id, 'inventory'
FROM departments d
WHERE NOT EXISTS (
  SELECT 1 FROM department_modules dm
  WHERE dm.department_id = d.id AND dm.module_code = 'inventory'
)
ON CONFLICT (department_id, module_code) DO NOTHING;

-- 10. Обновить cached_modules для всех существующих пользователей
UPDATE users u
SET cached_modules = (
  SELECT COALESCE(JSONB_AGG(dm.module_code), '[]'::jsonb)
  FROM department_modules dm
  WHERE dm.department_id = u.department_id
    AND dm.is_enabled = true
)
WHERE u.department_id IS NOT NULL;
