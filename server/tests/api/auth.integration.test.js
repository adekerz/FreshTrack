/**
 * Auth API Integration Tests
 *
 * Tests: POST /api/auth/login, GET /api/auth/me
 * Uses supertest + vitest with mocked database layer.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-secret-key-for-jwt'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = JWT_SECRET
process.env.RATE_LIMIT_LOGIN_POINTS = '500'
process.env.RATE_LIMIT_LOGIN_DURATION = '60'

// ─── Hoisted mocks (survive vi.mock hoisting) ───────────────────────────────

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  logAudit: vi.fn(),
  loginResult: vi.fn(),
  getCurrentUser: vi.fn()
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
  getUserById: (...args) => mocks.getUserById(...args),
  getUserByLogin: vi.fn(),
  getUserByLoginOrEmail: vi.fn(),
  getHotelById: vi.fn().mockResolvedValue({ id: 'hotel-1', name: 'Test Hotel' }),
  getDepartmentById: vi.fn().mockResolvedValue({ id: 'dept-1', name: 'Test Dept' }),
  logAudit: (...args) => mocks.logAudit(...args),
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  getAllHotels: vi.fn().mockResolvedValue([]),
  initDatabase: vi.fn()
}))

vi.mock('../../modules/auth/auth.service.js', () => ({
  AuthService: {
    login: (...args) => mocks.loginResult(...args),
    getCurrentUser: (...args) => mocks.getCurrentUser(...args),
    register: vi.fn(),
    changePassword: vi.fn()
  }
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

// ─── App setup ───────────────────────────────────────────────────────────────

let app

beforeAll(async () => {
  const { default: authRouter } = await import('../../modules/auth/auth.controller.js')

  app = express()
  app.use(cookieParser())
  app.use(express.json())
  app.use('/api/auth', authRouter)

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    const statusCode = err.statusCode || err.status || 500
    res.status(statusCode).json({ error: err.message })
  })
})

beforeEach(() => {
  vi.clearAllMocks()

  // Default: auth middleware resolves user
  mocks.getUserById.mockResolvedValue({
    id: 'user-1',
    login: 'testuser',
    name: 'Test User',
    role: 'HOTEL_ADMIN',
    hotel_id: 'hotel-1',
    department_id: 'dept-1',
    status: 'active',
    is_active: true
  })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign({
    id: 'user-1', login: 'testuser', role: 'HOTEL_ADMIN',
    hotel_id: 'hotel-1', department_id: 'dept-1', ...overrides
  }, JWT_SECRET, { expiresIn: '1h' })
}

function makeExpiredToken() {
  return jwt.sign({
    id: 'user-1', login: 'testuser', role: 'HOTEL_ADMIN', hotel_id: 'hotel-1'
  }, JWT_SECRET, { expiresIn: '0s' })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('should return token on valid credentials', async () => {
    mocks.loginResult.mockResolvedValue({
      success: true,
      data: {
        token: 'mock-jwt-token',
        user: { id: 'user-1', name: 'Test User', role: 'HOTEL_ADMIN' }
      }
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBe('mock-jwt-token')
    expect(res.body.user).toBeDefined()
  })

  it('should return 401 on invalid credentials', async () => {
    mocks.loginResult.mockResolvedValue({
      success: false, statusCode: 401, error: 'Неверный логин или пароль'
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpass' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBeDefined()
  })

  it('should return 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '' })

    expect(res.status).toBe(400)
  })

  it('should return 400 on empty body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('should return user data with valid token', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      success: true,
      data: { id: 'user-1', name: 'Test User', role: 'HOTEL_ADMIN', hotel_id: 'hotel-1' }
    })

    const token = makeToken()
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('user-1')
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/authorization/i)
  })

  it('should return 401 with expired token', async () => {
    await new Promise(r => setTimeout(r, 50))
    const token = makeExpiredToken()

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
  })

  it('should return 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt')

    expect(res.status).toBe(401)
  })

  it('should return 401 if user not found in DB', async () => {
    mocks.getUserById.mockResolvedValue(null)
    const token = makeToken()

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
  })
})
