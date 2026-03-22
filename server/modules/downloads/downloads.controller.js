import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../../db/postgres.js'
import { logError, logInfo } from '../../utils/logger.js'
import { verifyToken } from '../../middleware/auth.js'
import { logAudit } from '../../db/database.js'
import { validate, VerifyDownloadSchema } from './downloads.schemas.js'

const router = express.Router()

const JWT_SECRET = process.env.JWT_SECRET

// Rate limiter
const rateLimitMap = new Map()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 min

// Cleanup stale entries every 15 min
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) rateLimitMap.delete(key)
  }
}, RATE_LIMIT_WINDOW)

function checkRateLimit(ip, token) {
  const key = `${ip}:${token}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, firstAttempt: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ── Bundle routes MUST be registered before /:token to avoid matching "bundle" as a token ──

// GET /bundle/:bundleToken — fetch bundle metadata (list of files, no file_data)
router.get('/bundle/:bundleToken', async (req, res) => {
  try {
    const { bundleToken } = req.params
    const result = await query(
      `SELECT ef.token, ef.file_name, ef.file_size, ef.content_type, ef.expires_at,
              ef.is_revoked, ef.download_count, ef.max_downloads
       FROM export_files ef
       WHERE ef.bundle_token = $1
       ORDER BY ef.created_at`,
      [bundleToken]
    )
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Bundle not found' })

    const first = result.rows[0]
    const isExpired = new Date(first.expires_at) < new Date()

    const files = result.rows.map((f) => ({
      token: f.token,
      fileName: f.file_name,
      fileSize: f.file_size,
      contentType: f.content_type,
      isRevoked: f.is_revoked,
    }))

    return res.json({
      success: true,
      data: {
        files,
        expiresAt: first.expires_at,
        isExpired: isExpired || first.is_revoked,
      },
    })
  } catch (error) {
    logError('Downloads', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// POST /bundle/:bundleToken/verify — verify PIN, return tickets for all files in bundle
router.post('/bundle/:bundleToken/verify', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'
    const { bundleToken } = req.params

    if (!checkRateLimit(ip, bundleToken)) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many attempts. Try again later.' })
    }

    const v = validate(VerifyDownloadSchema, req.body)
    if (!v.isValid)
      return res.status(400).json({ success: false, errors: v.errors })
    const { pin, login } = v.data

    // Find files + schedule via bundle
    const filesResult = await query(
      `SELECT ef.token, ef.file_name, ef.file_size, ef.hotel_id, ef.department_id,
              ef.is_revoked, ef.expires_at, ef.scheduled_export_id,
              se.download_pin
       FROM export_files ef
       JOIN scheduled_exports se ON se.id = ef.scheduled_export_id
       WHERE ef.bundle_token = $1
       ORDER BY ef.created_at`,
      [bundleToken]
    )
    if (!filesResult.rows.length)
      return res.status(404).json({ success: false, error: 'Bundle not found' })

    const first = filesResult.rows[0]

    // Check validity
    if (first.is_revoked)
      return res.status(410).json({ success: false, error: 'Link revoked' })
    if (new Date(first.expires_at) < new Date())
      return res.status(410).json({ success: false, error: 'Link expired' })

    // Verify PIN
    if (!first.download_pin)
      return res
        .status(500)
        .json({ success: false, error: 'PIN not configured' })
    const pinValid = await bcrypt.compare(pin, first.download_pin)
    if (!pinValid)
      return res.status(403).json({ success: false, error: 'Invalid PIN' })

    // Auth check (same logic as single file verify)
    let user = null
    try {
      if (req.cookies?.freshtrack_token) {
        const decoded = verifyToken(req.cookies.freshtrack_token)
        if (decoded) {
          const userResult = await query(
            'SELECT id, login, role, hotel_id, department_id FROM users WHERE id = $1 AND is_active = true',
            [decoded.id]
          )
          if (userResult.rows.length) user = userResult.rows[0]
        }
      }
    } catch (e) {
      /* ignore */
    }

    if (!user) {
      if (!login)
        return res.status(400).json({
          success: false,
          error: 'Login is required',
          errors: [
            {
              field: 'login',
              message: 'Login is required when not authenticated',
            },
          ],
        })
      const userResult = await query(
        'SELECT id, login, role, hotel_id, department_id FROM users WHERE (login = $1 OR email = $1) AND is_active = true',
        [login]
      )
      if (!userResult.rows.length)
        return res
          .status(403)
          .json({ success: false, error: 'Invalid credentials' })
      user = userResult.rows[0]
    }

    if (user.role === 'STAFF')
      return res
        .status(403)
        .json({ success: false, error: 'Insufficient permissions' })
    if (user.hotel_id !== first.hotel_id)
      return res.status(403).json({ success: false, error: 'Access denied' })
    if (
      first.department_id &&
      user.department_id &&
      user.role === 'DEPARTMENT_MANAGER'
    ) {
      if (user.department_id !== first.department_id)
        return res.status(403).json({ success: false, error: 'Access denied' })
    }

    // Issue tickets for all files
    const files = filesResult.rows
      .filter((f) => !f.is_revoked)
      .map((f) => ({
        token: f.token,
        fileName: f.file_name,
        fileSize: f.file_size,
        ticket: jwt.sign({ token: f.token, userId: user.id }, JWT_SECRET, {
          expiresIn: '5m',
        }),
      }))

    // Audit
    try {
      await logAudit({
        hotel_id: first.hotel_id,
        user_id: user.id,
        user_name: user.login,
        action: 'DOWNLOAD_BUNDLE_VERIFY',
        entity_type: 'export_bundle',
        entity_id: bundleToken,
        details: {
          file_count: files.length,
          method: req.cookies?.freshtrack_token ? 'cookie' : 'login',
        },
        ip_address: ip,
      })
    } catch (e) {
      /* ignore */
    }

    return res.json({ success: true, data: { files } })
  } catch (error) {
    logError('Downloads', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// GET /:token — fetch file metadata (no auth)
router.get('/:token', async (req, res) => {
  const { token } = req.params
  const result = await query(
    `SELECT ef.file_name, ef.file_size, ef.content_type, ef.expires_at,
            ef.is_revoked, ef.download_count, ef.max_downloads
     FROM export_files ef
     WHERE ef.token = $1`,
    [token]
  )
  if (!result.rows.length)
    return res.status(404).json({ success: false, error: 'Not found' })
  const file = result.rows[0]
  const isExpired = new Date(file.expires_at) < new Date()
  const isMaxed =
    file.max_downloads && file.download_count >= file.max_downloads
  return res.json({
    success: true,
    data: {
      fileName: file.file_name,
      fileSize: file.file_size,
      contentType: file.content_type,
      expiresAt: file.expires_at,
      isExpired: isExpired || file.is_revoked || isMaxed,
      isRevoked: file.is_revoked,
    },
  })
})

// POST /:token/verify — verify PIN and issue a short-lived download ticket
router.post('/:token/verify', async (req, res) => {
  try {
    const ip = req.ip || 'unknown'
    const { token } = req.params

    // Rate limit
    if (!checkRateLimit(ip, token)) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many attempts. Try again later.' })
    }

    // Validate body
    const v = validate(VerifyDownloadSchema, req.body)
    if (!v.isValid)
      return res.status(400).json({ success: false, errors: v.errors })
    const { pin, login } = v.data

    // Find file + schedule
    const fileResult = await query(
      `SELECT ef.*, se.download_pin, se.hotel_id as schedule_hotel_id, se.department_id as schedule_department_id
       FROM export_files ef
       JOIN scheduled_exports se ON se.id = ef.scheduled_export_id
       WHERE ef.token = $1`,
      [token]
    )
    if (!fileResult.rows.length)
      return res.status(404).json({ success: false, error: 'Not found' })

    const file = fileResult.rows[0]

    // Check validity
    if (file.is_revoked)
      return res.status(410).json({ success: false, error: 'Link revoked' })
    if (new Date(file.expires_at) < new Date())
      return res.status(410).json({ success: false, error: 'Link expired' })
    if (file.max_downloads && file.download_count >= file.max_downloads) {
      return res
        .status(410)
        .json({ success: false, error: 'Download limit reached' })
    }

    // Verify PIN
    if (!file.download_pin)
      return res
        .status(500)
        .json({ success: false, error: 'PIN not configured' })
    const pinValid = await bcrypt.compare(pin, file.download_pin)
    if (!pinValid)
      return res.status(403).json({ success: false, error: 'Invalid PIN' })

    // Try optional auth from cookie
    let user = null
    try {
      let cookieToken = null
      if (req.cookies?.freshtrack_token) {
        cookieToken = req.cookies.freshtrack_token
      }
      if (cookieToken) {
        const decoded = verifyToken(cookieToken)
        if (decoded) {
          const userResult = await query(
            'SELECT id, login, role, hotel_id, department_id FROM users WHERE id = $1 AND is_active = true',
            [decoded.id]
          )
          if (userResult.rows.length) user = userResult.rows[0]
        }
      }
    } catch (e) {
      /* ignore cookie auth failure */
    }

    // If no cookie auth, require login field
    if (!user) {
      if (!login)
        return res.status(400).json({
          success: false,
          error: 'Login is required',
          errors: [
            {
              field: 'login',
              message: 'Login is required when not authenticated',
            },
          ],
        })
      const userResult = await query(
        'SELECT id, login, role, hotel_id, department_id FROM users WHERE (login = $1 OR email = $1) AND is_active = true',
        [login]
      )
      if (!userResult.rows.length)
        return res
          .status(403)
          .json({ success: false, error: 'Invalid credentials' })
      user = userResult.rows[0]
    }

    // Role check: STAFF cannot download
    if (user.role === 'STAFF') {
      return res
        .status(403)
        .json({ success: false, error: 'Insufficient permissions' })
    }

    // Hotel isolation
    if (user.hotel_id !== file.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    // Department isolation (if file is department-scoped)
    if (
      file.department_id &&
      user.department_id &&
      user.role === 'DEPARTMENT_MANAGER'
    ) {
      if (user.department_id !== file.department_id) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }
    }

    // Issue ticket (60s JWT)
    const ticket = jwt.sign({ token, userId: user.id }, JWT_SECRET, {
      expiresIn: '60s',
    })

    // Audit log
    try {
      await logAudit({
        hotel_id: file.hotel_id,
        user_id: user.id,
        user_name: user.login,
        action: 'DOWNLOAD_VERIFY',
        entity_type: 'export_file',
        entity_id: file.id,
        details: {
          file_name: file.file_name,
          method: req.cookies?.freshtrack_token ? 'cookie' : 'login',
        },
        ip_address: ip,
      })
    } catch (e) {
      /* audit failure should not block download */
    }

    return res.json({ success: true, data: { ticket } })
  } catch (error) {
    logError('Downloads', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

// GET /:token/file — stream the file using a short-lived ticket
router.get('/:token/file', async (req, res) => {
  try {
    const { token } = req.params
    const { ticket } = req.query

    if (!ticket)
      return res.status(401).json({ success: false, error: 'Ticket required' })

    // Verify ticket
    let decoded
    try {
      decoded = jwt.verify(ticket, JWT_SECRET)
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid or expired ticket' })
    }

    if (decoded.token !== token)
      return res.status(403).json({ success: false, error: 'Token mismatch' })

    // Get file
    const result = await query(
      `SELECT file_data, file_name, content_type, file_size, is_revoked, expires_at, download_count, max_downloads
       FROM export_files WHERE token = $1`,
      [token]
    )
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'File not found' })

    const file = result.rows[0]
    if (file.is_revoked || new Date(file.expires_at) < new Date()) {
      return res
        .status(410)
        .json({ success: false, error: 'File no longer available' })
    }
    if (file.max_downloads && file.download_count >= file.max_downloads) {
      return res
        .status(410)
        .json({ success: false, error: 'Download limit reached' })
    }

    // Increment download count
    await query(
      'UPDATE export_files SET download_count = download_count + 1 WHERE token = $1',
      [token]
    )

    // Send file
    res.setHeader('Content-Type', file.content_type)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`
    )
    res.setHeader('Content-Length', file.file_size)
    return res.send(file.file_data)
  } catch (error) {
    logError('Downloads', error)
    return res.status(500).json({ success: false, error: 'Server error' })
  }
})

export { router as downloadsController }
