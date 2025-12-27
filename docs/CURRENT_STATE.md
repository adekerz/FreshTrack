# FreshTrack Current State Documentation

> **Document Version:** 6.4.0  
> **Last Updated:** December 25, 2025  
> **Phase:** Post-Refactoring (Phases 0-8 Complete + Verification) ✅  
> **Test Count:** 304 tests passing

## Overview

This document captures the architectural state of FreshTrack after completing the foundational refactoring phases (0-8) and full verification cycle. It serves as a reference point for understanding the data ownership model, permission system, and role scalability architecture.

---

## Architectural Philosophy

### Problem Statement
FreshTrack was a «frontend-heavy» application with duplicated business logic, missing data ownership model, and hardcoded role checks. This caused:
- Statistics showing «Other» category due to missing context resolution
- Calendar colors not matching Telegram/PDF reports
- HOTEL_ADMIN having SUPER_ADMIN-level access
- Data leaks between hotels

### Solution: Backend as Single Source of Truth

```
┌─────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────┤
│  1. Request → requirePermission() [Phase 1]                 │
│  2. Filter  → buildContextWhere() [Phase 2]                 │
│  3. Logic   → ExpiryService (status/colors) [Phase 3]       │
│  4. Audit   → AuditService (snapshots) [Phase 4]            │
│  5. Output  → Enriched data ready to render                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Frontend receives «enriched» data — no calculations, no business logic, just rendering.

### Before vs After

| Aspect | Before (❌) | After (✅) |
|--------|-------------|------------|
| **Role checks** | `if (role === 'ADMIN')` | `requirePermission('inventory', 'read')` |
| **Data filtering** | Manual WHERE clauses | `buildContextWhere()` auto-filter |
| **Status colors** | Frontend calculation | Backend `ExpiryService` |
| **Statistics** | Frontend aggregation | Backend `StatisticsService` |
| **Audit** | Optional logging | Mandatory snapshots (before/after) |
| **FIFO** | Frontend quantity tracking | Backend transaction with `FOR UPDATE` |

---

## Architecture Summary

### Data Ownership Hierarchy

```
Hotel (hotelId)
  └── Department (departmentId)
       └── User (userId)
            └── Resources (batches, products, etc.)
```

### Permission Model

```
Permission = Resource : Action : Scope
Example: inventory:read:department
```

**Scopes:**
- `OWN` - Only own records
- `DEPARTMENT` - Within own department
- `HOTEL` - Within own hotel (all departments)
- `ALL` - System-wide (SUPER_ADMIN only)

### Role Scalability Architecture

**Key Principle:** Adding new roles requires ONLY database seeding — zero code changes.

```sql
-- Adding a new role (e.g., NIGHT_AUDITOR) is trivial:
INSERT INTO role_permissions (role, permission_id)
SELECT 'NIGHT_AUDITOR', p.id
FROM permissions p
WHERE (p.resource = 'batches' AND p.action = 'read')
   OR (p.resource = 'reports' AND p.action = 'read');
```

**Architecture Components:**
| Component | Purpose |
|-----------|---------|
| `permissions` table | Atomic rights (resource:action:scope) |
| `role_permissions` table | Role → Permission mapping |
| `PermissionScope` enum | OWN, DEPARTMENT, HOTEL, ALL |
| `ROLES` object | Level hierarchy (100→10) |
| `requirePermission()` | Route protection (replaces `if role === 'ADMIN'`) |
| `checkScopeValidity()` | Context validation (hotel/department match) |

**No Hardcoded Role Checks:**
```javascript
// ❌ OLD (not scalable)
if (user.role === 'ADMIN') { ... }

// ✅ NEW (database-driven)
requirePermission('inventory', 'read')
```

---

## Database Schema

### Context Fields (Data Ownership)

| Table | hotel_id | department_id | Status |
|-------|----------|---------------|--------|
| users | ✅ FK indexed | ✅ FK indexed | Complete |
| products | ✅ FK indexed | ✅ FK indexed | Complete |
| batches | ✅ FK indexed | ✅ FK indexed | Complete |
| categories | ✅ FK indexed | ✅ FK indexed (nullable - global) | Complete |
| write_offs | ✅ FK indexed | ✅ FK indexed | Complete |
| notifications | ✅ FK indexed | ✅ FK indexed (nullable) | Complete |
| delivery_templates | ✅ FK indexed | ✅ FK indexed (nullable) | Complete |

### Indexes

```sql
-- Single-column indexes
idx_*_hotel ON table(hotel_id)
idx_*_department ON table(department_id)

-- Composite indexes (performance optimization)
idx_batches_hotel_department ON batches(hotel_id, department_id)
idx_products_hotel_department ON products(hotel_id, department_id)
idx_write_offs_hotel_department ON write_offs(hotel_id, department_id)
idx_users_hotel_department ON users(hotel_id, department_id)
```

---

## Role System

### Roles and Default Scopes

| Role | Level | Default Scope | Context |
|------|-------|---------------|---------|
| SUPER_ADMIN | 100 | ALL | No hotel_id required |
| HOTEL_ADMIN | 80 | HOTEL | hotel_id required |
| DEPARTMENT_MANAGER | 50 | DEPARTMENT | hotel_id + department_id required |
| STAFF | 10 | DEPARTMENT | hotel_id + department_id required |

**Seeded Permissions per Role (Migration 004):**
- **SUPER_ADMIN**: All `scope='all'` + all `scope='hotel'` permissions
- **HOTEL_ADMIN**: All `scope='hotel'` + all `scope='department'` permissions
- **DEPARTMENT_MANAGER**: All `scope='department'` permissions
- **STAFF**: Limited department permissions (read + create batches/write_offs + own profile)

**HOTEL_ADMIN Isolation (Security Guarantee):**
- HOTEL_ADMIN never receives `scope='all'` permissions
- Cannot access other hotels' data
- `checkScopeValidity()` validates context match server-side

### Permission Tables

```sql
-- permissions: Atomic rights (resource:action:scope)
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  UNIQUE(resource, action, scope)
);

-- role_permissions: Role → Permission mapping
CREATE TABLE role_permissions (
  role VARCHAR(50) NOT NULL,
  permission_id UUID REFERENCES permissions(id),
  UNIQUE(role, permission_id)
);
```

---

## Security Measures

### Authentication Flow

1. JWT token validation
2. User lookup from DB
3. **Blocked user check** (`is_active = false` → 401)
4. Attach user context to request
5. Load hotel/department isolation

### Authorization Layers

1. **authMiddleware** - JWT + active user check
2. **hotelIsolation** - Enforces hotel context
3. **departmentIsolation** - Enforces department context (for STAFF)
4. **requirePermission** - Checks resource:action:scope

### Key Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `buildContextWhere` | Auto-filter SQL by context | `database.js` |
| `canAccessResource` | Validate resource ownership | `database.js` |
| `canAccessHotel` | Check hotel access rights | `auth.js` |
| `canAccessDepartment` | Check department access | `auth.js` |
| `canManageUser` | Prevent cross-admin editing | `auth.js` |

---

## Known Edge Cases (Handled)

### 1. HOTEL_ADMIN Cannot Edit Other HOTEL_ADMIN
```javascript
// auth.js:219-224
if (req.user.role === 'HOTEL_ADMIN' && user.role === 'HOTEL_ADMIN' && user.id !== req.user.id) {
  return res.status(403).json({ error: 'Cannot manage other hotel admins' })
}
```

### 2. Global Categories (NULL context)
Categories with `hotel_id = NULL` are system-wide and accessible to all hotels.

### 3. User Without Department
HOTEL_ADMIN can have `department_id = NULL` (hotel-wide access).

### 4. Blocked User Prevention
Checked in `authMiddleware` before any protected route.

### 5. FIFO Batch Deletion (quantity=0)
When batch reaches `quantity=0`, it is physically deleted from DB for optimization. However, `CollectionHistory` preserves snapshot (product_name, category_name, expiry_date) ensuring historical statistics remain accurate.

### 6. Telegram Retry Logic
If Telegram API is unavailable, `NotificationService` makes 3 retry attempts with exponential backoff (2h, 4h, 8h), preventing loss of critical expiry warnings.

### 7. Settings Hierarchy Fallback
If hotel hasn't set `warningDays`, system automatically uses SYSTEM-level fallback (7 days), eliminating `undefined` in calculations.

```
Resolution Order: User → Department → Hotel → System
```

### 8. CollectionHistory Snapshots
Deleted batches don't cause «-» placeholders in reports:
```javascript
// CollectionHistory stores immutable snapshot
{
  productName: string,  // Preserved even if product deleted
  categoryName: string, // Preserved even if category deleted  
  expiryDate: Date,     // Original expiry for reports
  collectedAt: Date
}
```

---

## Migration History

| Migration | Description |
|-----------|-------------|
| 001_initial_schema.sql | Base tables with hotel_id |
| 002_relax_department_constraints.sql | Add department_id to products |
| 003_department_isolation.sql | Full department isolation + DEPARTMENT_MANAGER |
| 004_permissions_system.sql | permissions + role_permissions + seeding |
| 005_settings_and_audit_snapshots.sql | Hierarchical settings + audit snapshots |
| 006_batch_snapshot_write_offs.sql | batch_snapshot in write_offs |
| 007_notification_engine.sql | notification_rules, telegram_chats, retry support |
| 008_collection_history.sql | FIFO collection history with snapshots |
| 009_branding_settings.sql | Branding and locale settings seed |

---

## Test Coverage

| Test Suite | Tests | Status |
|------------|-------|--------|
| expiryService.test.js | 27 | ✅ Passing |
| permissions.test.js | 22 | ✅ Passing |
| contextQuery.test.js | 30 | ✅ Passing |
| auditService.test.js | 20 | ✅ Passing |
| notificationEngine.test.js | 27 | ✅ Passing |
| filterService.test.js | 58 | ✅ Passing |
| settingsService.test.js | 39 | ✅ Passing |
| collectionService.test.js | 20 | ✅ Passing |
| ExportService.test.js | 42 | ✅ Passing |
| statisticsService.test.js | 19 | ✅ Passing |
| **Total** | **304** | ✅ All Passing |

---

## Services Architecture

### ExpiryService (Single Source of Truth)
- `enrichBatchWithExpiryData()` - Centralized expiry calculations
- `calculateBatchStats()` - Dashboard statistics
- Uses SettingsService for thresholds

### StatisticsService (Phase 3: Centralized Statistics)
- Single Source of Truth for all statistics calculations
- Replaces frontend calculations with backend-driven aggregation
- `getStatistics()` - Full statistics with byStatus, byCategory, trends
- `getQuickStats()` - Dashboard widget summary

**StatisticsResponse Structure:**
```typescript
interface StatisticsResponse {
  byStatus: StatisticsByStatus[];     // Status breakdown with colors
  byCategory: StatisticsByCategory[]; // Category breakdown (no "Other")
  trends: TrendDataPoint[];           // Time series for charts
  total: {
    batches: number;
    products: number;
    categories: number;
    totalQuantity: number;
    healthScore: number;
  };
  filters: { hotelId, departmentId, dateRange };
}
```

**Key Features:**
- Context filtering via `buildContextWhere` (hotelId/departmentId)
- No "Other" category - direct `category_id` resolution from batches
- Colors provided by backend (`StatusColor`, `StatusCssClass`)
- Localized labels (ru, en, kk)
- Date range filtering for historical analysis

**API Endpoints:**
- `GET /api/reports/statistics` - Full statistics
- `GET /api/reports/statistics/quick` - Dashboard widget stats
- `GET /api/reports/calendar` - Calendar view with batch data

### AuditService (Phase 4: Centralized Audit)
- `log()` / `logFromRequest()` - Unified audit logging
- `createSnapshot()` - Entity snapshot helper
- `getEntityHistory()` - Entity change timeline
- `getUserActivity()` - User activity logs
- `getStats()` - Aggregated audit statistics
- `searchSnapshots()` - Search by snapshot content (GIN index)
- `cleanOldLogs()` - Maintenance cleanup

**Audit Features:**
- `snapshot_before` / `snapshot_after` JSONB columns
- Automatic `changes_diff` calculation via trigger
- GIN index for snapshot search
- Entity lifecycle tracking with snapshots

**API Endpoints (Phase 4):**
- `GET /api/audit` - General audit feed with filtering
- `GET /api/audit/export` - Export audit logs (CSV/XLSX/JSON)
- `GET /api/audit/entity/:type/:id` - Entity history timeline
- `GET /api/audit/actions` - Available action types
- `GET /api/audit/entity-types` - Available entity types

### SettingsService (Phase 7: Settings as Rules)
- Priority: User → Department → Hotel → System
- 5-minute cache TTL with Map-based caching
- `getSetting()` - Get with hierarchical resolution
- `setSetting()` - Write with scope validation
- `deleteSetting()` - Remove setting
- `getAllSettingsForScope()` - Batch retrieval
- `buildStructuredSettings()` - Grouped settings object
- `clearCache()` / `clearAllCache()` - Cache management

**Branding Settings (Phase 7.3):**
- `branding.primaryColor` - Primary UI color (#3B82F6)
- `branding.secondaryColor` - Secondary color (#10B981)
- `branding.accentColor` - Accent color (#F59E0B)
- `branding.logoUrl` - Logo URL (/assets/logo.svg)
- `branding.logoDark` - Dark theme logo (/assets/logo-dark.svg)
- `branding.faviconUrl` - Favicon URL (/favicon.ico)
- `branding.siteName` - Application name (FreshTrack)
- `branding.companyName` - Company name (FreshTrack Inc.)
- `branding.welcomeMessage` - Welcome text on login

**API Endpoints (Phase 7):**
- `GET /api/settings` - All settings (structured)
- `GET /api/settings/user` - User preferences
- `PUT /api/settings/hotel/:key` - Hotel setting
- `PUT /api/settings/department/:key` - Department setting
- `PUT /api/settings/user/:key` - User preference
- `PUT /api/settings/system/:key` - System default (SUPER_ADMIN)
- `GET /api/settings/keys` - Available keys list
- `POST /api/settings/cache/clear` - Clear cache

### PermissionService
- `getRolePermissions()` - Load permissions from DB
- `checkScopeValidity()` - Validate scope context
- Cache with 5-minute TTL

### NotificationService (Phase 5: Multi-Channel Queue)
- Multi-channel: APP, TELEGRAM, EMAIL (future)
- Queue with retry logic (3 attempts, exponential backoff)
- Priority levels: LOW, NORMAL, HIGH, URGENT
- `create()` - Queue notification
- `createExpiryNotifications()` - Bulk expiry alerts
- `startQueueProcessor()` - Background processing
- `getQueueStatus()` - Queue monitoring

### NotificationEngine (Phase 5: Centralized Notification System)
- `checkExpiringBatches()` - Hourly cron job for expiry monitoring
- `processQueue()` - 5-min queue processing with retry
- `isAlreadyNotified()` - 24h deduplication
- `sendWithRetry()` - Exponential backoff (2h, 4h, 8h)

### CollectionService (Phase 8: FIFO Collection)
- `previewCollection()` - Preview affected batches before collection
- `collect()` - Execute FIFO collection with transaction locking
- `getHistory()` - Retrieve collection history with filtering
- `getStats()` - Collection statistics and reports

**FIFO Algorithm:**
- Sorts batches by `expiry_date ASC` (oldest first)
- Uses `FOR UPDATE` row locking to prevent race conditions
- Creates snapshots (product_name, category_name, expiry_date) in collection_history
- Auto-deletes batches when quantity reaches 0

**Collection Reasons:**
- `consumption` - General consumption
- `minibar` - Minibar usage
- `sale` - Direct sale
- `damaged` - Damaged product
- `other` - Other reasons

**API Endpoints (Phase 8):**
- `GET /api/fifo-collect/preview` - Preview FIFO collection
- `POST /api/fifo-collect/collect` - Execute FIFO collection
- `GET /api/fifo-collect/history` - Collection history
- `GET /api/fifo-collect/history/export` - Export collection history (CSV/XLSX/JSON)
- `GET /api/fifo-collect/stats` - Collection statistics
- NotificationRules: Configurable per hotel/department
- Telegram group chat support via TelegramService

### TelegramService (Phase 5: Enhanced Telegram Integration)
- Bot auto-discovery when added to groups
- `/link hotel:CODE` command for chat linking
- `sendBatchNotification()` - Send to all linked chats
- Webhook + polling support
- Bot Token: Configured in service

### FilterService (Phase 6: Unified Data Filtering)
- Unified filtering with validation
- Operators: eq, ne, gt, gte, lt, lte, like, in, between
- `parseCommonFilters()` - Parse req.query to typed CommonFilters
- `normalizeToArray()` - Handle string/array params
- `buildContextualWhere()` - SQL WHERE with access control
- `filterByVirtualStatus()` - Post-query expiry status filter
- `filterBySearch()` - Text search across fields
- `createPaginatedResponse()` - Standardized pagination

**UnifiedFilterService (Phase 6):**
- Virtual status filtering (expired, critical, warning, good, fresh)
- Post-query filtering for computed fields
- Export support with increased limits (10,000)
- Integration with buildContextWhere

**Constants:**
- `PaginationDefaults`: DEFAULT_LIMIT=50, MAX_LIMIT=500, EXPORT_LIMIT=10000
- `ExpiryStatusFilter`: EXPIRED, CRITICAL, WARNING, GOOD, FRESH

### ExportService (Phase 4+6: Unified Export)
- Real Excel (XLSX) file generation using ExcelJS
- CSV export with UTF-8 BOM for Excel compatibility
- JSON export with metadata
- MIME type management
- Export action logging via AuditService

**Supported Formats:**
- `csv` - Comma-separated values with UTF-8 BOM
- `xlsx` - Native Excel workbook with styling
- `json` - Structured JSON with metadata

**Entity Columns:**
- `products` - Product export columns
- `batches` - Batch export with expiry status
- `writeOffs` - Write-off history
- `auditLogs` - Audit log export (Phase 4)
- `collectionHistory` - FIFO collection history (Phase 8)
- `users` - User export

**API Endpoints:**
- `GET /api/audit/export` - Export audit logs
- `GET /api/fifo-collect/history/export` - Export collection history

**Methods:**
- `toCSV()` - Convert to CSV string
- `toJSON()` - Convert to JSON with metadata
- `toXLSX()` - Generate Excel buffer
- `sendExport()` - Send export with proper headers
- `getMimeType()` - Get MIME type for format
- `getColumnsForEntity()` - Get column definitions
- `buildExportSummary()` - Build export summary

---

## Localization (Phase 7.4)

**Supported Languages:**
- Russian (`ru`) - Default
- English (`en`) - Fallback
- Kazakh (`kk`)

**Locale Settings Keys:**
- `locale.language` - UI language (ru, en, kk)
- `locale.dateFormat` - Date pattern (DD.MM.YYYY)
- `locale.timeFormat` - Time pattern (HH:mm)
- `locale.currency` - Currency code (KZT)
- `locale.timezone` - Timezone (Asia/Almaty)

**Frontend Files:**
- `src/locales/ru.json` - 1195 translation keys
- `src/locales/en.json` - 1195 translation keys
- `src/locales/kk.json` - 1200 translation keys

**Localized Services:**
- ExpiryService - Status texts (ru/en/kk with en fallback)
- ExportService - Date/number formatting
- SettingsService - Hierarchical locale resolution

---

## Commands Reference

```bash
# Database
npm run migrate           # Apply migrations
npm run migrate:status    # Show migration status
npm run migrate:rollback  # Rollback last migration
npm run backup            # Full backup
npm run backup:gzip       # Compressed backup

# Development
npm run dev               # Start with --watch
npm run start             # Production start
```

---

## Previous Issues (Resolved)

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Statistics showing "Other" | Missing category resolution | StatisticsService with direct `category_id` from batches |
| Calendar showing all data | No department filtering | `departmentIsolation` middleware |
| Colors mismatch calendar/stats | Frontend calculation drift | Backend provides `statusColor`, `cssClass` via ExpiryService |
| HOTEL_ADMIN = SUPER_ADMIN | No scope enforcement | Permission system with scopes |
| Missing data ownership | No hotelId/departmentId | Migration 001-003 |
| Hardcoded role checks | `if role === 'ADMIN'` | Database-driven `requirePermission()` |

---

## Verification Checklist (Session Dec 25, 2025)

### Phase 3 Fixes
- [x] Calendar endpoint: `GET /api/reports/calendar` with `category_color` in queries
- [x] Statistics endpoint: `GET /api/reports/statistics` + `/statistics/quick`
- [x] StatisticsService: Centralized aggregation (byStatus, byCategory, trends)
- [x] No "Other" category — direct category resolution from batches

### Security Architecture
- [x] `requirePermission(resource, action)` on all protected routes
- [x] `buildContextWhere()` enforces hotel/department isolation
- [x] `checkScopeValidity()` validates scope against user context
- [x] No cross-hotel access for HOTEL_ADMIN

### Role Scalability
- [x] `PermissionScope` enum: OWN, DEPARTMENT, HOTEL, ALL
- [x] `permissions` table with 60+ seeded permissions
- [x] `role_permissions` table with role→permission mapping
- [x] Adding new role = database seed only (zero code changes)
- [x] DEPARTMENT_MANAGER fully functional via seeds

---

## Backup Information

- **Script:** `server/db/backup.js`
- **Format:** pg_dump (custom/plain/schema-only/data-only)
- **Location:** Timestamped files in `backups/` directory

---

## Key Files Reference

### Services (server/services/)
| File | Purpose |
|------|---------|
| `ExpiryService.js` | Centralized expiry calculations, status colors |
| `StatisticsService.js` | Aggregated statistics (byStatus, byCategory, trends) |
| `SettingsService.js` | Hierarchical settings with caching |
| `PermissionService.js` | Permission checks with scope validation |
| `AuditService.js` | Immutable audit logging with snapshots |
| `CollectionService.js` | FIFO collection with transaction locking |
| `NotificationService.js` | Multi-channel notification queue |
| `FilterService.js` | Unified filtering and pagination |
| `ExportService.js` | CSV/XLSX/JSON export generation |

### Middleware (server/middleware/)
| File | Purpose |
|------|---------|
| `auth.js` | JWT validation, `requirePermission()`, scope checks |
| `hotelIsolation.js` | Hotel context enforcement |
| `departmentIsolation.js` | Department context enforcement |

### Migrations (server/db/migrations/)
| File | Purpose |
|------|---------|
| `004_permissions_system.sql` | Permission tables + 60+ seeded permissions |
| `005_settings_and_audit_snapshots.sql` | Hierarchical settings + audit |
| `008_collection_history.sql` | FIFO collection history |

---

## Refactoring Results Summary

### QA Checklist (All Verified ✅)

| Category | Check | Status |
|----------|-------|--------|
| **Security** | Blocked users rejected instantly | ✅ `is_active` check in authMiddleware |
| **Security** | HOTEL_ADMIN isolated from other hotels | ✅ `checkScopeValidity()` |
| **Security** | Permission checks database-driven | ✅ `requirePermission()` on all routes |
| **Data** | Statistics no "Other" category | ✅ Direct `category_id` resolution |
| **Data** | Calendar colors match Telegram/PDF | ✅ Backend `ExpiryService` colors |
| **Data** | CollectionHistory preserves snapshots | ✅ Immutable history records |
| **FIFO** | Batches consumed by expiry date ASC | ✅ `FOR UPDATE` transaction lock |
| **FIFO** | Deleted batches don't break reports | ✅ Snapshots in `collection_history` |
| **Notifications** | Telegram retry on failure | ✅ 3 attempts, exponential backoff |
| **Settings** | Hierarchical fallback works | ✅ User → Dept → Hotel → System |
| **Scalability** | Adding new role trivial | ✅ DB seed only, ~1 minute |

### Architectural Achievements

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND                                     │
│  • Renders enriched data                                       │
│  • No business logic                                           │
│  • No calculations                                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ JSON (ready to render)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Single Source of Truth)            │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: requirePermission()     → Access control             │
│  Phase 2: buildContextWhere()     → Data isolation             │
│  Phase 3: ExpiryService           → Status/colors calculation  │
│  Phase 4: AuditService            → Immutable audit trail      │
│  Phase 5: NotificationEngine      → Multi-channel alerts       │
│  Phase 6: FilterService           → Unified filtering          │
│  Phase 7: SettingsService         → Hierarchical config        │
│  Phase 8: CollectionService       → FIFO with snapshots        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Context-filtered queries
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                     │
│  • hotel_id + department_id on all tables                      │
│  • permissions + role_permissions tables                       │
│  • Composite indexes for performance                           │
│  • JSONB snapshots for audit                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Code Patterns

**1. Permission Middleware (replaces hardcoded checks):**
```javascript
// ❌ BEFORE: Not scalable, scattered role checks
if (user.role === 'ADMIN') { /* allow */ }

// ✅ AFTER: Database-driven, centralized
router.get('/batches', requirePermission('batches', 'read'), getBatches);
```

**2. Context Query (automatic data isolation):**
```javascript
// ❌ BEFORE: Manual WHERE, easy to forget
const batches = await db.query('SELECT * FROM batches WHERE hotel_id = $1', [hotelId]);

// ✅ AFTER: Automatic context filtering
const where = buildContextWhere(req.user);
const batches = await db.query(`SELECT * FROM batches WHERE ${where}`);
```

**3. Backend Status Calculation (eliminates frontend drift):**
```javascript
// ❌ BEFORE: Frontend calculates, can drift
const status = daysUntilExpiry < 3 ? 'critical' : 'ok';

// ✅ AFTER: Backend provides everything
const enriched = ExpiryService.enrichBatchWithExpiryData(batch, settings);
// Returns: { status, statusColor, cssClass, daysRemaining, statusText }
```

**4. Immutable Snapshots (history survives deletions):**
```javascript
// ❌ BEFORE: Deleted batch = broken report
// SELECT product_name FROM batches WHERE id = ... → NULL

// ✅ AFTER: Snapshot preserved
// collection_history.product_name = 'Milk' (even if product deleted)
```

---