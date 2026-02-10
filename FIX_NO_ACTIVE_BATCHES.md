# Исправление ошибки NO_ACTIVE_BATCHES

## Проблема
В production базе данных есть партии (`batches`), которые ссылаются на несуществующие продукты (`products`).

## Диагностика

### 1. Проверить через debug endpoint:
```
GET https://api.freshtrack.systems/api/debug/products-check?hotel_id=149761ea-ca0a-4dad-818a-2d97886e2523
```

### 2. Или выполнить SQL запросы из `diagnose_products.sql`

## Решение

### Вариант A: Автоматическая миграция (РЕКОМЕНДУЕТСЯ)

Выполните миграцию `002_fix_orphaned_products.sql` в Railway Postgres:

1. Откройте Railway Dashboard → Postgres → Query
2. Скопируйте весь код из `server/db/migrations/002_fix_orphaned_products.sql`
3. Выполните
4. Проверьте результат - должно быть "✓ All batches now have valid product_id references"

**Что делает миграция:**
- Находит все `product_id` из таблицы `batches`, которых нет в `products`
- Создает недостающие продукты с корректными ID
- Использует имя "Unknown Product {id}" для восстановленных продуктов

### Вариант B: Ручное исправление

Если нужно более точное восстановление данных:

```sql
-- 1. Найти проблемные ID
SELECT DISTINCT b.product_id, COUNT(*) as batches_count
FROM batches b
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id)
GROUP BY b.product_id;

-- 2. Для каждого ID создать продукт вручную
INSERT INTO products (id, hotel_id, department_id, name, unit, is_active, created_at, updated_at)
VALUES 
  ('e29f626d-be5a-4258-97bf-91ce18ca618d', '149761ea-ca0a-4dad-818a-2d97886e2523', 
   '500e7056-e0fa-4aef-bc78-af4ca05731db', 'Восстановленный продукт 1', 'шт', true, NOW(), NOW());
```

## После исправления

1. **Проверьте debug endpoint** - `orphanedBatches` должно быть 0
2. **Перезагрузите фронтенд** с очисткой кэша (Ctrl+Shift+R)
3. **Проверьте FIFO списание** - должно работать

## Удаление debug endpoint

После исправления удалите временный endpoint из `server/index.js`:
- Найдите секцию `// 🔍 TEMPORARY DEBUG ENDPOINT`
- Удалите весь блок с `app.get('/api/debug/products-check', ...)`

## Удаление диагностических логов

После стабилизации удалите консольные логи из:
- `src/components/FIFOCollectModal.jsx` (строки с `console.log('[FIFO Debug]')`)
- `server/services/CollectionService.js` (строки с `console.log('[FIFO Preview]')`)
