# FreshTrack Data Ownership Model

## Overview

FreshTrack implements a multi-tenant architecture with strict data isolation based on `hotelId` and `departmentId`. This ensures that users can only access data that belongs to their organization.

## Database Schema

### Core Tables with Ownership

| Table | hotel_id | department_id | Notes |
|-------|----------|---------------|-------|
| `hotels` | - | - | Top-level entity |
| `departments` | ✅ Required | - | Belongs to hotel |
| `users` | ✅ Optional* | ✅ Optional | SUPER_ADMIN has no hotel |
| `categories` | ✅ Required | - | Hotel-specific categories |
| `products` | ✅ Required | ✅ Optional | Can be department-specific |
| `batches` | ✅ Required | ✅ Required | Always has context |
| `write_offs` | ✅ Required | ✅ Optional | Nullable for flexibility |
| `notifications` | ✅ Required | ✅ Optional | Can be hotel-wide |
| `audit_logs` | ✅ Optional | - | SUPER_ADMIN actions |
| `settings` | ✅ Required | - | Hotel settings |

## Role-Based Access Control

### Roles Hierarchy

```
SUPER_ADMIN (системный администратор)
    └── Can access ALL hotels
    └── No hotel_id restriction
    └── Full system access

HOTEL_ADMIN (администратор отеля)
    └── Restricted to own hotel_id
    └── Can access ALL departments in hotel
    └── Can manage users, settings, categories

STAFF (сотрудник)
    └── Restricted to own hotel_id
    └── Restricted to own department_id
    └── Can only view/edit own department data
```

### Access Matrix

| Action | SUPER_ADMIN | HOTEL_ADMIN | STAFF |
|--------|-------------|-------------|-------|
| View all hotels | ✅ | ❌ | ❌ |
| View own hotel | ✅ | ✅ | ✅ |
| View all departments | ✅ | ✅ | ❌ |
| View own department | ✅ | ✅ | ✅ |
| Create batches | ✅ | ✅ | ✅ |
| Collect batches | ✅ | ✅ | ✅ |
| Manage users | ✅ | ✅ | ❌ |
| Manage categories | ✅ | ✅ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| System settings | ✅ | ❌ | ❌ |

## Implementation

### Middleware Stack

```javascript
// Authentication
authMiddleware → Verifies JWT, loads user

// Hotel Isolation
hotelIsolation → Sets req.hotelId based on role

// Department Isolation
departmentIsolation → Sets req.departmentId based on role

// Admin Checks
hotelAdminOnly → SUPER_ADMIN or HOTEL_ADMIN only
superAdminOnly → SUPER_ADMIN only
```

### Context-Aware Queries

Use `buildContextWhere` helper for automatic filtering:

```javascript
import { buildContextWhere } from '../db/database.js'

// In route handler
const context = {
  hotelId: req.hotelId,
  departmentId: req.departmentId,
  role: req.user.role
}

const { where, params } = buildContextWhere(context, 'b', 1)
const result = await query(`
  SELECT * FROM batches b
  WHERE ${where}
`, params)
```

### API Request Flow

```
1. Request → authMiddleware
   - Verify JWT token
   - Load user from DB
   - Attach user to req.user

2. Request → hotelIsolation
   - SUPER_ADMIN: hotelId from query/body or auto-select
   - Others: hotelId = user.hotel_id
   - Block cross-hotel access

3. Request → departmentIsolation (optional)
   - HOTEL_ADMIN+: departmentId from query/body
   - STAFF: departmentId = user.department_id
   - Block cross-department access

4. Request → Route Handler
   - Use req.hotelId for all queries
   - Use req.departmentId where applicable
   - Log actions with hotelId context
```

## Frontend Integration

### AuthContext

```javascript
const { user } = useAuth()
// user.hotel_id - user's hotel
// user.department_id - user's department
// user.role - SUPER_ADMIN | HOTEL_ADMIN | STAFF
```

### ProductContext

All API calls automatically include user's token which provides:
- Hotel isolation via middleware
- Department context for filtering
- Role-based data visibility

## Audit Trail

All actions are logged with ownership context:

```javascript
await logAudit({
  hotel_id: req.hotelId,      // Owner context
  user_id: req.user.id,       // Actor
  user_name: req.user.name,   // For display
  action: 'collect',          // What happened
  entity_type: 'batch',       // What entity
  entity_id: batchId,         // Which entity
  details: { ... },           // Extra context
  ip_address: req.ip          // Security
})
```

## Security Considerations

1. **Never trust client-side hotelId** - Always use req.hotelId from middleware
2. **Validate entity ownership** - Check entity.hotel_id === req.hotelId before operations
3. **Use parameterized queries** - Prevent SQL injection
4. **Log sensitive actions** - Audit trail for compliance
5. **JWT contains context** - Token includes hotel_id, department_id for quick checks

## Migration Guide

When adding new tables:

1. Add `hotel_id UUID NOT NULL REFERENCES hotels(id)`
2. Add `department_id UUID REFERENCES departments(id)` if applicable
3. Create indexes: `CREATE INDEX idx_tablename_hotel ON tablename(hotel_id)`
4. Update routes to use `hotelIsolation` middleware
5. Use `buildContextWhere` for queries
