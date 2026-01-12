/**
 * Server Test Setup
 * 
 * Глобальные настройки для серверных тестов
 */

import { beforeAll, afterAll, vi } from 'vitest'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-jwt'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

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
  requestLogger: (req, res, next) => next()
}))

beforeAll(() => {
  console.log('🧪 Starting server tests...')
})

afterAll(() => {
  console.log('✅ Server tests completed')
})
