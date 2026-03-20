# FreshTrack Backend — Production Image
# Frontend deploys separately to Vercel
# This image is for Railway (or any Docker host)

FROM node:20-slim

# ── Chromium (Puppeteer PDF export) ──────────────────────────
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# ── App ───────────────────────────────────────────────────────
WORKDIR /app

# Install dependencies first (layer cache)
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./

# ── Runtime ───────────────────────────────────────────────────
EXPOSE 3001

# Run DB migrations then start server
CMD ["sh", "-c", "node db/migrate.js && node index.js"]
