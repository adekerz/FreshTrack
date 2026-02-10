-- =============================================
-- МИГРАЦИЯ: Исправление несоответствий product_id
-- Создано: 2026-02-10
-- =============================================

-- Эта миграция исправляет партии, у которых product_id не существует в таблице products
-- Стратегия: создать недостающие продукты на основе данных из партий

BEGIN;

-- 1. Найти все потерянные product_id (есть в batches, но нет в products)
CREATE TEMP TABLE orphaned_products AS
SELECT DISTINCT 
    b.product_id,
    b.hotel_id,
    b.department_id,
    -- Пытаемся восстановить имя продукта из других источников
    COALESCE(
        -- Может быть есть в других записях с join
        (SELECT p2.name FROM products p2 WHERE p2.id = b.product_id LIMIT 1),
        -- Или используем placeholder
        'Unknown Product ' || SUBSTRING(b.product_id::text, 1, 8)
    ) as product_name,
    MIN(b.created_at) as first_batch_date
FROM batches b
WHERE NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = b.product_id
)
GROUP BY b.product_id, b.hotel_id, b.department_id;

-- 2. Показать что будет создано (для логов)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count FROM orphaned_products;
    RAISE NOTICE 'Found % orphaned product IDs that need to be created', orphan_count;
END $$;

-- 3. Создать недостающие продукты
-- ВАЖНО: Это создает продукты с ID, которые УЖЕ используются в batches
INSERT INTO products (
    id,
    hotel_id,
    department_id,
    name,
    name_en,
    category_id,
    unit,
    is_active,
    created_at,
    updated_at
)
SELECT 
    op.product_id,
    op.hotel_id,
    op.department_id,
    op.product_name,
    op.product_name, -- English name = Russian name
    (SELECT id FROM categories WHERE hotel_id = op.hotel_id LIMIT 1), -- Default category
    'шт', -- Default unit
    true,
    op.first_batch_date,
    NOW()
FROM orphaned_products op
ON CONFLICT (id) DO NOTHING; -- Если вдруг уже есть, пропустить

-- 4. Вывести результаты
DO $$
DECLARE
    created_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO created_count FROM orphaned_products;
    RAISE NOTICE 'Created % missing products', created_count;
END $$;

-- 5. Проверка: должно быть 0 потерянных партий
DO $$
DECLARE
    remaining_orphans INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_orphans
    FROM batches b
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id);
    
    IF remaining_orphans > 0 THEN
        RAISE WARNING 'Still have % orphaned batches after migration!', remaining_orphans;
    ELSE
        RAISE NOTICE '✓ All batches now have valid product_id references';
    END IF;
END $$;

COMMIT;

-- ROLLBACK; -- Раскомментируйте для отката
