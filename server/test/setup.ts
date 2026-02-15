/**
 * Server Test Setup
 * 
 * Глобальные настройки для серверных тестов
 */

import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-jwt'
// Use DATABASE_URL from CI environment OR fallback to local test DB
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://freshtrack:testpassword@localhost:5432/freshtrack_test'

// Mock database
vi.mock('../db/postgres.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn()
  })
}))

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
  requestLogger: (req: any, res: any, next: any) => next()
}))

beforeAll(() => {
  console.log('🧪 Starting server tests...')
})

afterAll(() => {
  console.log('✅ Server tests completed')
})
