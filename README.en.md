# 🍃 FreshTrack — Expiry Management System

<div align="center">

![FreshTrack](https://img.shields.io/badge/FreshTrack-v3.1.0-green?style=for-the-badge&logo=leaflet&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-304%2B_passing-success?style=flat-square)
![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript)

**Enterprise-grade expiry management for Marriott, Accor, Hilton and independent hotel chains**

**Читать по-русски:** [README.md](README.md)

🌐 [freshtrack.systems](https://freshtrack.systems) • 📚 [Documentation](docs/README.md) • 🤖 [Telegram Bot](#-telegram-integration)

*Updated: February 3, 2026*

</div>

---

## 🎯 About the Project

**FreshTrack** is a production-ready system for managing product expiry dates in hotels and HoReCa businesses. Enterprise architecture: full data isolation, database-level RBAC, audit of all operations, MARSHA (Marriott) integration, and OPERA/SAP readiness.

### Key Metrics

| Metric           | Value                                  |
| ---------------- | -------------------------------------- |
| **Tests**        | 304+ passing                           |
| **Architecture** | Backend as Single Source of Truth      |
| **Security**     | RBAC + Hotel Isolation + Audit Trail   |
| **Integrations** | MARSHA, Telegram, OPERA/SAP ready      |
| **Languages**    | RU, EN, KK, DE, FR, ES, IT, AR (RTL)   |

---

## ✨ Features

### 🏨 Multi-Hotel Architecture

- Full data isolation between hotels (`hotel_id` on all tables)
- SUPER_ADMIN manages all hotels
- HOTEL_ADMIN sees only their hotel

### 🔐 Enterprise Security

- **RBAC** at database level (no hardcoded roles!)
- **Permissions**: `resource:action:scope` (e.g. inventory:read:department)
- **Audit logging** of all operations with snapshots
- Adding a new role = **zero code changes**

### 🏷️ MARSHA Codes (Marriott)

- Integration with Marriott International hotel identification
- Directory of 237+ hotels worldwide
- Protection against direct editing (DB trigger)
- OPERA, SAP, PMS ready (`external_ids` table)

### 📊 Backend-Driven Statuses

- All calculations on the server (ExpiryService)
- Frontend only displays `statusColor`, `statusText`
- Single source of truth — no drift between components

### 🤖 Telegram Integration

- Daily reports at configurable time
- Chat binding to departments (including scheduled exports)
- Real-time notifications for critical events

### 📦 Product Management

- Catalog of 26 pre-configured minibar products
- FIFO collection with automatic removal of old batches
- Hierarchy: Hotels → Departments → Products → Batches

### 📈 Analytics and Reports

- Statistics by status (expired, critical, warning, good)
- **Centralized export:** 7 report types (inventory, batches, categories, departments, collections, audit, MARSHA) in Excel/PDF/CSV with unified design
- **Scheduled exports:** cron delivery of reports to email and Telegram (daily/weekly/monthly)
- Expiry calendar
- Change history with full audit

### 🌍 Internationalization

- 8 languages: RU, EN, KK, DE, FR, ES, IT, AR
- RTL support for Arabic
- Real-time language switching

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Request → requirePermission()      [Access Control]         │
│  2. Filter  → buildContextWhere()      [Data Isolation]          │
│  3. Logic   → ExpiryService            [Status/Colors]          │
│  4. Audit   → AuditService             [Snapshots]              │
│  5. Output  → Enriched data            [Ready to render]         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                      │
│  • hotel_id + department_id on all tables                       │
│  • permissions + role_permissions (RBAC)                        │
│  • external_ids (MARSHA, OPERA, SAP)                             │
│  • JSONB snapshots for audit                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Principles

| Principle                         | Implementation                                        |
| --------------------------------- | ----------------------------------------------------- |
| **Backend = Single Source of Truth** | Frontend does not compute statuses or check roles  |
| **No Hardcoded Roles**            | `requirePermission()` instead of `if (role === 'ADMIN')` |
| **Hotel Isolation**               | `buildContextWhere(req.user)` on every request        |
| **Immutable Audit**               | `snapshot_before` / `snapshot_after` JSONB            |

---

## 🛠️ Tech Stack

### Frontend

| Technology   | Version | Purpose      |
| ------------ | ------- | ------------ |
| React        | 18.2    | UI library   |
| Vite         | 5.x     | Build tool   |
| TailwindCSS  | 3.4     | Styling      |
| React Router | 6.x     | Routing      |
| i18next      | 23.x    | 8 languages  |
| Chart.js     | 4.x     | Charts       |

### Backend

| Technology | Version | Purpose          |
| ---------- | ------- | ---------------- |
| Node.js    | 20+     | Runtime          |
| Express    | 4.18    | Web framework    |
| PostgreSQL | 16      | Database         |
| Zod        | 3.x     | Validation       |
| JWT        | -       | Authentication   |
| SSE        | -       | Real-time events |

### Infrastructure

| Service  | Purpose          |
| -------- | ---------------- |
| Railway  | Backend hosting  |
| Vercel   | Frontend hosting |
| Docker   | Local PostgreSQL |

---

## 🚀 Quick Start

### Requirements

- Node.js 20+
- PostgreSQL 16+ (or Docker)
- npm 9+

### Installation

```bash
# Clone
git clone https://github.com/adekerz/FreshTrack.git
cd FreshTrack

# Install dependencies
npm install
cd server && npm install && cd ..

# Start PostgreSQL (Docker)
cd server && docker-compose up -d && cd ..

# Run migrations
cd server && npm run migrate && cd ..

# Start (frontend + backend)
npm run dev:full
```

### Access

| Service      | URL                        |
| ------------ | -------------------------- |
| Frontend     | http://localhost:5173      |
| Backend API  | http://localhost:3001/api |
| Production   | https://freshtrack.systems |

### Test Accounts

| Role         | Login        | Password           |
| ------------ | ------------ | ------------------ |
| SUPER_ADMIN  | `superadmin` | `SuperAdmin123!`   |
| HOTEL_ADMIN  | `hoteladmin` | `HotelAdmin123!`   |
| STAFF        | `honorbar`   | `Staff123!`        |

---

## 👥 Roles and Permissions

The system uses **Permission-Based Access Control** at the database level.

### Roles

| Role               | Level | Scope      | Description                    |
| ------------------ | ----- | ---------- | ------------------------------ |
| SUPER_ADMIN        | 100   | ALL        | Full access to all hotels      |
| HOTEL_ADMIN        | 80    | HOTEL      | Manages one hotel              |
| DEPARTMENT_MANAGER | 50    | DEPARTMENT | Manages a department           |
| STAFF              | 10    | DEPARTMENT | Basic operations               |

### Permissions

```sql
-- Format: resource:action:scope
inventory:read:department
products:create:hotel
users:manage:all
marsha_codes:assign:all
```

### Adding a New Role

```sql
-- SQL only — zero code changes!
INSERT INTO role_permissions (role, permission_id)
SELECT 'NIGHT_AUDITOR', p.id
FROM permissions p
WHERE p.resource = 'reports' AND p.action = 'read';
```

---

## 🏷️ MARSHA Codes

Integration with Marriott International hotel identification.

### Identifier Architecture

| Identifier     | Purpose            | Usage                              |
| -------------- | ------------------ | ---------------------------------- |
| `hotel_id` (UUID) | **ONLY** FK     | FK, ACL, filtering, everything      |
| `marsha_code`  | Marriott external code | Auth + display only           |
| `external_ids` | OPERA, SAP, PMS    | External system integrations       |

### MARSHA Protection

```sql
-- ❌ Forbidden (trigger will block!)
UPDATE hotels SET marsha_code = 'XXXXX';

-- ✅ Allowed (auto-sync)
UPDATE hotels SET marsha_code_id = 'uuid-from-marsha-codes-table';
```

### MARSHA Permissions

| Permission              | Description          |
| ----------------------- | -------------------- |
| `marsha_codes:view`     | View directory       |
| `marsha_codes:create`   | Create codes         |
| `marsha_codes:assign`   | Assign to hotel      |
| `marsha_codes:unassign` | Unassign from hotel  |

> 📖 More: [docs/HOTEL_IDENTIFICATION.md](docs/HOTEL_IDENTIFICATION.md)

---

## 🤖 Telegram Integration

### Capabilities

- 📋 Daily reports (configurable time)
- 🏢 Chat binding to departments
- 🔔 Real-time notifications
- 📊 Status statistics

### Bot Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get the token
3. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   ```

### Report Format

```
🏨 FreshTrack - Expiry Report

📅 Date: 01/13/2026
🏢 Department: Mini Bar

📊 Statistics:
🔴 Expired: 3
🟠 Today: 2
🟡 Critical (1-3 days): 5
🔵 Warning (4-7 days): 8
🟢 Good: 45

⚠️ Attention needed: 18 products
```

---

## 🚦 Status System

Statuses are computed **only on the backend** via `ExpiryService`. Colors are defined by semantic CSS variables in `src/styles/index.css`:

| Status    | Days until expiry | Color (in UI) | CSS class (project) |
| --------- | ----------------- | ------------- | -------------------- |
| 🔴 expired | < 0              | red           | `bg-danger`          |
| 🟠 today  | = 0               | orange        | `bg-critical`         |
| 🟠 critical | 1-3             | orange        | `bg-critical`         |
| 🟡 warning | 4-7              | yellow        | `bg-warning`          |
| 🟢 good   | > 7               | green         | `bg-success`         |

Palette: `--danger` (red), `--critical` (orange), `--warning` (yellow/gold), `--success` (green).

### Backend-Driven Approach

```javascript
// Backend returns ready-to-use data (ExpiryService)
{
  status: "critical",
  statusColor: "critical",
  statusText: "Critical: 3 days",
  statusCssClass: "bg-critical text-white"
}

// Frontend ONLY displays — no calculations!
<Badge className={batch.statusCssClass}>
  {batch.statusText}
</Badge>
```

---

## 📁 Project Structure

```
FreshTrack/
├── server/                      # Backend (Node.js + Express)
│   ├── modules/                 # Feature-based modules
│   │   ├── auth/               # Authentication + RBAC + MFA
│   │   ├── inventory/          # Products, batches
│   │   ├── hotels/             # Hotels + MARSHA
│   │   ├── audit/              # Audit + log export
│   │   ├── scheduled-exports/  # Scheduled exports (cron)
│   │   ├── export/             # One-off export
│   │   ├── events/             # SSE real-time
│   │   └── ...
│   ├── services/
│   │   ├── ExpiryService.js    # Single Source of Truth for statuses
│   │   ├── AuditService.js    # Audit logging with JSONB snapshots
│   │   ├── ExportService.js   # Excel/PDF/CSV unified design
│   │   ├── ScheduledExportService.js  # Cron + email/Telegram
│   │   └── ...
│   ├── db/migrations/          # SQL migrations (047–054 and more)
│   └── tests/
│
├── src/                         # Frontend (React + Vite)
│   ├── context/                # Auth, Products, Notifications
│   ├── components/             # Including ScheduledExports, ExportButton
│   ├── hooks/                  # useExport, useOfflineMutation, useAuditSSE
│   ├── locales/                # 8 languages (i18next)
│   └── pages/
│
├── docs/                        # Documentation (index: docs/README.md)
│   ├── README.md               # Index of all docs
│   ├── ARCHITECTURE.md         # Principles, RBAC, scheduled exports, offline/SSE
│   ├── EXPORT_SYSTEM_IMPLEMENTATION.md
│   ├── RAILWAY_DEPLOY.md       # Backend deploy
│   └── ...
│
└── README.md
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint                        | Description                        |
| ------ | ------------------------------- | ---------------------------------- |
| POST   | `/api/auth/register`            | Register new user                  |
| POST   | `/api/auth/login`               | Login                              |
| GET    | `/api/auth/me`                  | Current user + permissions        |
| GET    | `/api/auth/validate-hotel-code` | Validate MARSHA code              |

### Products and Batches

| Method  | Endpoint            | Description                           |
| ------- | ------------------- | ------------------------------------- |
| GET     | `/api/products`     | List products (hotel scoped)          |
| GET     | `/api/batches`      | List batches (enriched with statuses)|
| POST    | `/api/batches`      | Create batch                         |
| PUT     | `/api/batches/:id`  | Update batch                         |
| DELETE  | `/api/batches/:id`  | Delete batch                         |
| POST    | `/api/fifo-collect` | FIFO collection                      |

### Reports and Export

| Method | Endpoint                       | Description                    |
| ------ | ------------------------------ | ------------------------------ |
| GET    | `/api/reports/statistics`      | Full statistics                |
| GET    | `/api/reports/calendar`        | Expiry calendar                |
| GET    | `/api/export/inventory`        | Export inventory (format=excel\|csv) |
| GET    | `/api/export/batches`          | Export batches                 |
| GET    | `/api/export/collections`      | Export collection history      |
| GET    | `/api/audit-logs/export/excel` | Export audit (Excel/PDF)       |
| GET    | `/api/scheduled-exports`       | List scheduled exports         |
| POST   | `/api/scheduled-exports`       | Create schedule                |
| POST   | `/api/scheduled-exports/:id/test` | Test run                   |

### Audit

| Method | Endpoint                      | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/audit-logs`             | Audit feed (filters, pagination)     |
| GET    | `/api/audit-logs/export/excel`| Export to Excel                      |
| GET    | `/api/audit-logs/export/pdf`  | Export to PDF                        |
| GET    | `/api/events/stream`          | SSE (notifications, export events)   |

### Settings

| Method | Endpoint                   | Description                |
| ------ | -------------------------- | -------------------------- |
| GET    | `/api/settings`            | Hotel/department settings  |
| PUT    | `/api/settings`            | Update settings           |
| GET    | `/api/settings/thresholds` | Status thresholds         |

---

## 🧪 Testing

```bash
# All tests (304+)
npm run test

# Backend tests
npm run test:server

# With coverage
npm run test:coverage

# Specific test
npm run test -- --grep "ExpiryService"
```

### Test Coverage

| Service            | Tests   | Description               |
| ------------------ | ------- | ------------------------- |
| ExpiryService      | 45      | Statuses, colors, thresholds |
| AuditService       | 38      | CRUD audit, snapshots     |
| CollectionService  | 20      | FIFO logic                |
| StatisticsService  | 19      | Aggregations             |
| SettingsService    | 39      | Settings                  |
| ExportService      | 42      | Excel/PDF                 |
| FilterService      | 11      | Filtering                 |
| **Total**          | **304+**|                           |

---

## 📝 Database Migrations

### Key Migrations

| #   | File                             | Description                        |
| --- | -------------------------------- | ---------------------------------- |
| 004 | `permissions_system.sql`         | DB-level RBAC                      |
| 018 | `marsha_codes.sql`               | MARSHA directory                   |
| 029 | `protect_marsha_code.sql`        | MARSHA protection trigger          |
| 047 | `email_otp_verification.sql`     | Department email verification      |
| 048–050 | audit metadata, severity, hotel coordinates | Audit and geo data   |
| 054 | `scheduled_exports.sql`          | Scheduled exports                  |

Full list and order: [docs/MIGRATION_SUMMARY.md](docs/MIGRATION_SUMMARY.md).

### Running Migrations

```bash
cd server
npm run migrate
```

---

## 🌍 Localization

8 languages with full support:

| Language  | Code | RTL |
| --------- | ---- | --- |
| Russian   | ru   | ❌  |
| English   | en   | ❌  |
| Kazakh    | kk   | ❌  |
| German    | de   | ❌  |
| French    | fr   | ❌  |
| Spanish   | es   | ❌  |
| Italian   | it   | ❌  |
| Arabic    | ar   | ✅  |

---

## 🚀 Deployment

### Production URLs

| Service      | URL                            |
| ------------ | ------------------------------ |
| Frontend     | https://freshtrack.systems     |
| Backend API  | https://api.freshtrack.systems |

### Railway (Backend)

Details: [docs/RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) and [docs/RAILWAY_ENV_VARIABLES.md](docs/RAILWAY_ENV_VARIABLES.md).

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_here
NODE_ENV=production
APP_URL=https://freshtrack.systems
CORS_ORIGINS=https://freshtrack.systems
TELEGRAM_BOT_TOKEN=...
RESEND_API_KEY=...   # for email and scheduled exports
```

Connect the repo to Railway for auto-deploy on push to `main`.

### Vercel (Frontend)

Details: [docs/VERCEL_QUICK_SETUP.md](docs/VERCEL_QUICK_SETUP.md).

```env
VITE_API_URL=https://api.freshtrack.systems/api
```

---

## 📚 Documentation

Full index: **[docs/README.md](docs/README.md)**.

| Document | Description |
| -------- | ----------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | v3.1 architecture, RBAC, scheduled exports, offline/SSE |
| [ARCHITECTURE_MIGRATION.md](docs/ARCHITECTURE_MIGRATION.md) | Module evolution, API endpoints |
| [EXPORT_SYSTEM_IMPLEMENTATION.md](docs/EXPORT_SYSTEM_IMPLEMENTATION.md) | Centralized export and scheduled reports |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | Feature status (scheduled exports, etc.) |
| [MIGRATION_SUMMARY.md](docs/MIGRATION_SUMMARY.md) | DB migrations 047–054, order, rollback |
| [RAILWAY_DEPLOY.md](docs/RAILWAY_DEPLOY.md) | Backend deploy, auto-deploy from GitHub |
| [HOTEL_IDENTIFICATION.md](docs/HOTEL_IDENTIFICATION.md) | hotel_id, marsha_code, external_ids |
| [MARSHA_CODES.md](docs/MARSHA_CODES.md) | Marriott codes directory |
| [MOBILE_UX.md](docs/MOBILE_UX.md) | Mobile UX |
| [QA_TESTING.md](docs/QA_TESTING.md) | Testing checklists, scheduled exports, Lighthouse |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Lighthouse, Axe, WCAG |

---

## 🔧 Environment Variables

Full list for backend: **server/.env.example**. For production (Railway): [docs/RAILWAY_ENV_VARIABLES.md](docs/RAILWAY_ENV_VARIABLES.md).

### Backend (main)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/freshtrack
JWT_SECRET=your_secret_key_min_32_chars
PORT=3001
NODE_ENV=development
APP_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Telegram (notifications and scheduled exports)
TELEGRAM_BOT_TOKEN=your_bot_token

# Email (Resend or SMTP — for emails and report attachments)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
```

### Frontend

```env
VITE_API_URL=http://localhost:3001/api
```

---

## 📜 Scripts

### Frontend

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview build
npm run lint         # ESLint
```

### Backend

```bash
cd server
npm run dev          # Start with nodemon
npm run migrate      # DB migrations
npm run test         # Tests
npm run test:watch   # Tests in watch mode
```

### Combined

```bash
npm run dev:full     # Frontend + Backend at once
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License © 2024-2026 FreshTrack Team

---

<div align="center">

**Enterprise-ready expiry management system**

Built with ❤️ for the hospitality industry by adekerz

[⬆ Back to top](#-freshtrack--expiry-management-system)

</div>
