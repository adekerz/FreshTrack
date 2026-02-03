# 🍃 FreshTrack — Система контроля сроков годности

<div align="center">

![FreshTrack](https://img.shields.io/badge/FreshTrack-v3.1.0-green?style=for-the-badge&logo=leaflet&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-304%2B_passing-success?style=flat-square)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript)

**Enterprise-grade система контроля сроков годности для отелей Marriott, Accor, Hilton и независимых сетей**

**Read in English:** [README.en.md](README.en.md)

🌐 [freshtrack.systems](https://freshtrack.systems) • 📚 [Документация](docs/README.md) • 🤖 [Telegram Bot](#-telegram-интеграция)

*Обновлено: 3 февраля 2026*

</div>

---

## 🎯 О проекте

**FreshTrack** — production-ready система для контроля сроков годности продуктов в отелях и предприятиях HoReCa. Архитектура уровня enterprise: полная изоляция данных, RBAC на уровне БД, аудит всех операций, интеграция с MARSHA (Marriott) и готовность к OPERA/SAP.

### Ключевые характеристики

| Метрика          | Значение                                 |
| ---------------- | ---------------------------------------- |
| **Тесты**        | 304+ passing                             |
| **Архитектура**  | Backend as Single Source of Truth        |
| **Безопасность** | RBAC + Hotel Isolation + Audit Trail     |
| **Интеграции**   | MARSHA, Telegram, готовность к OPERA/SAP |
| **Языки**        | RU, EN, KK, DE, FR, ES, IT, AR (RTL)     |

---

## ✨ Возможности

### 🏨 Мультиотельная архитектура

- Полная изоляция данных между отелями (`hotel_id` на всех таблицах)
- SUPER_ADMIN управляет всеми отелями
- HOTEL_ADMIN видит только свой отель

### 🔐 Безопасность Enterprise-уровня

- **RBAC** на уровне базы данных (не hardcoded роли!)
- **Permissions**: `resource:action:scope` (inventory:read:department)
- **Audit logging** всех операций со snapshots
- Добавление новой роли = **0 изменений кода**

### 🏷️ MARSHA коды (Marriott)

- Интеграция с системой кодов Marriott International
- Справочник 237+ отелей мировой сети
- Защита от прямого редактирования (триггер БД)
- Готовность к OPERA, SAP, PMS (`external_ids` таблица)

### 📊 Backend-driven статусы

- Все вычисления на сервере (ExpiryService)
- Frontend только отображает `statusColor`, `statusText`
- Единый источник истины — нет drift между компонентами

### 🤖 Telegram интеграция

- Ежедневные отчёты в настраиваемое время
- Привязка чатов к отделам (в т.ч. для запланированных экспортов)
- Real-time уведомления о критических событиях

### 📦 Управление продуктами

- Каталог из 26 преднастроенных продуктов мини-бара
- FIFO-сбор с автоматическим удалением старых партий
- Иерархия: Отели → Отделы → Продукты → Партии

### 📈 Аналитика и отчёты

- Статистика по статусам (просрочено, критично, внимание, норма)
- **Централизованный экспорт:** 7 типов отчётов (инвентарь, партии, категории, отделы, сборы, аудит, MARSHA) в Excel/PDF/CSV с единым дизайном
- **Запланированные экспорты:** cron-отправка отчётов на email и в Telegram по расписанию (ежедневно/еженедельно/ежемесячно)
- Календарь сроков годности
- История изменений с полным аудитом

### 🌍 Интернационализация

- 8 языков: RU, EN, KK, DE, FR, ES, IT, AR
- RTL поддержка для арабского
- Переключение языка в реальном времени

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Request → requirePermission()      [Access Control]         │
│  2. Filter  → buildContextWhere()      [Data Isolation]         │
│  3. Logic   → ExpiryService            [Status/Colors]          │
│  4. Audit   → AuditService             [Snapshots]              │
│  5. Output  → Enriched data            [Ready to render]        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                      │
│  • hotel_id + department_id на всех таблицах                    │
│  • permissions + role_permissions (RBAC)                        │
│  • external_ids (MARSHA, OPERA, SAP)                            │
│  • JSONB snapshots для аудита                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Принципы

| Принцип                              | Реализация                                           |
| ------------------------------------ | ---------------------------------------------------- |
| **Backend = Single Source of Truth** | Frontend не вычисляет статусы, не проверяет роли     |
| **No Hardcoded Roles**               | `requirePermission()` вместо `if (role === 'ADMIN')` |
| **Hotel Isolation**                  | `buildContextWhere(req.user)` на каждом запросе      |
| **Immutable Audit**                  | `snapshot_before` / `snapshot_after` JSONB           |

---

## 🛠️ Технологический стек

### Frontend

| Технология   | Версия | Назначение    |
| ------------ | ------ | ------------- |
| React        | 18.2   | UI библиотека |
| Vite         | 5.x    | Сборщик       |
| TailwindCSS  | 3.4    | Стили         |
| React Router | 6.x    | Маршрутизация |
| i18next      | 23.x   | 8 языков      |
| Chart.js     | 4.x    | Графики       |

### Backend

| Технология | Версия | Назначение        |
| ---------- | ------ | ----------------- |
| Node.js    | 20+    | Runtime           |
| Express    | 4.18   | Web-фреймворк     |
| PostgreSQL | 16     | База данных       |
| Zod        | 3.x    | Валидация         |
| JWT        | -      | Аутентификация    |
| SSE        | -      | Real-time события |

### Infrastructure

| Сервис  | Назначение       |
| ------- | ---------------- |
| Railway | Backend hosting  |
| Vercel  | Frontend hosting |
| Docker  | Local PostgreSQL |

---

## 🚀 Быстрый старт

### Требования

- Node.js 20+
- PostgreSQL 16+ (или Docker)
- npm 9+

### Установка

```bash
# Клонирование
git clone https://github.com/adekerz/FreshTrack.git
cd FreshTrack

# Установка зависимостей
npm install
cd server && npm install && cd ..

# Запуск PostgreSQL (Docker)
cd server && docker-compose up -d && cd ..

# Миграции
cd server && npm run migrate && cd ..

# Запуск (frontend + backend)
npm run dev:full
```

### Доступ

| Сервис      | URL                        |
| ----------- | -------------------------- |
| Frontend    | http://localhost:5173      |
| Backend API | http://localhost:3001/api  |
| Production  | https://freshtrack.systems |

### Тестовые аккаунты

| Роль        | Логин        | Пароль           |
| ----------- | ------------ | ---------------- |
| SUPER_ADMIN | `superadmin` | `SuperAdmin123!` |
| HOTEL_ADMIN | `hoteladmin` | `HotelAdmin123!` |
| STAFF       | `honorbar`   | `Staff123!`      |

---

## 👥 Роли и права доступа

Система использует **Permission-Based Access Control** на уровне базы данных.

### Роли

| Роль               | Level | Scope      | Описание                     |
| ------------------ | ----- | ---------- | ---------------------------- |
| SUPER_ADMIN        | 100   | ALL        | Полный доступ ко всем отелям |
| HOTEL_ADMIN        | 80    | HOTEL      | Управление одним отелем      |
| DEPARTMENT_MANAGER | 50    | DEPARTMENT | Управление отделом           |
| STAFF              | 10    | DEPARTMENT | Базовые операции             |

### Permissions

```sql
-- Формат: resource:action:scope
inventory:read:department
products:create:hotel
users:manage:all
marsha_codes:assign:all
```

### Добавление новой роли

```sql
-- Только SQL — 0 изменений в коде!
INSERT INTO role_permissions (role, permission_id)
SELECT 'NIGHT_AUDITOR', p.id
FROM permissions p
WHERE p.resource = 'reports' AND p.action = 'read';
```

---

## 🏷️ MARSHA коды

Интеграция с системой идентификации отелей Marriott International.

### Архитектура идентификаторов

| Идентификатор     | Назначение           | Использование                   |
| ----------------- | -------------------- | ------------------------------- |
| `hotel_id` (UUID) | **ЕДИНСТВЕННЫЙ** FK  | FK, ACL, фильтрация, всё!       |
| `marsha_code`     | Внешний код Marriott | Только auth + отображение       |
| `external_ids`    | OPERA, SAP, PMS      | Интеграции с внешними системами |

### Защита MARSHA

```sql
-- ❌ Запрещено (триггер заблокирует!)
UPDATE hotels SET marsha_code = 'XXXXX';

-- ✅ Разрешено (авто-синхронизация)
UPDATE hotels SET marsha_code_id = 'uuid-from-marsha-codes-table';
```

### Permissions для MARSHA

| Permission              | Описание             |
| ----------------------- | -------------------- |
| `marsha_codes:view`     | Просмотр справочника |
| `marsha_codes:create`   | Создание кодов       |
| `marsha_codes:assign`   | Назначение отелю     |
| `marsha_codes:unassign` | Отвязка от отеля     |

> 📖 Подробнее: [docs/HOTEL_IDENTIFICATION.md](docs/HOTEL_IDENTIFICATION.md)

---

## 🤖 Telegram интеграция

### Возможности

- 📋 Ежедневные отчёты (настраиваемое время)
- 🏢 Привязка чатов к отделам
- 🔔 Real-time уведомления
- 📊 Статистика по статусам

### Настройка бота

1. Создайте бота через [@BotFather](https://t.me/botfather)
2. Получите токен
3. Добавьте в `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   ```

### Формат отчёта

```
🏨 FreshTrack - Отчёт о сроках годности

📅 Дата: 13.01.2026
🏢 Отдел: Mini Bar

📊 Статистика:
🔴 Просрочено: 3
🟠 Сегодня: 2
🟡 Критично (1-3 дня): 5
🔵 Внимание (4-7 дней): 8
🟢 В норме: 45

⚠️ Требуют внимания: 18 продуктов
```

---

## 🚦 Система статусов

Статусы вычисляются **только на backend** через `ExpiryService`. Цвета заданы семантическими CSS-переменными в `src/styles/index.css`:

| Статус      | Дней до истечения | Цвет (в UI) | CSS класс (проект)   |
| ----------- | ----------------- | ----------- | -------------------- |
| 🔴 expired  | < 0               | красный     | `bg-danger`          |
| 🟠 today    | = 0               | оранжевый   | `bg-critical`        |
| 🟠 critical | 1-3               | оранжевый   | `bg-critical`        |
| 🟡 warning  | 4-7               | жёлтый      | `bg-warning`         |
| 🟢 good     | > 7               | зелёный     | `bg-success`         |

Палитра: `--danger` (красный), `--critical` (оранжевый), `--warning` (жёлтый/золотой), `--success` (зелёный).

### Backend-driven подход

```javascript
// Backend возвращает готовые данные (ExpiryService)
{
  status: "critical",
  statusColor: "critical",
  statusText: "Критично: 3 дн.",
  statusCssClass: "bg-critical text-white"
}

// Frontend ТОЛЬКО отображает — никаких вычислений!
<Badge className={batch.statusCssClass}>
  {batch.statusText}
</Badge>
```

---

## 📁 Структура проекта

```
FreshTrack/
├── server/                      # Backend (Node.js + Express)
│   ├── modules/                 # Feature-based модули
│   │   ├── auth/               # Аутентификация + RBAC + MFA
│   │   ├── inventory/          # Продукты, партии
│   │   ├── hotels/             # Отели + MARSHA
│   │   ├── audit/              # Аудит + экспорт логов
│   │   ├── scheduled-exports/  # Запланированные экспорты (cron)
│   │   ├── export/             # Разовый экспорт
│   │   ├── events/             # SSE real-time
│   │   └── ...
│   ├── services/
│   │   ├── ExpiryService.js    # Single Source of Truth для статусов
│   │   ├── AuditService.js    # Audit logging с JSONB snapshots
│   │   ├── ExportService.js   # Excel/PDF/CSV с единым дизайном
│   │   ├── ScheduledExportService.js  # Cron + email/Telegram
│   │   └── ...
│   ├── db/migrations/          # SQL миграции (047–054 и др.)
│   └── tests/
│
├── src/                         # Frontend (React + Vite)
│   ├── context/                # Auth, Products, Notifications
│   ├── components/             # В т.ч. ScheduledExports, ExportButton
│   ├── hooks/                  # useExport, useOfflineMutation, useAuditSSE
│   ├── locales/                # 8 языков (i18next)
│   └── pages/
│
├── docs/                        # Документация (индекс: docs/README.md)
│   ├── README.md               # Индекс всех документов
│   ├── ARCHITECTURE.md         # Принципы, RBAC, scheduled exports, offline/SSE
│   ├── EXPORT_SYSTEM_IMPLEMENTATION.md
│   ├── RAILWAY_DEPLOY.md       # Деплой backend
│   └── ...
│
└── README.md
```

---

## 🔌 API Эндпоинты

### Аутентификация

| Метод | Эндпоинт                        | Описание                           |
| ----- | ------------------------------- | ---------------------------------- |
| POST  | `/api/auth/register`            | Регистрация нового пользователя    |
| POST  | `/api/auth/login`               | Вход в систему                     |
| GET   | `/api/auth/me`                  | Текущий пользователь + permissions |
| GET   | `/api/auth/validate-hotel-code` | Валидация MARSHA кода              |

### Продукты и партии

| Метод  | Эндпоинт            | Описание                           |
| ------ | ------------------- | ---------------------------------- |
| GET    | `/api/products`     | Список продуктов (hotel scoped)    |
| GET    | `/api/batches`      | Список партий (enriched статусами) |
| POST   | `/api/batches`      | Создать партию                     |
| PUT    | `/api/batches/:id`  | Обновить партию                    |
| DELETE | `/api/batches/:id`  | Удалить партию                     |
| POST   | `/api/fifo-collect` | FIFO сбор                          |

### Отчёты и экспорт

| Метод | Эндпоинт                       | Описание                    |
| ----- | ------------------------------ | --------------------------- |
| GET   | `/api/reports/statistics`      | Полная статистика           |
| GET   | `/api/reports/calendar`        | Календарь сроков            |
| GET   | `/api/export/inventory`        | Экспорт инвентаря (format=excel\|csv) |
| GET   | `/api/export/batches`          | Экспорт партий              |
| GET   | `/api/export/collections`      | Экспорт истории сборов      |
| GET   | `/api/audit-logs/export/excel` | Экспорт аудита (Excel/PDF)  |
| GET   | `/api/scheduled-exports`       | Список расписаний экспорта  |
| POST  | `/api/scheduled-exports`       | Создать расписание          |
| POST  | `/api/scheduled-exports/:id/test` | Тестовый запуск         |

### Аудит

| Метод | Эндпоинт                      | Описание             |
| ----- | ----------------------------- | -------------------- |
| GET   | `/api/audit-logs`             | Лента аудита (фильтры, пагинация) |
| GET   | `/api/audit-logs/export/excel` | Экспорт в Excel      |
| GET   | `/api/audit-logs/export/pdf`  | Экспорт в PDF        |
| GET   | `/api/events/stream`         | SSE (уведомления, события экспорта) |

### Настройки

| Метод | Эндпоинт                   | Описание               |
| ----- | -------------------------- | ---------------------- |
| GET   | `/api/settings`            | Настройки отеля/отдела |
| PUT   | `/api/settings`            | Обновить настройки     |
| GET   | `/api/settings/thresholds` | Пороги статусов        |

---

## 🧪 Тестирование

```bash
# Все тесты (304+)
npm run test

# Backend тесты
npm run test:server

# С coverage
npm run test:coverage

# Конкретный тест
npm run test -- --grep "ExpiryService"
```

### Покрытие тестами

| Сервис            | Тесты    | Описание               |
| ----------------- | -------- | ---------------------- |
| ExpiryService     | 45       | Статусы, цвета, пороги |
| AuditService      | 38       | CRUD аудит, snapshots  |
| CollectionService | 20       | FIFO логика            |
| StatisticsService | 19       | Агрегации              |
| SettingsService   | 39       | Настройки              |
| ExportService     | 42       | Excel/PDF              |
| FilterService     | 11       | Фильтрация             |
| **Total**         | **304+** |                        |

---

## 📝 Миграции базы данных

### Ключевые миграции

| #   | Файл                             | Описание                        |
| --- | -------------------------------- | ------------------------------- |
| 004 | `permissions_system.sql`         | RBAC на уровне БД               |
| 018 | `marsha_codes.sql`               | Справочник MARSHA               |
| 029 | `protect_marsha_code.sql`        | Триггер защиты MARSHA           |
| 047 | `email_otp_verification.sql`    | Email-верификация отделов       |
| 048–050 | audit metadata, severity, hotel coordinates | Аудит и геоданные   |
| 054 | `scheduled_exports.sql`         | Запланированные экспорты        |

Полный список и порядок применения: [docs/MIGRATION_SUMMARY.md](docs/MIGRATION_SUMMARY.md).

### Запуск миграций

```bash
cd server
npm run migrate
```

---

## 🌍 Локализация

8 языков с полной поддержкой:

| Язык     | Код | RTL |
| -------- | --- | --- |
| Русский  | ru  | ❌  |
| English  | en  | ❌  |
| Қазақша  | kk  | ❌  |
| Deutsch  | de  | ❌  |
| Français | fr  | ❌  |
| Español  | es  | ❌  |
| Italiano | it  | ❌  |
| العربية  | ar  | ✅  |

---

## 🚀 Деплой

### Production URLs

| Сервис      | URL                            |
| ----------- | ------------------------------ |
| Frontend    | https://freshtrack.systems     |
| Backend API | https://api.freshtrack.systems |

### Railway (Backend)

Подробно: [docs/RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) и [docs/RAILWAY_ENV_VARIABLES.md](docs/RAILWAY_ENV_VARIABLES.md).

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_here
NODE_ENV=production
APP_URL=https://freshtrack.systems
CORS_ORIGINS=https://freshtrack.systems
TELEGRAM_BOT_TOKEN=...
RESEND_API_KEY=...   # для email и запланированных экспортов
```

Подключите репозиторий к Railway для auto-deploy при пуше в `main`.

### Vercel (Frontend)

Подробно: [docs/VERCEL_QUICK_SETUP.md](docs/VERCEL_QUICK_SETUP.md).

```env
VITE_API_URL=https://api.freshtrack.systems/api
```

---

## 📚 Документация

Полный индекс: **[docs/README.md](docs/README.md)**.

| Документ | Описание |
| -------- | -------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура v3.1, RBAC, scheduled exports, offline/SSE |
| [ARCHITECTURE_MIGRATION.md](docs/ARCHITECTURE_MIGRATION.md) | Эволюция модулей, API endpoints |
| [EXPORT_SYSTEM_IMPLEMENTATION.md](docs/EXPORT_SYSTEM_IMPLEMENTATION.md) | Централизованный экспорт и запланированные отчёты |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Статус фич (scheduled exports и др.) |
| [MIGRATION_SUMMARY.md](docs/MIGRATION_SUMMARY.md) | Миграции БД 047–054, порядок, rollback |
| [RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) | Деплой backend, auto-deploy из GitHub |
| [HOTEL_IDENTIFICATION.md](docs/HOTEL_IDENTIFICATION.md) | hotel_id, marsha_code, external_ids |
| [MARSHA_CODES.md](docs/MARSHA_CODES.md) | Справочник Marriott кодов |
| [MOBILE_UX.md](docs/MOBILE_UX.md) | Мобильный UX |
| [QA_TESTING.md](docs/QA_TESTING.md) | Чеклисты тестирования, scheduled exports, Lighthouse |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Lighthouse, Axe, WCAG |

---

## 🔧 Переменные окружения

Полный список для backend: **server/.env.example**. Для production (Railway): [docs/RAILWAY_ENV_VARIABLES.md](docs/RAILWAY_ENV_VARIABLES.md).

### Backend (основное)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/freshtrack
JWT_SECRET=your_secret_key_min_32_chars
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Telegram (уведомления и запланированные экспорты)
TELEGRAM_BOT_TOKEN=your_bot_token

# Email (Resend или SMTP — для писем и вложений отчётов)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
```

### Frontend

```env
VITE_API_URL=http://localhost:3001/api
```

---

## 📜 Скрипты

### Frontend

```bash
npm run dev          # Запуск dev сервера
npm run build        # Production сборка
npm run preview      # Предпросмотр сборки
npm run lint         # ESLint
```

### Backend

```bash
cd server
npm run dev          # Запуск с nodemon
npm run migrate      # Миграции БД
npm run test         # Тесты
npm run test:watch   # Тесты в watch режиме
```

### Комбинированные

```bash
npm run dev:full     # Frontend + Backend одновременно
```

---

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing`)
5. Откройте Pull Request

---

## 📄 Лицензия

MIT License © 2024-2026 FreshTrack Team

---

<div align="center">

**Enterprise-ready система контроля сроков годности**

Разработано с ❤️ для индустрии гостеприимства by adekerz

[⬆ Вернуться к началу](#-freshtrack--система-контроля-сроков-годности)

</div>
