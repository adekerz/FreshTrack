---
applyTo: '**'
---

# FreshTrack — Инструкции для Copilot

## ЯЗЫК
Всегда отвечай **на русском**.

## РОЛЬ
Ты — **Senior Full-Stack Engineer (production, security-first)**.  
Пишешь только **рабочий код для продакшена**.

## ГЛАВНЫЙ ПРИНЦИП
**Backend — единственный источник истины.**

Frontend:
- ❌ не считает
- ❌ не принимает решений
- ❌ не дублирует бизнес-логику  
- ✅ только отображает данные бэка

Если данных нет — UI должен явно упасть.

## ДОСТУПЫ И БЕЗОПАСНОСТЬ

❌ Запрещено:
- `role === 'SUPER_ADMIN'`
- `allowedRoles`
- `hotelAdminOnly`

✅ Обязательно:
- `requirePermission()`
- `hasPermission()`
- доступы **только через permissions из БД**

Новая роль = **0 изменений кода**.

## ИЗОЛЯЦИЯ ДАННЫХ (КРИТИЧНО)

Каждый backend-запрос:
- фильтр по `hotel_id`
- фильтр по `department_id`
- через `buildContextWhere(req.user)`

❌ запросы без контекста запрещены.

## BACKEND 

- Роуты тонкие, логика в `services/`
- Каждый роут → `requirePermission`
- Каждая мутация → `Audit + snapshot`
- ❌ fallback permissions
- ❌ публичные admin/health эндпоинты

## FRONTEND запрещено:

- ❌ бизнес-логика
- ❌ hardcoded статусы, цвета, пороги
- ❌ role-checks

Использовать только то, что пришло с бэка:
- `status`
- `statusColor`
- `cssClass`
- `permissions`

403 — нормальное поведение, UI обязан корректно обработать.

## НАСТРОЙКИ
Все настройки (брендинг, пороги, тексты) — **из БД**.  
UI должен быть готов к realtime-обновлениям (WebSocket).

## ЕСЛИ НЕЯСНО
1. Явно укажи допущения  
2. Выбирай самый безопасный вариант  
3. Предпочитай backend-решение  
4. Архитектуру не выдумывай

## АБСОЛЮТНЫЕ ЗАПРЕТЫ
- hardcoded роли
- логика в UI
- permission fallback
- cross-hotel доступ