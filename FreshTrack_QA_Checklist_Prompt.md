# FreshTrack: Промпт для проверки изменений

## Контекст

Ты — Senior QA Engineer и Code Reviewer. Твоя задача — провести полную проверку изменений после каждой фазы рефакторинга FreshTrack.

**Проект:** FreshTrack — система учёта сроков годности продуктов для отелей
**Репозиторий:** https://github.com/adekerz/FreshTrack.git
**Tech Stack:** React 18, Vite, TailwindCSS, Express.js, SQLite (better-sqlite3), JWT

---

## Инструкция

После каждой фазы рефакторинга выполни следующие проверки. Отвечай структурированно, используя чеклисты. Для каждого пункта указывай статус: ✅ PASS, ❌ FAIL, ⚠️ WARNING, ⏭️ SKIP.

---

## Фаза 0: Подготовка — Чеклист проверки

### 0.1 Backup и версионирование
```
[ ] Backup базы данных создан (файл существует, размер > 0)
[ ] Backup можно восстановить (тестовое восстановление прошло)
[ ] Git tag v1.0-before-refactor создан и запушен
[ ] Ветка refactor/architecture-v2 создана
[ ] Текущий main/master стабилен (все тесты проходят)
```

### 0.2 Документация
```
[ ] Файл CURRENT_STATE.md создан
[ ] Описаны все модели данных с текущими полями
[ ] Описаны текущие роли и их проблемы
[ ] Список известных багов задокументирован
[ ] Критичные endpoints перечислены
```

### 0.3 Тестовое окружение
```
[ ] Тестовая БД создана (freshtrack_test)
[ ] Данные скопированы из production
[ ] .env.test настроен корректно
[ ] Приложение запускается с тестовой БД
[ ] Тестовые учётные записи работают
```

### 0.4 Миграции
```
[ ] db-migrate установлен
[ ] database.json настроен для dev и test
[ ] Команда npx db-migrate up выполняется без ошибок
[ ] Команда npx db-migrate down откатывает изменения
```

### Команды для проверки Фазы 0:
```bash
# Проверить backup
ls -la backup_*.sql
pg_restore --list backup_*.sql 2>/dev/null || sqlite3 backup.db ".tables"

# Проверить git
git tag -l | grep "v1.0-before-refactor"
git branch -a | grep "refactor/architecture-v2"

# Проверить документацию
cat CURRENT_STATE.md

# Проверить тестовую БД
NODE_ENV=test npm run server &
curl http://localhost:3001/api/health

# Проверить миграции
npx db-migrate up --dry-run
```

---

## Фаза 1: Система разрешений — Чеклист проверки

### 1.1 Модели
```
[ ] Файл backend/src/models/Permission.ts существует
[ ] Enum PermissionResource содержит все ресурсы (inventory, products, batches, users, settings, reports, departments, hotels)
[ ] Enum PermissionAction содержит все действия (read, create, update, delete, export, manage)
[ ] Enum PermissionScope содержит все области (own, department, hotel, all)
[ ] Файл backend/src/models/RolePermission.ts существует
[ ] Связь Permission <-> Role через RolePermission работает
```

### 1.2 Миграции
```
[ ] Миграция create-permissions.js существует
[ ] Таблица permissions создана в БД
[ ] Таблица role_permissions создана в БД
[ ] Индексы созданы (permissions_unique_idx, role_permissions_unique_idx)
[ ] Миграция откатывается без ошибок (down)
```

### 1.3 Seed данных
```
[ ] Файл seedPermissions.ts существует
[ ] Seed выполняется без ошибок
[ ] Permissions для всех ролей созданы
[ ] SUPER_ADMIN имеет scope=all для всех ресурсов
[ ] HOTEL_ADMIN имеет scope=hotel (НЕ all)
[ ] USER имеет только базовые разрешения
```

### 1.4 PermissionService
```
[ ] Метод hasPermission работает корректно
[ ] Метод checkScope правильно проверяет области
[ ] Метод canManageUser запрещает HOTEL_ADMIN управлять SUPER_ADMIN
[ ] Метод canManageUser запрещает HOTEL_ADMIN управлять другим HOTEL_ADMIN
[ ] Метод canManageUser разрешает HOTEL_ADMIN управлять USER в своём отеле
```

### 1.5 Middleware
```
[ ] requirePermission middleware создан
[ ] Возвращает 401 если нет аутентификации
[ ] Возвращает 403 если нет разрешения
[ ] Передаёт управление дальше если разрешение есть
[ ] requireCanManageUser middleware создан и работает
```

### 1.6 Интеграция
```
[ ] Минимум 3 роута обновлены с requirePermission
[ ] Роут создания пользователя защищён
[ ] Роут блокировки пользователя защищён
[ ] Роут удаления продукта защищён
```

### 1.7 Функциональные тесты
```
[ ] SUPER_ADMIN может заблокировать HOTEL_ADMIN
[ ] HOTEL_ADMIN НЕ может заблокировать SUPER_ADMIN
[ ] HOTEL_ADMIN НЕ может заблокировать другого HOTEL_ADMIN
[ ] HOTEL_ADMIN может заблокировать USER в своём отеле
[ ] HOTEL_ADMIN НЕ может заблокировать USER в чужом отеле
[ ] USER не может создавать других пользователей
```

### Команды для проверки Фазы 1:
```bash
# Проверить таблицы
sqlite3 freshtrack.db ".schema permissions"
sqlite3 freshtrack.db ".schema role_permissions"

# Проверить seed
sqlite3 freshtrack.db "SELECT COUNT(*) FROM permissions"
sqlite3 freshtrack.db "SELECT role, COUNT(*) FROM role_permissions GROUP BY role"

# API тесты
# Попытка HOTEL_ADMIN заблокировать SUPER_ADMIN (должен быть 403)
curl -X PUT http://localhost:3001/api/users/SUPER_ADMIN_ID/block \
  -H "Authorization: Bearer HOTEL_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Попытка USER создать пользователя (должен быть 403)
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","role":"USER"}'
```

---

## Фаза 2: Контекст владения данными — Чеклист проверки

### 2.1 Миграции User
```
[ ] Миграция add-department-to-user.js существует
[ ] Поле departmentId добавлено в users
[ ] Индекс на departmentId создан
[ ] Существующие пользователи заполнены дефолтным departmentId
[ ] Поле departmentId стало NOT NULL
```

### 2.2 Миграции Product
```
[ ] Миграция add-context-to-product.js существует
[ ] Поле hotelId добавлено в products
[ ] Поле departmentId добавлено в products
[ ] Индексы созданы
[ ] Существующие продукты заполнены значениями
[ ] Оба поля стали NOT NULL
```

### 2.3 Миграции Batch
```
[ ] Миграция add-context-to-batch.js существует
[ ] Поле hotelId добавлено в batches
[ ] Поле departmentId добавлено в batches
[ ] Индексы созданы
[ ] Существующие партии заполнены из связанного пользователя
[ ] Оба поля стали NOT NULL
```

### 2.4 Миграции Category
```
[ ] Миграция add-context-to-category.js существует
[ ] Поля hotelId и departmentId добавлены (nullable для глобальных категорий)
[ ] Существующие категории остались глобальными (NULL)
```

### 2.5 Модели Sequelize
```
[ ] User модель содержит departmentId
[ ] Product модель содержит hotelId и departmentId
[ ] Batch модель содержит hotelId и departmentId
[ ] Category модель содержит hotelId и departmentId
[ ] Ассоциации обновлены
```

### 2.6 Фильтрация данных
```
[ ] GET /api/products возвращает только продукты отеля/отдела пользователя
[ ] GET /api/batches возвращает только партии отеля/отдела пользователя
[ ] GET /api/inventory фильтрует по контексту
[ ] SUPER_ADMIN видит все данные
[ ] HOTEL_ADMIN видит данные только своего отеля
[ ] USER видит данные только своего отдела
```

### Команды для проверки Фазы 2:
```bash
# Проверить схему
sqlite3 freshtrack.db ".schema users" | grep departmentId
sqlite3 freshtrack.db ".schema products" | grep -E "(hotelId|departmentId)"
sqlite3 freshtrack.db ".schema batches" | grep -E "(hotelId|departmentId)"

# Проверить данные
sqlite3 freshtrack.db "SELECT COUNT(*) FROM users WHERE departmentId IS NULL"  # Должно быть 0
sqlite3 freshtrack.db "SELECT COUNT(*) FROM products WHERE hotelId IS NULL"     # Должно быть 0
sqlite3 freshtrack.db "SELECT COUNT(*) FROM batches WHERE departmentId IS NULL" # Должно быть 0

# Проверить фильтрацию
curl http://localhost:3001/api/products -H "Authorization: Bearer USER_TOKEN"
curl http://localhost:3001/api/products -H "Authorization: Bearer HOTEL_ADMIN_TOKEN"
curl http://localhost:3001/api/products -H "Authorization: Bearer SUPER_ADMIN_TOKEN"
```

---

## Фаза 3: Backend как источник логики — Чеклист проверки

### 3.1 StatusService
```
[ ] Файл backend/src/services/statusService.ts существует
[ ] Метод calculateStatus возвращает корректный статус
[ ] EXPIRED при daysUntilExpiry < 0
[ ] CRITICAL при daysUntilExpiry <= 3
[ ] WARNING при daysUntilExpiry <= 7
[ ] OK при daysUntilExpiry > 7
[ ] Метод getColors возвращает корректные цвета для каждого статуса
[ ] Метод getDaysUntilExpiry считает дни правильно
```

### 3.2 API responses
```
[ ] GET /api/batches возвращает поле status
[ ] GET /api/batches возвращает поле daysUntilExpiry
[ ] GET /api/batches возвращает поле colors с bg, text, border
[ ] GET /api/batches возвращает полный объект category (id, name, color)
[ ] GET /api/inventory возвращает enriched данные
```

### 3.3 Статистика
```
[ ] GET /api/stats/dashboard возвращает byCategory с реальными названиями
[ ] GET /api/stats/dashboard возвращает byStatus с количествами
[ ] Нет категории "другое" или "unknown"
[ ] Фильтры по датам работают (week, month, all)
```

### 3.4 Frontend
```
[ ] Frontend НЕ содержит расчёт статусов (удалён или не используется)
[ ] Frontend использует status из API response
[ ] Frontend использует colors из API response
[ ] Календарь показывает правильные цвета
```

### Команды для проверки Фазы 3:
```bash
# Проверить API response
curl http://localhost:3001/api/batches -H "Authorization: Bearer TOKEN" | jq '.[0] | {status, daysUntilExpiry, colors, category}'

# Проверить статистику
curl http://localhost:3001/api/stats/dashboard -H "Authorization: Bearer TOKEN" | jq '.byCategory'

# Проверить что нет "другое"
curl http://localhost:3001/api/stats/dashboard -H "Authorization: Bearer TOKEN" | jq '.byCategory[].categoryName' | grep -i "other\|другое\|unknown"
# Должно быть пусто

# Поиск расчёта статусов в frontend (должно быть пусто или закомментировано)
grep -r "calculateStatus\|getStatus\|daysUntil" frontend/src/
```

---

## Фаза 4: Централизованный аудит — Чеклист проверки

### 4.1 Модель ActivityLog
```
[ ] Enum ActivityAction содержит: create, update, delete, login, logout, export, block, unblock, collect
[ ] Enum ActivityEntityType содержит: user, product, batch, category, department, hotel, settings, collection
[ ] Поля snapshotBefore и snapshotAfter существуют (JSON)
[ ] Поле entityName существует
[ ] Поля ipAddress и userAgent существуют
```

### 4.2 AuditService
```
[ ] Метод log создаёт записи корректно
[ ] Метод formatDescription возвращает читаемый текст
[ ] Все поля заполняются (userId, action, entityType, entityId, hotelId)
[ ] Snapshot сохраняется при update и delete
```

### 4.3 Интеграция
```
[ ] Создание пользователя логируется
[ ] Обновление пользователя логируется
[ ] Блокировка пользователя логируется
[ ] Создание продукта логируется
[ ] Создание партии логируется
[ ] Списание логируется
[ ] Изменение настроек логируется
[ ] Login логируется
```

### 4.4 API журнала
```
[ ] GET /api/activity возвращает записи
[ ] Фильтрация по entityType работает
[ ] Фильтрация по action работает
[ ] Фильтрация по дате работает
[ ] Пагинация работает
[ ] Поле description читаемое (не JSON)
```

### Команды для проверки Фазы 4:
```bash
# Создать пользователя и проверить лог
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test","role":"USER"}'

# Проверить что запись создана
curl "http://localhost:3001/api/activity?entityType=user&action=create" \
  -H "Authorization: Bearer ADMIN_TOKEN" | jq '.[0]'

# Проверить читаемость
sqlite3 freshtrack.db "SELECT id, action, entityType, entityName FROM activity_logs ORDER BY createdAt DESC LIMIT 5"
```

---

## Фаза 5: Notification Engine — Чеклист проверки

### 5.1 Модель Notification
```
[ ] Enum NotificationChannel: app, telegram, email
[ ] Enum NotificationStatus: pending, sent, failed, read
[ ] Поле attempts существует
[ ] Поле lastAttemptAt существует
[ ] Поле sentAt существует
[ ] Поле data (JSON) существует
```

### 5.2 NotificationService
```
[ ] Метод send создаёт notification
[ ] Метод deliver отправляет через нужный канал
[ ] Retry работает (до 3 попыток)
[ ] Статус меняется на SENT при успехе
[ ] Статус меняется на FAILED после 3 неудачных попыток
```

### 5.3 Telegram интеграция
```
[ ] TelegramService существует
[ ] Bot token настроен в .env
[ ] Сообщения отправляются
[ ] Ошибки логируются
```

### 5.4 ExpiryCheckJob
```
[ ] Job запускается по расписанию
[ ] Находит партии с близким сроком годности
[ ] Создаёт уведомления для нужных пользователей
[ ] Не дублирует уведомления (проверка за 24 часа)
[ ] Использует настройки warningDays и criticalDays
```

### 5.5 API уведомлений
```
[ ] GET /api/notifications возвращает уведомления пользователя
[ ] PUT /api/notifications/:id/read помечает как прочитанное
[ ] Счётчик непрочитанных работает
```

### Команды для проверки Фазы 5:
```bash
# Проверить таблицу
sqlite3 freshtrack.db ".schema notifications"

# Запустить job вручную
curl -X POST http://localhost:3001/api/jobs/expiry-check -H "Authorization: Bearer ADMIN_TOKEN"

# Проверить уведомления
sqlite3 freshtrack.db "SELECT channel, status, attempts FROM notifications ORDER BY createdAt DESC LIMIT 5"

# Проверить Telegram (если настроен)
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

---

## Фаза 6: Унификация данных — Чеклист проверки

### 6.1 Типы
```
[ ] StandardFilters интерфейс создан
[ ] StandardResponse интерфейс создан
[ ] Поддержка пагинации (limit, offset, page, pageSize)
[ ] Поддержка сортировки (sortBy, sortOrder)
[ ] Поддержка фильтров (hotelId, departmentIds, dateFrom, dateTo, status, categoryIds, search)
```

### 6.2 QueryBuilder
```
[ ] buildWhereClause автоматически добавляет контекст пользователя
[ ] SUPER_ADMIN не ограничивается hotelId
[ ] HOTEL_ADMIN ограничивается своим hotelId
[ ] USER ограничивается своим departmentId
[ ] Фильтры применяются корректно
```

### 6.3 API endpoints
```
[ ] GET /api/inventory использует StandardFilters
[ ] GET /api/batches использует StandardFilters
[ ] GET /api/products использует StandardFilters
[ ] Все ответы содержат pagination
[ ] Все ответы содержат filters.available
```

### 6.4 Frontend
```
[ ] Компоненты фильтров унифицированы
[ ] Выбор департамента работает как фильтр
[ ] Выбор категории работает как фильтр
[ ] Выбор статуса работает как фильтр
[ ] Диапазон дат работает
```

### Команды для проверки Фазы 6:
```bash
# Проверить пагинацию
curl "http://localhost:3001/api/batches?limit=10&offset=0" -H "Authorization: Bearer TOKEN" | jq '.pagination'

# Проверить фильтры
curl "http://localhost:3001/api/batches?status=CRITICAL,EXPIRED" -H "Authorization: Bearer TOKEN" | jq 'length'

# Проверить available filters
curl "http://localhost:3001/api/batches" -H "Authorization: Bearer TOKEN" | jq '.filters.available'
```

---

## Фаза 7: Настройки как правила — Чеклист проверки

### 7.1 Модель Settings
```
[ ] Enum SettingsScope: system, hotel, department, user
[ ] Поля scope, scopeId, key, value существуют
[ ] Уникальный индекс на (scope, scopeId, key)
```

### 7.2 SettingsService
```
[ ] Метод get возвращает настройку с учётом иерархии
[ ] Иерархия: user → department → hotel → system
[ ] Метод set создаёт/обновляет настройку
[ ] Метод getAll возвращает все настройки scope
```

### 7.3 Seed настроек
```
[ ] branding.logo установлен
[ ] branding.primaryColor установлен
[ ] branding.secondaryColor установлен
[ ] branding.companyName установлен
[ ] locale.language установлен
[ ] locale.timezone установлен
[ ] locale.dateFormat установлен
[ ] notifications.warningDays = 7
[ ] notifications.criticalDays = 3
```

### 7.4 API настроек
```
[ ] GET /api/settings/user возвращает настройки пользователя
[ ] GET /api/settings/hotel возвращает настройки отеля
[ ] PUT /api/settings обновляет настройку
[ ] POST /api/settings/batch обновляет несколько настроек
```

### 7.5 Применение настроек
```
[ ] StatusService использует notifications.warningDays
[ ] StatusService использует notifications.criticalDays
[ ] Frontend применяет branding.primaryColor
[ ] Frontend применяет branding.companyName
```

### Команды для проверки Фазы 7:
```bash
# Проверить seed
sqlite3 freshtrack.db "SELECT key, value FROM settings WHERE scope = 'system'"

# Проверить API
curl http://localhost:3001/api/settings/user -H "Authorization: Bearer TOKEN"

# Обновить настройку
curl -X PUT http://localhost:3001/api/settings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"notifications.warningDays","value":5,"scope":"hotel"}'

# Проверить применение
curl http://localhost:3001/api/batches -H "Authorization: Bearer TOKEN" | jq '.[0].status'
# Статус должен учитывать новый warningDays
```

---

## Фаза 8: Рефакторинг логики сбора — Чеклист проверки

### 8.1 Модель Collection
```
[ ] Поле productId существует
[ ] Поле batchId существует (nullable)
[ ] Поле quantity существует
[ ] Поле reason существует (enum: collected, expired, damaged, other)
[ ] Поле notes существует
[ ] Поле collectedBy существует
[ ] Поле batchSnapshot существует (JSON с expiryDate, productionDate, originalQuantity)
[ ] Поля hotelId и departmentId существуют
```

### 8.2 CollectionService
```
[ ] Метод collectProduct принимает productId, quantity, reason
[ ] FIFO: партии сортируются по expiryDate ASC
[ ] Списание идёт из партий с ближайшим сроком
[ ] Если одной партии не хватает — берётся из следующей
[ ] Партии с quantity=0 удаляются
[ ] Возвращается список затронутых партий
[ ] Ошибка если quantity > доступного количества
```

### 8.3 Preview
```
[ ] Метод previewCollection показывает какие партии будут затронуты
[ ] Preview не изменяет данные
[ ] Preview возвращает batchId, expiryDate, toCollect, remaining
```

### 8.4 API
```
[ ] POST /api/collections/collect принимает productId, quantity, reason, notes
[ ] GET /api/collections/preview возвращает предпросмотр
[ ] Транзакционность: либо всё списывается, либо ничего
[ ] Аудит: действие логируется в ActivityLog
```

### 8.5 Frontend
```
[ ] Компонент CollectProductModal существует
[ ] Показывает общее количество продукта
[ ] Показывает разбивку по партиям
[ ] Показывает ближайший срок годности
[ ] Ввод количества работает (+ / - кнопки и input)
[ ] Выбор причины работает (radio buttons)
[ ] Preview отображается при изменении количества
[ ] Кнопка "Списать" работает
[ ] После списания UI обновляется
```

### 8.6 FIFO тесты
```
[ ] Тест: списать меньше чем в первой партии
[ ] Тест: списать ровно первую партию (партия удаляется)
[ ] Тест: списать из нескольких партий
[ ] Тест: списать всё количество (все партии удаляются)
[ ] Тест: попытка списать больше чем есть (ошибка)
[ ] Тест: batchSnapshot сохраняется корректно
```

### Команды для проверки Фазы 8:
```bash
# Подготовить тестовые данные
# Продукт с 3 партиями: 50 (exp 25.12), 30 (exp 28.12), 20 (exp 05.01)

# Проверить preview
curl "http://localhost:3001/api/collections/preview?productId=PRODUCT_ID&quantity=65" \
  -H "Authorization: Bearer TOKEN" | jq

# Должно показать:
# [
#   { batchId: "...", expiryDate: "2025-12-25", toCollect: 50, remaining: 0 },
#   { batchId: "...", expiryDate: "2025-12-28", toCollect: 15, remaining: 15 }
# ]

# Выполнить списание
curl -X POST http://localhost:3001/api/collections/collect \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"PRODUCT_ID","quantity":65,"reason":"collected","notes":"Test FIFO"}'

# Проверить результат
curl "http://localhost:3001/api/batches?productId=PRODUCT_ID" \
  -H "Authorization: Bearer TOKEN" | jq

# Первая партия должна быть удалена
# Вторая партия должна иметь quantity=15
# Третья партия без изменений

# Проверить историю
curl "http://localhost:3001/api/collections?productId=PRODUCT_ID" \
  -H "Authorization: Bearer TOKEN" | jq '.[0].batchSnapshot'
```

---

## Общий финальный чеклист

### Безопасность
```
[ ] Блокировка пользователей работает
[ ] HOTEL_ADMIN не может управлять SUPER_ADMIN
[ ] Каждый пользователь видит только свои данные
[ ] Permissions проверяются на каждом endpoint
[ ] JWT токены валидируются
[ ] Пароли хэшируются bcrypt
```

### Функциональность
```
[ ] Календарь показывает правильные цвета
[ ] Статистика "по категориям" не показывает "другое"
[ ] История сборов показывает правильный срок годности (из snapshot)
[ ] Журнал действий полный и читаемый
[ ] Telegram уведомления работают
[ ] Экспорт работает во всех разделах
[ ] Настройки сохраняются и применяются
[ ] Сбор по количеству с FIFO работает корректно
```

### Производительность
```
[ ] Запросы выполняются < 500ms
[ ] Индексы созданы на всех foreign keys
[ ] Нет N+1 queries (проверить через логи SQL)
[ ] Пагинация работает на больших данных
```

### Качество кода
```
[ ] Нет console.error в логах (кроме ожидаемых)
[ ] TypeScript компилируется без ошибок
[ ] ESLint проходит без ошибок
[ ] Все импорты резолвятся
```

### Документация
```
[ ] README обновлён
[ ] API endpoints задокументированы
[ ] Переменные окружения описаны
[ ] Миграции задокументированы
```

---

## Формат отчёта

После проверки каждой фазы сформируй отчёт в формате:

```markdown
# Отчёт проверки Фазы N: [Название]

**Дата:** YYYY-MM-DD
**Проверяющий:** [Имя/AI]
**Ветка:** refactor/architecture-v2
**Commit:** [hash]

## Результаты

### Категория 1
- ✅ Пункт 1 — OK
- ✅ Пункт 2 — OK
- ❌ Пункт 3 — FAIL: [описание проблемы]
- ⚠️ Пункт 4 — WARNING: [описание предупреждения]

### Категория 2
...

## Критичные проблемы
1. [Проблема и как исправить]

## Рекомендации
1. [Рекомендация]

## Статус
- [ ] Готово к мержу
- [x] Требует исправлений
```

---

## Автоматизация

Для автоматизации проверок можно создать скрипт:

```bash
#!/bin/bash
# check-phase.sh

PHASE=$1
TOKEN=$2
BASE_URL=${3:-"http://localhost:3001"}

echo "=== Проверка Фазы $PHASE ==="

case $PHASE in
  0)
    echo "Checking backups..."
    ls -la backup_*.sql 2>/dev/null || echo "❌ Backup not found"
    git tag -l | grep -q "v1.0-before-refactor" && echo "✅ Git tag exists" || echo "❌ Git tag missing"
    ;;
  1)
    echo "Checking permissions..."
    curl -s "$BASE_URL/api/users" -H "Authorization: Bearer $TOKEN" > /dev/null && echo "✅ API accessible" || echo "❌ API error"
    ;;
  # ... добавить остальные фазы
esac
```

---

Используй этот промпт после каждой фазы рефакторинга для систематической проверки всех изменений.
