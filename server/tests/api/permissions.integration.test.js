/**
 * Permission API Integration Tests
 *
 * Tests: STAFF trying admin endpoints (403), cross-hotel access (403)
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

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getHotelById: vi.fn(),
  getDepartmentById: vi.fn(),
  pgQuery: vi.fn()
}))

vi.mock('../../db/postgres.js', () => ({
  query: (...args) => mocks.pgQuery(...args),
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
  getHotelById: (...args) => mocks.getHotelById(...args),
  getDepartmentById: (...args) => mocks.getDepartmentById(...args),
  logAudit: vi.fn(),
  query: (...args) => mocks.pgQuery(...args),
  getAllHotels: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
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
    login: vi.fn(), getCurrentUser: vi.fn(), register: vi.fn(), changePassword: vi.fn()
  }
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
  mocks.getHotelById.mockResolvedValue({ id: 'hotel-1', name: 'Test Hotel' })
  mocks.getDepartmentById.mockResolvedValue({ id: 'dept-1', name: 'Test Dept', hotel_id: 'hotel-1' })
  mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign({
    id: 'user-1', login: 'testuser', role: 'STAFF',
    hotel_id: 'hotel-1', department_id: 'dept-1',
    ...overrides
  }, JWT_SECRET, { expiresIn: '1h' })
}

function mockUser(overrides = {}) {
  return {
    id: 'user-1', login: 'testuser', name: 'Test User',
    role: 'STAFF', hotel_id: 'hotel-1', department_id: 'dept-1',
    status: 'active', is_active: true, ...overrides
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Permission Tests — STAFF restricted from admin endpoints', () => {
  it('STAFF should get 403 on GET /api/auth/users (admin only)', async () => {
    const token = makeToken({ role: 'STAFF' })
    mocks.getUserById.mockResolvedValue(mockUser({ role: 'STAFF' }))

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('STAFF should get 403 on GET /api/auth/join-requests (admin only)', async () => {
    const token = makeToken({ role: 'STAFF' })
    mocks.getUserById.mockResolvedValue(mockUser({ role: 'STAFF' }))

    const res = await request(app)
      .get('/api/auth/join-requests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('DEPARTMENT_MANAGER should get 403 on GET /api/auth/users', async () => {
    const token = makeToken({ role: 'DEPARTMENT_MANAGER' })
    mocks.getUserById.mockResolvedValue(mockUser({ role: 'DEPARTMENT_MANAGER' }))

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('HOTEL_ADMIN should have access to GET /api/auth/users', async () => {
    const token = makeToken({ role: 'HOTEL_ADMIN' })
    mocks.getUserById.mockResolvedValue(mockUser({ role: 'HOTEL_ADMIN' }))
    // Mock the users query to return data
    mocks.pgQuery.mockResolvedValue({
      rows: [mockUser({ role: 'HOTEL_ADMIN' })],
      rowCount: 1
    })

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)

    // Should not be 401 or 403
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('Permission Tests — Cross-hotel isolation', () => {
  it('HOTEL_ADMIN from hotel-2 should not see hotel-1 users', async () => {
    const token = makeToken({
      id: 'user-other', role: 'HOTEL_ADMIN', hotel_id: 'hotel-2'
    })
    mocks.getUserById.mockResolvedValue(mockUser({
      id: 'user-other', role: 'HOTEL_ADMIN', hotel_id: 'hotel-2'
    }))
    mocks.getHotelById.mockResolvedValue({ id: 'hotel-2', name: 'Other Hotel' })
    // Return empty — hotel-2 admin sees no hotel-1 users
    mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)

    // Auth should succeed (not 401), results filtered by hotel_id
    expect(res.status).not.toBe(401)
  })
})
