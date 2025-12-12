# 🏨 FreshTrack - Ritz-Carlton Inventory Management

Элегантная система управления инвентарём для баров отеля Ritz-Carlton Astana.  
*Designed in "Quiet Luxury" style.*

![FreshTrack](https://img.shields.io/badge/version-2.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg)

## ✨ Особенности

- 📦 **Управление инвентарём** — отслеживание продуктов по отделам (Honor Bar, Mokki Bar, Ozen Bar)
- ⏰ **Контроль сроков годности** — автоматические уведомления о просроченных и истекающих продуктах
- 📱 **Telegram интеграция** — ежедневные уведомления в Telegram чат
- 🌐 **Мультиязычность** — поддержка Русского, English, Қазақша
- 🔐 **Авторизация** — JWT-based аутентификация
- 🎨 **Quiet Luxury дизайн** — минималистичный и элегантный интерфейс

## 🛠️ Технологии

### Frontend
- **React 18** + **Vite**
- **Tailwind CSS** (custom quiet luxury palette)
- **Lucide React** (icons)
- **React Router** v6

### Backend
- **Node.js** + **Express**
- **SQLite** (better-sqlite3)
- **JWT** (jsonwebtoken) — авторизация
- **bcryptjs** — хеширование паролей
- **node-telegram-bot-api** — Telegram интеграция
- **node-cron** — планировщик задач

## 🚀 Запуск проекта

### 1. Установка зависимостей

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### 2. Настройка окружения

Backend уже настроен с Telegram Bot в `server/.env`:

### 3. Запуск

**Вариант 1: Два терминала**

```bash
# Терминал 1 — Backend (port 3001)
cd server
npm start

# Терминал 2 — Frontend (port 5173)
npm run dev
```

**Вариант 2: Одновременный запуск**

```bash
# Backend в фоне + Frontend
cd server && npm start & cd .. && npm run dev
```

Откройте http://localhost:5173

## 📡 API Endpoints

### Products
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/products` | Все продукты |
| POST | `/api/products` | Добавить продукт |
| PUT | `/api/products/:id` | Обновить продукт |
| DELETE | `/api/products/:id` | Удалить продукт |
| GET | `/api/products/status/expired` | Просроченные |
| GET | `/api/products/status/expiring-today` | Истекают сегодня |
| GET | `/api/products/status/expiring-soon?days=3` | Истекают скоро |

### Auth
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/login` | Авторизация |
| POST | `/api/auth/register` | Регистрация |
| GET | `/api/auth/me` | Текущий пользователь |

### Notifications
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/notifications/test` | Тестовое уведомление |
| GET | `/api/notifications/send-daily` | Ежедневное уведомление |
| GET | `/api/notifications/summary` | Сводка |
| GET | `/api/notifications/status` | Статус планировщика |
| GET | `/api/notifications/logs` | История уведомлений |
| POST | `/api/notifications/send-custom` | Пользовательское сообщение |

## 👤 Демо-аккаунт

```
Email: admin@ritzcarlton.com
Password: admin123
```

## 🎨 Цветовая палитра

| Цвет | HEX | Использование |
|------|-----|---------------|
| Cream | `#FAF8F5` | Фон |
| Sand | `#F5F0E8` | Карточки |
| Charcoal | `#1A1A1A` | Текст |
| Warm Gray | `#6B6560` | Вторичный текст |
| Accent | `#FF8D6B` | Акценты |
| Success | `#4A7C59` | Успех/OK |
| Warning | `#D4A853` | Предупреждения |
| Danger | `#C4554D` | Ошибки/Просрочено |

## 📁 Структура проекта

```
freshtrack-project/
├── src/
│   ├── components/          # UI компоненты
│   │   ├── AddProductModal.jsx
│   │   ├── AlertCard.jsx
│   │   ├── DepartmentCard.jsx
│   │   ├── Header.jsx
│   │   ├── LanguageSwitcher.jsx  # NEW
│   │   ├── Layout.jsx
│   │   ├── ProductTable.jsx
│   │   ├── Sidebar.jsx
│   │   └── StatCard.jsx
│   ├── pages/               # Страницы
│   │   ├── DashboardPage.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── NotificationsPage.jsx
│   │   └── RegisterPage.jsx
│   ├── context/             # React Context
│   │   ├── AuthContext.jsx
│   │   ├── LanguageContext.jsx   # NEW
│   │   └── ProductContext.jsx
│   ├── services/            # API сервисы
│   │   └── api.js               # NEW
│   ├── locales/             # Переводы
│   │   ├── en.json              # NEW
│   │   ├── ru.json              # NEW
│   │   └── kk.json              # NEW
│   ├── utils/               # Утилиты
│   │   ├── classNames.js
│   │   └── dateUtils.js
│   ├── styles/
│   │   └── index.css
│   ├── App.jsx
│   └── main.jsx
├── server/                  # Backend
│   ├── db/
│   │   └── database.js      # SQLite
│   ├── routes/
│   │   ├── auth.js          # JWT авторизация
│   │   ├── notifications.js # Telegram API
│   │   └── products.js      # CRUD продуктов
│   ├── services/
│   │   ├── scheduler.js     # node-cron
│   │   └── telegram.js      # Bot API
│   ├── .env
│   ├── .gitignore
│   ├── index.js
│   └── package.json
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

## 🔔 Telegram уведомления

Бот автоматически отправляет ежедневные уведомления в **9:00 (Asia/Almaty)** со списком:
- ❌ **Просроченные продукты** — требуют немедленного внимания
- ⚠️ **Истекают сегодня** — критический статус
- ⏰ **Истекают в ближайшие 3 дня** — предупреждение

### Тестирование Telegram

1. Запустите backend: `cd server && npm start`
2. В Header есть кнопка 📱 **"Тест"** — нажмите для отправки тестового уведомления

## 🌐 Мультиязычность

Поддерживаемые языки:
- 🇷🇺 **Русский** (по умолчанию)
- 🇬🇧 **English**
- 🇰🇿 **Қазақша**

Переключатель языков находится в Header рядом с именем пользователя.

## 🏗️ Будущие улучшения

- [x] Backend API интеграция
- [x] Telegram уведомления
- [x] Мультиязычность (RU/EN/KK)
- [ ] Push-уведомления (Email)
- [ ] Barcode/QR сканирование
- [ ] Экспорт отчётов (PDF/Excel)
- [ ] Аналитика и графики
- [ ] Тёмная тема

## 📄 Лицензия

MIT License

---

*Разработано для Ritz-Carlton Astana* 🏨
