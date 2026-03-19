# Secure Download Links for Report Exports

**Date:** 2026-03-19
**Status:** Approved

## Problem

Report exports (scheduled) are sent as file attachments directly via Email and Telegram. Anyone with access to the chat/inbox can open files without role verification. No hotel/department isolation on delivered files.

## Solution

Replace file attachments with secure download links. Files stored in DB (BYTEA). Download requires PIN + role verification with hotel/department isolation.

## Requirements

- Files stored in `export_files` table as BYTEA (max 20MB)
- Download link: `APP_URL/download/{token}` (UUID token)
- PIN set per scheduled export by admin (static, bcrypt hashed)
- Link expiry configurable per schedule (default 72 hours)
- Auth: if user has active session (cookie) — verify role + hotel/dept from session. If no session — require login field, verify role + hotel/dept from DB
- Roles: all except STAFF can download
- Remove `recipient_type: 'personal'` option
- Keep existing email/Telegram templates — only add download links block, remove file attachments
- Audit log every download attempt
- Rate limit PIN verification: 5 attempts per 15 min per IP+token
- Cron cleanup of expired files every hour

---

## Database Schema

### New table: `export_files`

```sql
CREATE TABLE export_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  scheduled_export_id INTEGER REFERENCES scheduled_exports(id) ON DELETE SET NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  file_data BYTEA NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER,          -- NULL = unlimited
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_export_files_token ON export_files (token);
CREATE INDEX idx_export_files_expires ON export_files (expires_at) WHERE NOT is_revoked;
CREATE INDEX idx_export_files_hotel ON export_files (hotel_id, department_id);
```

### Alter table: `scheduled_exports`

```sql
ALTER TABLE scheduled_exports
  ADD COLUMN download_pin TEXT,           -- bcrypt hash
  ADD COLUMN link_expiry_hours INTEGER NOT NULL DEFAULT 72;
```

Remove support for `recipient_type = 'personal'` at application level.

---

## API Endpoints

### New module: `server/modules/downloads/`

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/downloads/:token` | GET | None | File metadata (name, size, expired status) |
| `/api/downloads/:token/verify` | POST | Optional cookie | Verify PIN + role. Body: `{ pin, login? }`. Returns `{ ticket }` (JWT, 60s) |
| `/api/downloads/:token/file` | GET | `?ticket=...` | Stream file. Validates ticket, increments download_count |

### Verify logic

1. Find `export_files` by token — check: exists, not revoked, not expired, download_count < max_downloads (if set)
2. Compare PIN via bcrypt against `scheduled_exports.download_pin`
3. **If cookie session exists:** extract role, hotel_id, department_id from JWT. Verify role != STAFF, hotel_id matches, department_id matches (or export has no department restriction)
4. **If no session:** require `login` in request body. Find user by login, verify same checks as above
5. Issue download ticket: JWT with `{ token, user_id }`, 60 second expiry
6. Log attempt to audit

### Rate limiting

- `/api/downloads/:token/verify`: 5 requests per 15 minutes per IP + token combination
- Return 429 with retry-after header on exceed

### File size limit

- Reject files > 20MB at save time in service layer

---

## ScheduledExportService Changes

### Current flow
```
generateFiles → sendEmail(attachments) + sendTelegram(sendDocument)
```

### New flow
```
generateFiles → saveToDb(BYTEA) → buildDownloadUrls → sendEmail(links) + sendTelegram(links)
```

### Key changes

1. **`saveExportFile(fileBuffer, metadata)`** — saves to `export_files`, returns `{ token, downloadUrl }`
2. **`sendEmailWithLinks(to, downloadLinks, schedule)`** — adapts existing email template, replaces attachments with download links block
3. **`sendTelegramWithLinks(chatId, downloadLinks, schedule)`** — adapts existing Telegram message, replaces sendDocument calls with links in message text
4. **PIN is NOT included in email/Telegram messages** — only the admin who created the schedule knows it
5. **Cleanup cron** — `DELETE FROM export_files WHERE expires_at < NOW()` every hour

---

## Frontend

### New page: `src/pages/DownloadPage.jsx`

Route: `/download/:token`

Flow:
1. `GET /api/downloads/:token` — fetch metadata
2. If expired/revoked → show "Link expired" message
3. If valid → show PIN input (+ login input if no cookie session)
4. `POST /api/downloads/:token/verify` → get ticket
5. Trigger browser download via `window.location = /api/downloads/:token/file?ticket=...`

### Modified: `ScheduleCreateModal.jsx`

- Remove `recipient_type: 'personal'` option
- Add required field: **PIN** (min 4 characters, text input with show/hide toggle)
- Add field: **Link expiry** (number input + hours/days selector, default 72 hours)

### Modified: `ScheduleEditModal.jsx`

Same changes as create modal. PIN field shows placeholder (can update but not view existing).

---

## i18n

New keys in all locales (en, ru, kk, ar, de, es, fr, it):

```
download.title
download.enterPin
download.enterLogin
download.download
download.expired
download.revoked
download.invalidPin
download.tooManyAttempts
download.fileSize
download.expiresAt
scheduledExports.pinLabel
scheduledExports.pinPlaceholder
scheduledExports.linkExpiryLabel
scheduledExports.linkExpiryHours
scheduledExports.linkExpiryDays
```

---

## Security Summary

- **Token:** UUID v4, not guessable
- **PIN:** bcrypt hashed in DB, never sent in messages
- **Ticket:** JWT 60s TTL, single-use pattern
- **Role check:** STAFF blocked, hotel/department isolation enforced
- **Rate limit:** 5 attempts / 15 min per IP+token on verify
- **File limit:** 20MB max
- **Revocation:** `is_revoked` flag for emergency invalidation
- **Expiry:** configurable per schedule, cron cleanup hourly
- **Audit:** every download attempt logged
