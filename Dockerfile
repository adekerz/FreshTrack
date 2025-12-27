# Railway Dockerfile for FreshTrack Server
FROM node:22-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./

# Install dependencies
RUN npm install --production

# Copy server source code
COPY server/ ./

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start server
CMD ["node", "index.js"]
