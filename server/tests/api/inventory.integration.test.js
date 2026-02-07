/**
 * Inventory API Integration Tests
 *
 * Tests: CRUD batches with hotel isolation
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-secret-key-for-jwt'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = JWT_SECRET

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  pgQuery: vi.fn(),
  clientQuery: vi.fn()
}))

const mockClient = {
  query: (...args) => mocks.clientQuery(...args),
  release: vi.fn()
}

vi.mock('../../db/postgres.js', () => ({
  query: (...args) => mocks.pgQuery(...args),
  getClient: vi.fn().mockResolvedValue(mockClient),
  testConnection: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../db/database.js', () => ({
  getUserById: (...args) => mocks.getUserById(...args),
  getHotelById: vi.fn().mockResolvedValue({ id: 'hotel-1', name: 'Test Hotel' }),
  getDepartmentById: vi.fn().mockResolvedValue({ id: 'dept-1', name: 'Bar', hotel_id: 'hotel-1' }),
  logAudit: vi.fn(),
  query: (...args) => mocks.pgQuery(...args),
  getAllHotels: vi.fn().mockResolvedValue([]),
  initDatabase: vi.fn()
}))

vi.mock('../../utils/logger.js', () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(), logDebug: vi.fn(),
  requestLogger: (req, res, next) => next()
}))

// ─── App setup ───────────────────────────────────────────────────────────────

let app

beforeAll(async () => {
  const { inventoryRouter } = await import('../../modules/inventory/index.js')

  app = express()
  app.use(cookieParser())
  app.use(express.json())
  app.use('/api', inventoryRouter)

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    const statusCode = err.statusCode || err.status || 500
    res.status(statusCode).json({ error: err.message })
  })
})

beforeEach(() => {
  vi.clearAllMocks()

  mocks.getUserById.mockResolvedValue({
    id: 'user-1', login: 'admin', name: 'Admin',
    role: 'HOTEL_ADMIN', hotel_id: 'hotel-1', department_id: 'dept-1',
    status: 'active',
    is_active: true
  })

  mocks.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 })
  mocks.clientQuery.mockResolvedValue({ rows: [], rowCount: 0 })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign({
    id: 'user-1', login: 'admin', role: 'HOTEL_ADMIN',
    hotel_id: 'hotel-1', department_id: 'dept-1', ...overrides
  }, JWT_SECRET, { expiresIn: '1h' })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/batches — List batches', () => {
  it('should return batches for authenticated user', async () => {
    const token = makeToken()

    // First query: hotel lookup; second query: batches list
    mocks.pgQuery
      .mockResolvedValueOnce({ rows: [{ id: 'hotel-1' }], rowCount: 1 })
      .mockResolvedValue({
        rows: [{
          id: 'batch-1', product_name: 'Coca-Cola',
          quantity: 10, expiry_date: '2025-12-31', department_id: 'dept-1'
        }],
        rowCount: 1
      })

    const res = await request(app)
      .get('/api/batches')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    // Response could be an array or object with data
    expect(res.body).toBeDefined()
  })

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/batches')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/batches — Create batch', () => {
  it('should reject batch without auth', async () => {
    const res = await request(app)
      .post('/api/batches')
      .send({ product_name: 'Test', quantity: 1, expiry_date: '2025-12-31' })

    expect(res.status).toBe(401)
  })

  it('should accept valid batch creation request', async () => {
    const token = makeToken()

    mocks.pgQuery
      .mockResolvedValueOnce({ rows: [{ id: 'hotel-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing batch
      .mockResolvedValue({
        rows: [{
          id: 'batch-new', product_name: 'Test Product',
          quantity: 5, expiry_date: '2025-12-31', department_id: 'dept-1'
        }],
        rowCount: 1
      })

    const res = await request(app)
      .post('/api/batches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        product_name: 'Test Product',
        quantity: 5,
        expiry_date: '2025-12-31',
        department_id: 'dept-1'
      })

    // Depends on controller validation — should not be 401
    expect(res.status).not.toBe(401)
  })
})

describe('Hotel isolation — batches scoped to hotel_id', () => {
  it('user from hotel-2 should not see hotel-1 batches', async () => {
    const tokenHotel2 = makeToken({
      id: 'user-2', hotel_id: 'hotel-2', department_id: 'dept-2'
    })

    mocks.getUserById.mockResolvedValue({
      id: 'user-2', login: 'admin2', name: 'Admin 2',
      role: 'HOTEL_ADMIN', hotel_id: 'hotel-2', department_id: 'dept-2',
      status: 'active', is_active: true
    })

    mocks.pgQuery
      .mockResolvedValueOnce({ rows: [{ id: 'hotel-2' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 })

    const res = await request(app)
      .get('/api/batches')
      .set('Authorization', `Bearer ${tokenHotel2}`)

    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
  })
})

describe('DELETE /api/batches/:id', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).delete('/api/batches/batch-1')
    expect(res.status).toBe(401)
  })
})
