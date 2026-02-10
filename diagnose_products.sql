-- =============================================
-- ДИАГНОСТИКА ПРОБЛЕМЫ NO_ACTIVE_BATCHES
-- =============================================

-- 1. Проверить какие product_id используются в партиях
SELECT 
    b.product_id,
    p.name as product_name,
    COUNT(b.id) as batches_count,
    SUM(CASE WHEN b.status = 'active' AND (b.quantity > 0 OR b.quantity IS NULL) THEN 1 ELSE 0 END) as active_batches,
    COUNT(DISTINCT b.department_id) as departments_count
FROM batches b
LEFT JOIN products p ON b.product_id = p.id
WHERE b.hotel_id = '149761ea-ca0a-4dad-818a-2d97886e2523'
GROUP BY b.product_id, p.name
ORDER BY active_batches DESC;

-- 2. Найти "потерянные" партии (где product_id не существует в таблице products)
SELECT 
    b.id as batch_id,
    b.product_id,
    b.quantity,
    b.status,
    b.expiry_date,
    b.department_id
FROM batches b
WHERE b.hotel_id = '149761ea-ca0a-4dad-818a-2d97886e2523'
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = b.product_id
  )
ORDER BY b.created_at DESC;

-- 3. Проверить конкретные проблемные ID
SELECT 
    'e29f626d-be5a-4258-97bf-91ce18ca618d' as searched_id,
    EXISTS(SELECT 1 FROM products WHERE id = 'e29f626d-be5a-4258-97bf-91ce18ca618d') as exists_in_products,
    EXISTS(SELECT 1 FROM batches WHERE product_id = 'e29f626d-be5a-4258-97bf-91ce18ca618d') as exists_in_batches;

SELECT 
    'd46d416e-7d01-4865-8423-e01a74034a88' as searched_id,
    EXISTS(SELECT 1 FROM products WHERE id = 'd46d416e-7d01-4865-8423-e01a74034a88') as exists_in_products,
    EXISTS(SELECT 1 FROM batches WHERE product_id = 'd46d416e-7d01-4865-8423-e01a74034a88') as exists_in_batches;

-- 4. Показать все активные партии с их product_id
SELECT 
    b.id as batch_id,
    b.product_id,
    p.name as product_name,
    b.quantity,
    b.status,
    b.expiry_date,
    b.department_id,
    d.name as department_name
FROM batches b
LEFT JOIN products p ON b.product_id = p.id
LEFT JOIN departments d ON b.department_id = d.id
WHERE b.hotel_id = '149761ea-ca0a-4dad-818a-2d97886e2523'
  AND b.status = 'active'
  AND (b.quantity > 0 OR b.quantity IS NULL)
ORDER BY p.name, b.expiry_date;

-- 5. Проверить продукты из таблицы products
SELECT 
    p.id,
    p.name,
    p.department_id,
    d.name as department_name,
    (SELECT COUNT(*) FROM batches b WHERE b.product_id = p.id AND b.status = 'active') as active_batches_count
FROM products p
LEFT JOIN departments d ON p.department_id = d.id
WHERE p.hotel_id = '149761ea-ca0a-4dad-818a-2d97886e2523'
ORDER BY p.name;
