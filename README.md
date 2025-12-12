# 🏨 FreshTrack - Inventory Management System

Современная система управления инвентарём и контроля сроков годности для отелей и ресторанов.  
*Designed in "Quiet Luxury" style.*

![FreshTrack](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Возможности

- 📦 **Управление инвентарём** — отслеживание продуктов по отделам и категориям
- ⏰ **Контроль сроков годности** — автоматические уведомления о просроченных и истекающих продуктах
- 📱 **Telegram интеграция** — ежедневные уведомления в Telegram чат
- 🌐 **Мультиязычность** — Русский, English, Қазақша
- 🔐 **Авторизация** — JWT-based аутентификация с ролями (Admin/User)
- 📊 **Аналитика** — статистика по отделам, рейтинг эффективности
- 📅 **Календарь** — визуализация сроков годности
- 📋 **История сборов** — учёт собранных просроченных товаров
- 📝 **Журнал аудита** — логирование всех действий
- 📱 **PWA** — работает как мобильное приложение
- 🎨 **Quiet Luxury дизайн** — минималистичный элегантный интерфейс

## 🛠️ Технологии

### Frontend
- **React 18** + **Vite** — современный быстрый бандлер
- **Tailwind CSS** — utility-first CSS с кастомной палитрой
- **Lucide React** — иконки
- **React Router v6** — маршрутизация
- **PWA** — Service Worker для офлайн работы

### Backend
- **Node.js** + **Express** — REST API
- **SQLite** (better-sqlite3) — легковесная база данных
- **JWT** — авторизация
- **bcryptjs** — хеширование паролей
- **node-telegram-bot-api** — Telegram интеграция
- **node-cron** — планировщик задач

## 🚀 Быстрый старт

### Требования
- Node.js 18+
- npm или yarn

### 1. Клонирование репозитория

```bash
git clone https://github.com/adekerz/FreshTrack.git
cd FreshTrack
```

### 2. Установка зависимостей

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 3. Настройка окружения

Скопируйте пример конфигурации и настройте:

```bash
cd server
cp .env.example .env
```

Отредактируйте `server/.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# JWT Secret (измените на свой!)
JWT_SECRET=your_secure_secret_key_here

# Telegram Bot (получите токен у @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
TELEGRAM_POLLING=true

# Database
DATABASE_PATH=./db/freshtrack.db
```

### 4. Запуск

**Вариант 1: Два терминала**

```bash
# Терминал 1 — Backend (port 3001)
cd server
npm start

# Терминал 2 — Frontend (port 5173)
npm run dev
```

**Вариант 2: Параллельный запуск (Windows)**

```bash
start cmd /k "cd server && npm start" && npm run dev
```

Откройте http://localhost:5173

## 👤 Демо-аккаунт

```
Логин: admin
Пароль: AdminRC2025!
```

## 📡 API Endpoints

### Авторизация
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/register` | Регистрация |
| GET | `/api/auth/me` | Текущий пользователь |

### Продукты и партии
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/products` | Каталог продуктов |
| POST | `/api/products` | Добавить продукт |
| GET | `/api/batches` | Все партии |
| POST | `/api/batches` | Добавить партию |
| GET | `/api/batches/stats` | Статистика |
| GET | `/api/batches/department/:dept` | Партии отдела |

### Уведомления
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/notifications/test` | Тестовое уведомление |
| GET | `/api/notifications/send-daily` | Отправить ежедневный отчёт |
| GET | `/api/notifications/logs` | История уведомлений |

### Сборы
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/collections` | История сборов |
| POST | `/api/collections` | Зафиксировать сбор |

### Настройки
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/settings` | Все настройки |
| PUT | `/api/settings/:key` | Обновить настройку |
| GET | `/api/settings/telegram/status` | Статус Telegram бота |

## 📁 Структура проекта

```
FreshTrack/
├── src/                      # Frontend
│   ├── components/           # UI компоненты
│   │   ├── AddBatchModal.jsx
│   │   ├── BottomNavigation.jsx
│   │   ├── CollectModal.jsx
│   │   ├── DeliveryTemplateModal.jsx
│   │   ├── ExportButton.jsx
│   │   ├── GlobalSearch.jsx
│   │   ├── Header.jsx
│   │   ├── LanguageSwitcher.jsx
│   │   ├── Layout.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── Sidebar.jsx
│   ├── pages/                # Страницы
│   │   ├── DashboardPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── NotificationsPage.jsx
│   │   ├── CalendarPage.jsx
│   │   ├── AnalyticsPage.jsx
│   │   ├── DepartmentRankingPage.jsx
│   │   ├── CollectionHistoryPage.jsx
│   │   ├── AuditLogsPage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   ├── context/              # React Context
│   │   ├── AuthContext.jsx
│   │   ├── LanguageContext.jsx
│   │   └── ProductContext.jsx
│   ├── locales/              # Переводы
│   │   ├── ru.json
│   │   ├── en.json
│   │   └── kk.json
│   ├── services/
│   │   └── api.js
│   ├── utils/
│   │   ├── dateUtils.js
│   │   ├── exportUtils.js
│   │   └── browserAlerts.js
│   ├── styles/
│   │   └── index.css
│   ├── App.jsx
│   └── main.jsx
├── server/                   # Backend
│   ├── db/
│   │   └── database.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── batches.js
│   │   ├── collections.js
│   │   ├── notifications.js
│   │   ├── settings.js
│   │   └── audit-logs.js
│   ├── services/
│   │   ├── scheduler.js
│   │   └── telegram.js
│   ├── middleware/
│   │   └── auth.js
│   ├── .env.example
│   ├── index.js
│   └── package.json
├── public/
│   ├── manifest.json
│   └── sw.js
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🎨 Цветовая палитра (Quiet Luxury)

| Цвет | HEX | Использование |
|------|-----|---------------|
| Cream | `#FAF8F5` | Основной фон |
| Sand | `#F5F0E8` | Фон карточек |
| Charcoal | `#1A1A1A` | Основной текст |
| Warm Gray | `#6B6560` | Вторичный текст |
| Accent | `#FF8D6B` | Акценты, кнопки |
| Success | `#4A7C59` | Успех, в норме |
| Warning | `#D4A853` | Предупреждения |
| Danger | `#C4554D` | Ошибки, просрочено |

## 🔔 Telegram уведомления

Бот автоматически отправляет ежедневные уведомления в **09:00 (Asia/Almaty)**:

- ❌ **Просроченные** — требуют немедленного сбора
- ⚠️ **Критические (0-3 дня)** — срочное внимание
- ⏰ **Предупреждение (3-7 дней)** — запланировать проверку

### Настройка Telegram бота

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите токен бота
3. Добавьте бота в группу/канал
4. Получите Chat ID (можно через бота [@userinfobot](https://t.me/userinfobot))
5. Внесите данные в `server/.env`

## 🌐 Мультиязычность

| Язык | Код | Статус |
|------|-----|--------|
| 🇷🇺 Русский | `ru` | ✅ Полная поддержка |
| 🇬🇧 English | `en` | ✅ Полная поддержка |
| 🇰🇿 Қазақша | `kk` | ✅ Полная поддержка |

Переключатель языков в правом верхнем углу.

## 🔒 Безопасность

- ✅ JWT токены с истечением срока действия
- ✅ Хеширование паролей (bcrypt)
- ✅ Защищённые роуты (Admin/User роли)
- ✅ Валидация входных данных
- ✅ CORS настройки

## 📱 PWA

FreshTrack работает как Progressive Web App:

1. Откройте сайт в Chrome/Edge
2. Нажмите "Установить" в адресной строке
3. Приложение появится на рабочем столе

## 🤝 Contributing

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) файл.

## 👨‍💻 Автор

**adekerz**

- GitHub: [@adekerz](https://github.com/adekerz)

---

⭐ Если проект полезен, поставьте звезду!
