/**
 * Rate Limit Integration Tests
 *
 * Tests: exceed login limit → 429
 * Uses in-memory rate limiter (no Redis in test env)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-jwt'
// Tight rate limit for testing: 3 attempts per 60 seconds
process.env.RATE_LIMIT_LOGIN_POINTS = '3'
process.env.RATE_LIMIT_LOGIN_DURATION = '60'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  loginResult: vi.fn()
}))

vi.mock('../../db/postgres.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getClient: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn()
  }),
  testConnection: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../db/database.js', () => ({
  getUserById: vi.fn(),
  getUserByLogin: vi.fn(),
  getUserByLoginOrEmail: vi.fn(),
  getHotelById: vi.fn(),
  getDepartmentById: vi.fn(),
  logAudit: vi.fn(),
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getAllHotels: vi.fn().mockResolvedValue([]),
  initDatabase: vi.fn()
}))

vi.mock('../../utils/logger.js', () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(), logDebug: vi.fn(),
  requestLogger: (req, res, next) => next()
}))

vi.mock('../../services/EmailVerificationService.js', () => ({
  EmailVerificationService: {
    getVerificationStatus: vi.fn().mockResolvedValue({ verified: true }),
    sendVerificationEmail: vi.fn()
  }
}))

vi.mock('../../modules/auth/auth-cookies.js', () => ({
  setTokenCookie: vi.fn(),
  clearTokenCookie: vi.fn()
}))

vi.mock('../../modules/auth/auth.service.js', () => ({
  AuthService: {
    login: (...args) => mocks.loginResult(...args),
    getCurrentUser: vi.fn(),
    register: vi.fn(),
    changePassword: vi.fn()
  }
}))

// ─── App setup ───────────────────────────────────────────────────────────────

let app

beforeAll(async () => {
  // Login always returns 401 (wrong credentials)
  mocks.loginResult.mockResolvedValue({
    success: false, statusCode: 401, error: 'Invalid credentials'
  })

  const { rateLimitLogin } = await import('../../middleware/rateLimiter.js')
  const { default: authRouter } = await import('../../modules/auth/auth.controller.js')

  app = express()
  app.set('trust proxy', 1)
  app.use(cookieParser())
  app.use(express.json())
  app.use('/api/auth/login', rateLimitLogin)
  app.use('/api/auth', authRouter)

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    const statusCode = err.statusCode || err.status || 500
    res.status(statusCode).json({ error: err.message })
  })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Rate Limiting — Login endpoint', () => {
  it('should return 429 after exceeding login attempts', async () => {
    const loginPayload = { email: 'attacker@test.com', password: 'wrong' }

    // Make 3 requests (the limit)
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send(loginPayload)
    }

    // 4th request should be rate limited
    const res = await request(app).post('/api/auth/login').send(loginPayload)

    expect(res.status).toBe(429)
    // Error message could be 'TOO_MANY_REQUESTS' or similar
    expect(res.body.error).toBeDefined()
  })

  it('should include Retry-After header when rate limited', async () => {
    const loginPayload = { email: 'attacker2@test.com', password: 'wrong' }

    // Exhaust the limit
    for (let i = 0; i < 4; i++) {
      await request(app).post('/api/auth/login').send(loginPayload)
    }

    const res = await request(app).post('/api/auth/login').send(loginPayload)

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })
})
