# Secure Download Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace direct file attachments in scheduled exports (Email/Telegram) with secure download links that require PIN + role verification.

**Architecture:** New `export_files` table stores files as BYTEA with UUID tokens. New `/api/downloads` module handles metadata, PIN verification (bcrypt), and file streaming via short-lived JWT tickets. Frontend `DownloadPage` renders PIN entry form. ScheduledExportService saves files to DB instead of attaching, sends links in existing message templates.

**Tech Stack:** Express.js, Supabase/Postgres (BYTEA), bcrypt, jsonwebtoken, React, Tailwind CSS, i18next

**Spec:** `docs/superpowers/specs/2026-03-19-secure-download-links-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `server/db/migrations/078_export_files_table.sql` | Create export_files table + indexes |
| `server/db/migrations/079_scheduled_exports_pin_fields.sql` | Add download_pin, link_expiry_hours to scheduled_exports |
| `server/modules/downloads/downloads.controller.js` | 3 endpoints: meta, verify, file |
| `server/modules/downloads/downloads.schemas.js` | Zod schemas for verify request |
| `src/pages/DownloadPage.jsx` | PIN entry + download page |

### Modified Files
| File | Change |
|------|--------|
| `server/services/ScheduledExportService.js` | Save to DB, send links instead of attachments |
| `server/modules/scheduled-exports/scheduled-exports.controller.js` | Hash PIN on create/update |
| `server/modules/scheduled-exports/scheduled-exports.schemas.js` | Add pin + link_expiry_hours fields, remove personal |
| `server/modules/index.js` | Register downloads controller |
| `server/index.js` | Add cleanup cron job |
| `src/components/ScheduledExports/ScheduleCreateModal.jsx` | Add PIN/expiry fields, remove personal |
| `src/components/ScheduledExports/ScheduleEditModal.jsx` | Same as create |
| `src/App.jsx` (or router file) | Add /download/:token route |
| `src/locales/ru.json` | New keys |
| `src/locales/en.json` | New keys |
| `src/locales/kk.json` | New keys |
| `src/locales/ar.json` | New keys |
| `src/locales/de.json` | New keys |
| `src/locales/es.json` | New keys |
| `src/locales/fr.json` | New keys |
| `src/locales/it.json` | New keys |

---

## Task 1: Database Migrations

**Files:**
- Create: `server/db/migrations/078_export_files_table.sql`
- Create: `server/db/migrations/079_scheduled_exports_pin_fields.sql`

- [ ] **Step 1: Create export_files migration**

```sql
-- 078_export_files_table.sql
CREATE TABLE IF NOT EXISTS export_files (
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
  max_downloads INTEGER,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_export_files_token ON export_files (token);
CREATE INDEX idx_export_files_expires ON export_files (expires_at) WHERE NOT is_revoked;
CREATE INDEX idx_export_files_hotel ON export_files (hotel_id, department_id);
```

- [ ] **Step 2: Create scheduled_exports pin fields migration**

```sql
-- 079_scheduled_exports_pin_fields.sql
ALTER TABLE scheduled_exports
  ADD COLUMN IF NOT EXISTS download_pin TEXT,
  ADD COLUMN IF NOT EXISTS link_expiry_hours INTEGER NOT NULL DEFAULT 72;
```

- [ ] **Step 3: Run migrations**

Run: `node server/db/migrate.js`
Expected: Both migrations applied successfully.

- [ ] **Step 4: Commit**

```bash
git add server/db/migrations/078_export_files_table.sql server/db/migrations/079_scheduled_exports_pin_fields.sql
git commit -m "feat: add export_files table and pin fields migration"
```

---

## Task 2: Downloads API Module

**Files:**
- Create: `server/modules/downloads/downloads.schemas.js`
- Create: `server/modules/downloads/downloads.controller.js`
- Modify: `server/modules/index.js`

- [ ] **Step 1: Create downloads schemas**

File: `server/modules/downloads/downloads.schemas.js`

```javascript
import { z } from 'zod'

const VerifyDownloadSchema = z.object({
  pin: z.string().min(1, 'PIN is required'),
  login: z.string().optional()
})

function validate(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      })),
      data: null
    }
  }
  return { isValid: true, errors: [], data: result.data }
}

export { VerifyDownloadSchema, validate }
```

- [ ] **Step 2: Create downloads controller**

File: `server/modules/downloads/downloads.controller.js`

Key implementation details:
- `GET /:token` — query `export_files` JOIN `scheduled_exports` by token. Return `{ fileName, fileSize, contentType, expiresAt, isExpired, isRevoked }`. No auth required.
- `POST /:token/verify` — rate limit (5/15min per IP+token via in-memory Map). Validate body with VerifyDownloadSchema. Find export_file by token, check not expired/revoked/max_downloads. bcrypt.compare PIN against `scheduled_exports.download_pin`. Auth check: if `req.user` exists (cookie) — check role !== 'STAFF', check hotel_id match, check department_id match (or null). If no `req.user` — require `login` field, query users table, same checks. Issue JWT ticket: `{ token, userId }` with 60s expiry. Log audit.
- `GET /:token/file` — verify JWT ticket from `?ticket=` query param. Find file, increment download_count, stream file_data as response with correct Content-Type and Content-Disposition.
- Use `authMiddleware` optionally: try to extract user from cookie but don't 401 if missing. Implement as inline try/catch around JWT verify.
- Rate limiter: simple Map with `${ip}:${token}` keys, cleanup stale entries every 15 min.

- [ ] **Step 3: Register in modules/index.js**

Add import and export of `downloadsController` in `server/modules/index.js`.
Register route in `server/index.js`: `app.use('/api/downloads', downloadsController)`.

- [ ] **Step 4: Test manually**

Run: `node --check server/modules/downloads/downloads.controller.js && node --check server/modules/downloads/downloads.schemas.js`
Expected: No syntax errors.

- [ ] **Step 5: Commit**

```bash
git add server/modules/downloads/
git commit -m "feat: add downloads API module with PIN verification and file streaming"
```

---

## Task 3: Update Scheduled Exports Schema & Controller (PIN hashing)

**Files:**
- Modify: `server/modules/scheduled-exports/scheduled-exports.schemas.js`
- Modify: `server/modules/scheduled-exports/scheduled-exports.controller.js`

- [ ] **Step 1: Update schemas**

In `scheduled-exports.schemas.js`:
- Remove `'personal'` from RecipientTypeSchema (line 13): change to `z.enum(['department'])`
- Add to CreateScheduledExportSchema: `download_pin: z.string().min(4, 'PIN must be at least 4 characters')` (required)
- Add to CreateScheduledExportSchema: `link_expiry_hours: z.number().int().min(1).max(720).optional().default(72)`
- Add same fields to UpdateScheduledExportSchema (both optional)

- [ ] **Step 2: Update controller — hash PIN on create**

In `scheduled-exports.controller.js` POST handler (~line 183):
- Import bcrypt: `import bcrypt from 'bcrypt'`
- After validation, before INSERT: `const pinHash = await bcrypt.hash(data.download_pin, 10)`
- Add `download_pin` and `link_expiry_hours` to INSERT query columns/values
- Remove personal recipient_type validation branches

- [ ] **Step 3: Update controller — hash PIN on update**

In PUT handler (~line 308):
- If `data.download_pin` provided: hash it before UPDATE
- Add `download_pin` and `link_expiry_hours` to UPDATE query COALESCE

- [ ] **Step 4: Verify syntax**

Run: `node --check server/modules/scheduled-exports/scheduled-exports.schemas.js && node --check server/modules/scheduled-exports/scheduled-exports.controller.js`

- [ ] **Step 5: Commit**

```bash
git add server/modules/scheduled-exports/
git commit -m "feat: add PIN hashing and link_expiry_hours to scheduled exports"
```

---

## Task 4: Update ScheduledExportService (save to DB, send links)

**Files:**
- Modify: `server/services/ScheduledExportService.js`

- [ ] **Step 1: Add saveExportFile method**

New method `async saveExportFile(fileBuffer, { hotelId, departmentId, scheduledExportId, fileName, contentType, expiryHours })`:
- Check `fileBuffer.length > 20 * 1024 * 1024` → throw error
- INSERT into `export_files` with all fields, `expires_at = NOW() + interval '${expiryHours} hours'`
- Return `{ token, downloadUrl: \`${process.env.APP_URL}/download/${token}\` }`

- [ ] **Step 2: Modify executeScheduledExport — save files to DB instead of temp dir**

In `executeScheduledExport` (~line 213):
- After generating each file buffer (XLSX/CSV/JSON), call `saveExportFile()` instead of writing to temp dir
- Collect array of `{ fileName, fileSize, downloadUrl }` instead of file paths
- Remove temp directory creation (line 268-270) and cleanup (lines 381-386)
- Remove fs/os imports if no longer needed

- [ ] **Step 3: Replace sendEmailWithAttachments with sendEmailWithLinks**

Replace method at ~line 808. New signature: `async sendEmailWithLinks(to, downloadLinks, schedule, isTest)`:
- Keep existing HTML structure/template
- Replace attachments section with list of download links (file name + size + URL)
- Add note about PIN requirement
- Add link expiry info
- Call `sendEmail()` without attachments array

- [ ] **Step 4: Replace sendTelegramWithAttachments with sendTelegramWithLinks**

Replace method at ~line 830. New signature: `async sendTelegramWithLinks(chatId, downloadLinks, schedule, isTest)`:
- Keep existing message text structure
- Replace sendDocument calls with download links in message text
- Add PIN and expiry info line
- Single `sendMessage()` call instead of multiple sendDocument calls

- [ ] **Step 5: Update executeScheduledExport delivery section**

Replace email send call (~line 352-364) with `sendEmailWithLinks()`.
Replace telegram send call (~line 367-379) with `sendTelegramWithLinks()`.
Pass `downloadLinks` array instead of file exports.

- [ ] **Step 6: Verify syntax**

Run: `node --check server/services/ScheduledExportService.js`

- [ ] **Step 7: Commit**

```bash
git add server/services/ScheduledExportService.js
git commit -m "feat: save exports to DB and send download links instead of attachments"
```

---

## Task 5: Cleanup Cron Job

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add cron job for expired file cleanup**

In `server/index.js`, after existing service initializations:

```javascript
// Cleanup expired export files every hour
import cron from 'node-cron'

cron.schedule('0 * * * *', async () => {
  try {
    const result = await pool.query(
      'DELETE FROM export_files WHERE expires_at < NOW()'
    )
    if (result.rowCount > 0) {
      console.log(`[ExportCleanup] Deleted ${result.rowCount} expired export files`)
    }
  } catch (err) {
    console.error('[ExportCleanup] Error:', err.message)
  }
})
```

Note: Check if `node-cron` is already a dependency (used by ScheduledExportService). If not, use `setInterval` with 3600000ms.

- [ ] **Step 2: Register downloads controller route**

Add to server/index.js:
```javascript
import { downloadsController } from './modules/index.js'
app.use('/api/downloads', downloadsController)
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/index.js`

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add hourly cleanup cron for expired export files and register downloads route"
```

---

## Task 6: Frontend — DownloadPage

**Files:**
- Create: `src/pages/DownloadPage.jsx`
- Modify: App router file (to add route)

- [ ] **Step 1: Create DownloadPage component**

`src/pages/DownloadPage.jsx`:
- Uses `useParams()` to get token
- `useEffect` → `GET /api/downloads/${token}` to fetch metadata
- States: loading, expired/revoked, ready, verifying, downloading, error
- If expired → show message with icon, translated text
- If ready → show file info (name, size) + PIN input + optional login input
- Login input shown only if no auth cookie detected (check via `GET /api/auth/me` or existing auth context)
- On submit: `POST /api/downloads/${token}/verify` with `{ pin, login? }`
- On success: `window.location.href = /api/downloads/${token}/file?ticket=${ticket}`
- Handle 429 (too many attempts) and 403 (wrong PIN/role) errors
- Styling: Tailwind, consistent with existing FreshTrack pages (centered card layout)
- Use `useTranslation()` for all text

- [ ] **Step 2: Add route to router**

Find the router file (likely `src/App.jsx` or similar). Add:
```jsx
<Route path="/download/:token" element={<DownloadPage />} />
```
This route should be OUTSIDE the auth-protected layout (public route).

- [ ] **Step 3: Verify build**

Run: `npx vite build --mode development`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DownloadPage.jsx src/App.jsx
git commit -m "feat: add secure download page with PIN verification"
```

---

## Task 7: Update Create/Edit Modals

**Files:**
- Modify: `src/components/ScheduledExports/ScheduleCreateModal.jsx`
- Modify: `src/components/ScheduledExports/ScheduleEditModal.jsx`

- [ ] **Step 1: Update ScheduleCreateModal**

In `ScheduleCreateModal.jsx`:
- Add to formData initial state (~line 54): `download_pin: ''`, `link_expiry_hours: 72`
- Remove `recipient_type: 'department'` from state (hardcode 'department')
- Remove recipient_type toggle UI (~lines 420-453)
- Remove recipientPersonalHint (~lines 448-451)
- Add PIN field (text input, required, min 4 chars, with show/hide toggle) in delivery section
- Add link expiry field (number input, suffix "hours", default 72) next to PIN
- Update validation (~line 150): remove personal branch, add PIN length check
- Update form submission: include `download_pin` and `link_expiry_hours` in payload

- [ ] **Step 2: Update ScheduleEditModal**

Same changes as ScheduleCreateModal in `ScheduleEditModal.jsx`:
- Add `download_pin: ''`, `link_expiry_hours: schedule.link_expiry_hours || 72` to initial state
- Remove recipient_type toggle
- Add PIN field (placeholder, not pre-filled — "Leave empty to keep current")
- Add link expiry field
- On submit: only include `download_pin` if non-empty

- [ ] **Step 3: Verify build**

Run: `npx vite build --mode development`

- [ ] **Step 4: Commit**

```bash
git add src/components/ScheduledExports/ScheduleCreateModal.jsx src/components/ScheduledExports/ScheduleEditModal.jsx
git commit -m "feat: add PIN and link expiry fields to export schedule modals"
```

---

## Task 8: i18n — All Locales

**Files:**
- Modify: all 8 locale files in `src/locales/`

- [ ] **Step 1: Add keys to ru.json**

Add to `scheduledExports` section:
```json
"pinLabel": "PIN для скачивания",
"pinPlaceholder": "Минимум 4 символа",
"pinKeepCurrent": "Оставьте пустым, чтобы сохранить текущий",
"linkExpiryLabel": "Срок действия ссылки (часы)",
"linkExpiryHours": "ч"
```

Add new `download` section:
```json
"download": {
  "title": "Скачивание отчёта",
  "enterPin": "Введите PIN",
  "enterLogin": "Введите логин",
  "downloadBtn": "Скачать",
  "expired": "Ссылка истекла",
  "revoked": "Ссылка отозвана",
  "invalidPin": "Неверный PIN или недостаточно прав",
  "tooManyAttempts": "Слишком много попыток. Попробуйте позже.",
  "fileSize": "Размер",
  "expiresAt": "Действительна до",
  "downloading": "Скачивание...",
  "pinRequired": "Для скачивания требуется PIN"
}
```

Remove keys: `recipientPersonal`, `recipientPersonalHint`

- [ ] **Step 2: Add keys to en.json**

Same structure, English translations.

- [ ] **Step 3: Add keys to remaining locales (kk, ar, de, es, fr, it)**

Translate appropriately for each locale.

- [ ] **Step 4: Commit**

```bash
git add src/locales/
git commit -m "feat: add i18n keys for secure download links in all locales"
```

---

## Task 9: Integration Testing & Final Verification

- [ ] **Step 1: Verify all syntax**

```bash
node --check server/modules/downloads/downloads.controller.js
node --check server/modules/downloads/downloads.schemas.js
node --check server/modules/scheduled-exports/scheduled-exports.controller.js
node --check server/modules/scheduled-exports/scheduled-exports.schemas.js
node --check server/services/ScheduledExportService.js
node --check server/index.js
```

- [ ] **Step 2: Verify frontend build**

Run: `npx vite build --mode development`

- [ ] **Step 3: Run migrations**

Run: `node server/db/migrate.js`

- [ ] **Step 4: Manual test checklist**

1. Create scheduled export with PIN "1234" and 72h expiry
2. Trigger test run → check email/telegram contains links (no file attachments)
3. Open link → see file info and PIN form
4. Enter wrong PIN → error message
5. Enter correct PIN with STAFF role → rejected
6. Enter correct PIN with MANAGER role → file downloads
7. Wait for link to expire → show expired message
8. Check audit log for download entries

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for secure download links"
```
