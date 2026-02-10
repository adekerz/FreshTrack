# План миграции технического долга FreshTrack

## ✅ Выполнено

### 1. Правила проекта обновлены
- `.agent/rules/backend.md` — запрещена бизнес-логика в контроллерах
- `.agent/rules/frontend.md` — уточнены правила display-enrichment
- Задокументирован обязательный middleware chain

### 2. Бизнес-логика вынесена в services
- `server/modules/inventory/inventory.controller.js` — используется ExpiryService вместо hardcoded расчётов

## ⚠️ Требуются исправления

### 3. Добавить hotelIsolation middleware  к inventory routes

**Проблема:** Routes в `inventory.controller.js` используют только `authMiddleware`, но не `hotelIsolation`.  
**Следствие:** Контроллер использует пользовательскую функцию `getEffectiveHotelId()` вместо стандартного `req.hotelId`.

**Решение:**
1. Добавить `hotelIsolation, departmentIsolation` к каждому route
2. Заменить `getEffectiveHotelId(req)` на `req.hotelId`
3. Убрать функцию `getEffectiveHotelId` (станет ненужной)

**Пример:**
```javascript
// ❌ Было
router.get('/batches'auth,Middleware, async (req, res) => {
  const hotelId = getEffectiveHotelId(req)
})

// ✅ Должно быть
router.get('/batches', 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation, 
  requirePermission(PermissionResource.BATCHES, PermissionAction.READ),
  async (req, res) => {
    const hotelId = req.hotelId
  }
)
```

**Затронуто:** ~20 routes в `inventory.controller.js`

---

### 4. Проверка использования req.user.hotel_id

**Найдено:** 30+ мест использования `req.user.hotel_id`

**Категории:**

#### ✅ Допустимо (middleware):
- `server/middleware/auth.js` строки 156, 275, 278 — в самом `authMiddleware` и `hotelIsolation`
- Это правильно, т.к. middleware устанавливает `req.hotelId` на основе `req.user.hotel_id`

#### ⚠️ Требует проверки (контроллеры БЕЗ hotelIsolation):
- `server/modules/auth/*` — auth контроллеры (`auth-users`, `auth-core`, `auth-mfa`, `auth-email`, `auth-account`)
- `server/modules/hotels/hotels.controller.js`
- `server/modules/departments/departments.controller.js`
- `server/modules/gdpr/gdpr.controller.js`

**Решение:** Добавить `hotelIsolation` middleware ко всем routes, затем заменить `req.user.hotel_id` на `req.hotelId`

---

### 5. Пороговые значения на фронте

**Текущее состояние:**
- `src/utils/dateUtils.js` — уже правильно приоритизирует backend данные
- Fallback логика с hardcoded порогами (3 дня  critical, 7 warning)

**Рекомендация:**
Убедиться что все API endpoints отдают enriched данные через `ExpiryService.enrichBatchesWithExpiryData()`

**Проверить:**
- `/api/batches` ✅ — уже использует `enrichBatchesWithExpiryData`
- `/api/batches/stats` ✅ — использует `StatisticsService`
- Другие endpoints, возвращающие batches

---

## Статистика

- **Правила:** 2 файла обновлено
- **Бизнес-логика в контроллерах:** 1 место исправлено (inventory.controller.js line 212-218)
- **Использование req.user.hotel_id:** 30+ мест требуют проверки
- **Middleware hotelIsolation:** нужно добавить к ~20 routes в inventory.controller.js

---

## Приоритеты

1. **Критично:** Добавить `hotelIsolation` к inventory routes (риск cross-hotel access)
2. **Важно:** Проверить auth/hotels/departments контроллеры на использование `req.user.hotel_id`
3. **Желательно:** Убедиться что все API возвращают enriched expiry data

---

## Контрольный чеклист

- [x] Правила backend обновлены
- [x] Правила frontend обновлены
- [x] Бизнес-логика в inventory.controller вынесена в ExpiryService
- [x] hotelIsolation добавлен к inventory routes (~20 routes обновлено)
- [x] getEffectiveHotelId удалён (заменён на req.hotelId)
- [x] req.user.hotel_id заменён на req.hotelId в inventory.controller
- [x] PermissionResource и PermissionAction используются вместо строк
- [ ] Проверены auth контроллеры
- [ ] Проверены hotels/departments контроллеры
