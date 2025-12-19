# 🏨 FreshTrack Enterprise

**Enterprise Inventory & Expiration Date Management System**

Modern multi-property inventory management platform for hospitality, food service, and retail industries.  
*Designed with "Quiet Luxury" aesthetics for premium establishments.*

![FreshTrack](https://img.shields.io/badge/version-2.0.0_Enterprise-blue.svg)
![React](https://img.shields.io/badge/React-18.2.0-61dafb.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57.svg)
![License](https://img.shields.io/badge/license-Commercial-red.svg)

---

## ✨ Key Features

### Inventory Management
- 📦 **Multi-Department Tracking** — organize products by dynamically created departments
- ⏰ **Expiration Monitoring** — automatic alerts for expiring and expired products
- 📋 **Batch Management** — track individual batches with manufacturing and expiry dates
- 🔄 **Delivery Templates** — streamline recurring deliveries with reusable templates

### Enterprise Features
- 🏢 **Multi-Property Support** — manage multiple locations from a single dashboard
- 👥 **Role-Based Access Control (RBAC)** — granular permissions by role and department
- 📊 **Global Analytics** — cross-property reporting and insights
- 🏷️ **White-Label Ready** — customizable branding per organization
- 🔌 **REST API** — comprehensive API with webhook support

### Communication & Alerts
- 📱 **Telegram Integration** — daily notifications and on-demand reports
- 🔔 **Smart Notifications** — configurable alert rules and schedules
- 📧 **Email Support** — integration-ready notification system

### User Experience
- 🌐 **Multilingual** — Russian, English, Kazakh (easily extensible)
- 📱 **Progressive Web App (PWA)** — works offline, installable on mobile
- 🎨 **Quiet Luxury Design** — minimalist, elegant interface
- 📅 **Visual Calendar** — expiration date visualization

### Compliance & Audit
- 📝 **Audit Logs** — comprehensive action logging
- 📋 **Collection History** — track disposed/collected items
- 📊 **Export Reports** — Excel, PDF export capabilities

---

## 🛠️ Technology Stack

### Frontend
- **React 18** + **Vite** — fast, modern build tooling
- **Tailwind CSS** — utility-first CSS with custom theme
- **Lucide React** — premium icon set
- **React Router v6** — client-side routing
- **PWA** — Service Worker for offline capability

### Backend
- **Node.js** + **Express** — REST API server
- **SQLite** (better-sqlite3) — lightweight embedded database
- **JWT** — secure token-based authentication
- **bcryptjs** — password hashing
- **node-telegram-bot-api** — Telegram bot integration
- **node-cron** — task scheduling

### Database Schema
- `users` — user accounts with roles
- `departments` — dynamically created departments
- `categories` — product categories
- `products` — product catalog
- `batches` — inventory batches with expiry tracking
- `collections` — collection/disposal history
- `audit_logs` — comprehensive audit trail
- `notification_rules` — configurable notifications
- `delivery_templates` — reusable delivery templates
- `settings` — system configuration

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/your-org/freshtrack.git
cd freshtrack
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 3. Environment Setup

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

Required environment variables:
```env
# Server
PORT=3001
JWT_SECRET=your-secure-secret-key

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 4. Start Development

```bash
# Start both frontend and backend
npm run dev
```

Frontend: http://localhost:5173  
API: http://localhost:3001

### 5. Default Login

```
Login: admin
Password:
```

> ⚠️ **Important**: Change the default admin password immediately after first login!

---

## 📁 Project Structure

```
freshtrack/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── context/            # React contexts (Auth, Products, Language)
│   ├── locales/            # i18n translation files
│   ├── utils/              # Utility functions
│   └── styles/             # CSS styles
├── server/                 # Backend Express application
│   ├── routes/             # API route handlers
│   ├── db/                 # Database schema and queries
│   ├── services/           # Business logic (Telegram, Scheduler)
│   └── middleware/         # Express middleware (Auth, Permissions)
├── public/                 # Static assets
└── docs/                   # Documentation
```

---

## 🔐 API Authentication

All API endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":""}'

# Use token in subsequent requests
curl http://localhost:3001/api/batches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔒 Role-Based Access

| Role | Permissions |
|------|-------------|
| `super_admin` | Full system access, multi-property management |
| `admin` | Property-level admin, user management |
| `manager` | Department management, reports |
| `user` | View and manage assigned departments |

---

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` — User login
- `POST /api/auth/register` — User registration
- `GET /api/auth/me` — Current user info

### Batches
- `GET /api/batches` — List all batches
- `POST /api/batches` — Create batch
- `PATCH /api/batches/:id/collect` — Mark as collected
- `GET /api/batches/stats` — Batch statistics

### Departments
- `GET /api/department-settings` — List departments
- `POST /api/department-settings` — Create department

### Categories
- `GET /api/categories` — List categories
- `POST /api/categories` — Create category

### Settings
- `GET /api/settings` — Get system settings
- `PUT /api/settings` — Update settings

---

## 🌍 Localization

Add new languages by creating translation files in `src/locales/`:

```
src/locales/
├── en.json     # English
├── ru.json     # Russian
├── kk.json     # Kazakh
└── es.json     # Spanish (add new)
```

---

## 📦 Building for Production

```bash
# Build frontend
npm run build

# Build creates dist/ folder
# Serve with any static file server
```

---

## 🐳 Docker Deployment

```dockerfile
# Example Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:server"]
```

---

## 📄 License

Commercial License. Contact sales@freshtrack.io for licensing information.

---

## 🤝 Support

- 📧 Email: support@freshtrack.io
- 📖 Documentation: https://docs.freshtrack.io
- 🐛 Issues: https://github.com/your-org/freshtrack/issues

---

**Built with ❤️ for the hospitality industry**
