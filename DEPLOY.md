# FreshTrack — Deployment Guide

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                  │
│    │                                                      │
│    ├─→ https://freshtrack.systems  (Vercel — Frontend)   │
│    └─→ https://api.freshtrack.systems  (Railway — API)   │
└──────────────────────────────────────────────────────────┘
```

- **Frontend** — React SPA, builds to `dist/`, deploys to **Vercel**
- **Backend** — Express.js API, runs in **Docker on Railway**
- **Database** — PostgreSQL on **Railway** (managed addon) or **Supabase**

---

## 1. Local Development (Docker)

### Prerequisites
- Docker Desktop installed and running
- Node.js 20+ (for running `npm run dev:client`)

### Start

```bash
# 1. Copy env file
cp server/.env.example server/.env
# Edit server/.env — set JWT_SECRET, etc.

# 2. Start postgres + backend in Docker
docker compose up -d

# 3. Check backend is healthy
docker compose logs -f server

# 4. Start frontend on host (hot reload)
npm run dev:client
# → http://localhost:5173
```

### Backend is available at `http://localhost:3001`

### Useful commands

```bash
# Rebuild image after changing server code
docker compose up -d --build server

# Run migrations manually
docker compose exec server node db/migrate.js

# Open postgres shell
docker compose exec db psql -U freshtrack freshtrack

# Stop everything
docker compose down

# Stop + delete all data (fresh start)
docker compose down -v
```

---

## 2. Railway (Production Backend)

### One-time setup

#### 2.1 Create Railway project

1. Go to [railway.app](https://railway.app) → New Project
2. **Add PostgreSQL** addon → Railway creates the database automatically
3. Connect your **GitHub repo**

#### 2.2 Configure service

In Railway dashboard → your service → **Settings**:

| Setting | Value |
|---------|-------|
| **Build Command** | *(empty — Docker handles it)* |
| **Start Command** | *(empty — CMD in Dockerfile)* |
| **Root Directory** | *(empty — Dockerfile is at root)* |
| **Dockerfile Path** | `./Dockerfile` |
| **Healthcheck Path** | `/` |
| **Port** | `3001` |

#### 2.3 Set Environment Variables

In Railway → your service → **Variables**, add:

```
NODE_ENV=production
PORT=3001

# Database — copy from Railway postgres addon
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Security
JWT_SECRET=<generate: openssl rand -base64 64>
JWT_EXPIRES_IN=7d

# CORS — your Vercel frontend URL
CORS_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=<your resend key>
APP_URL=https://freshtrack.systems

# Puppeteer (already set in Dockerfile, but explicit is safer)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Optional
TELEGRAM_BOT_TOKEN=
SENTRY_DSN=
GEONAMES_USERNAME=
```

#### 2.4 Generate a secure JWT_SECRET

```bash
# Run locally:
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
# or:
openssl rand -base64 64
```

#### 2.5 Get your Railway domain

Railway → your service → **Settings → Networking** → Generate Domain

Example: `freshtrack-api.up.railway.app`

Or set a **Custom Domain**: `api.freshtrack.systems` → add CNAME in your DNS.

---

## 3. Vercel (Production Frontend)

#### 3.1 Connect repo

1. [vercel.com](https://vercel.com) → New Project → import GitHub repo
2. Framework preset: **Vite**

#### 3.2 Build settings

| Setting | Value |
|---------|-------|
| Build Command | `npm run build:client` |
| Output Directory | `dist` |
| Install Command | `npm install` |

#### 3.3 Environment Variables

In Vercel → Project → Settings → Environment Variables:

```
VITE_API_URL=https://api.freshtrack.systems/api
```

(Replace with your Railway domain if not using custom domain:
`VITE_API_URL=https://freshtrack-api.up.railway.app/api`)

---

## 4. First Deploy Checklist

```
□ Railway: PostgreSQL addon added
□ Railway: DATABASE_URL set (pointing to Railway postgres)
□ Railway: JWT_SECRET set (strong random value)
□ Railway: CORS_ORIGINS includes your Vercel domain
□ Railway: RESEND_API_KEY set
□ Railway: APP_URL set to frontend URL

□ Vercel: VITE_API_URL set to Railway API URL
□ DNS: api.freshtrack.systems → Railway domain (if custom domain)

□ Deploy backend → check logs, migrations should run automatically
□ Deploy frontend → open app, test login
```

---

## 5. Migrations

Migrations run **automatically on every deploy** via the `CMD` in Dockerfile:

```dockerfile
CMD ["sh", "-c", "node db/migrate.js && node index.js"]
```

To run manually on Railway:

```bash
# Railway CLI
railway run node db/migrate.js

# Or via Railway dashboard → your service → Shell tab
node db/migrate.js --status
node db/migrate.js
```

---

## 6. Build the Docker image locally (for testing)

```bash
# Build
docker build -t freshtrack-server .

# Run (point to your local postgres or Supabase)
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="test-secret" \
  -e CORS_ORIGINS="http://localhost:5173" \
  -e NODE_ENV=production \
  freshtrack-server
```

---

## 7. Troubleshooting

### PDF export fails

Check that `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` is set and Chromium is installed in the image. It should be — the Dockerfile installs it via `apt-get`.

Test in Railway shell:
```bash
which chromium   # should print /usr/bin/chromium
```

### Migrations fail on deploy

Check Railway logs. Common cause: `DATABASE_URL` not set or wrong value.

```bash
railway logs
```

### CORS errors in browser

`CORS_ORIGINS` must include the exact frontend origin (no trailing slash):
```
CORS_ORIGINS=https://freshtrack.systems,https://www.freshtrack.systems
```

### Cannot connect to database

Make sure `DATABASE_URL` uses internal Railway networking (`${{Postgres.DATABASE_URL}}`) not the public URL — it's faster and doesn't count against bandwidth.
