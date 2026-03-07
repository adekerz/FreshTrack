/**
 * Analytics Controller
 *
 * GET /api/analytics/timeseries?days=90
 *   Returns daily snapshots from analytics_snapshots table.
 *   If no snapshots exist yet — returns empty array (frontend shows notice).
 *
 * GET /api/analytics/summary?period=week|month|all
 *   Returns current live stats + delta vs previous period snapshot.
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import { query } from '../../db/postgres.js'
import { authMiddleware, hotelIsolation } from '../../middleware/auth.js'
import {
  validate,
  TimeseriesQuerySchema,
  SummaryQuerySchema,
} from './analytics.schemas.js'

const router = Router()

// ─── GET /api/analytics/timeseries ────────────────────────────────────────────
router.get('/timeseries', authMiddleware, hotelIsolation, async (req, res) => {
  const v = validate(TimeseriesQuerySchema, req.query)
  if (!v.isValid)
    return res.status(400).json({ success: false, errors: v.errors })

  const { days } = v.data
  const hotelId = req.hotelId

  try {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const result = await query(
      `SELECT
         snapshot_date   AS date,
         total_batches   AS total,
         good_count      AS good,
         warning_count   AS warning,
         critical_count  AS critical,
         expired_count   AS expired,
         health_score    AS health
       FROM analytics_snapshots
       WHERE hotel_id = $1
         AND snapshot_date >= $2
       ORDER BY snapshot_date ASC`,
      [hotelId, since.toISOString().split('T')[0]]
    )

    res.json({ success: true, data: result.rows })
  } catch (err) {
    logError('analytics/timeseries error', err)
    res.status(500).json({ success: false, error: 'Failed to load timeseries' })
  }
})

// ─── GET /api/analytics/summary ───────────────────────────────────────────────
router.get('/summary', authMiddleware, hotelIsolation, async (req, res) => {
  const v = validate(SummaryQuerySchema, req.query)
  if (!v.isValid)
    return res.status(400).json({ success: false, errors: v.errors })

  const { period } = v.data
  const hotelId = req.hotelId

  try {
    // ── Live current stats from batches table ──────────────────────────────
    const liveResult = await query(
      `SELECT
         COUNT(*)                                                          AS total,
         COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 7)           AS good,
         COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE + 3
                                             AND    CURRENT_DATE + 7)     AS warning,
         COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE
                                             AND    CURRENT_DATE + 2)     AS critical,
         COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE)               AS expired
       FROM batches
       WHERE hotel_id = $1
         AND status = 'active'`,
      [hotelId]
    )

    const live = liveResult.rows[0]
    const total = parseInt(live.total) || 0
    const good = parseInt(live.good) || 0
    const warning = parseInt(live.warning) || 0
    const critical = parseInt(live.critical) || 0
    const expired = parseInt(live.expired) || 0

    const healthScore =
      total > 0
        ? Math.round(
            ((good * 1.0 + warning * 0.5 + critical * 0.2) / total) * 100
          )
        : 0

    // ── Previous period snapshot for delta ────────────────────────────────
    let daysBack = period === 'week' ? 7 : period === 'month' ? 30 : null
    let delta = null

    if (daysBack !== null) {
      const prevDate = new Date()
      prevDate.setDate(prevDate.getDate() - daysBack)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      const prevResult = await query(
        `SELECT total_batches, good_count, warning_count, critical_count, expired_count, health_score
         FROM analytics_snapshots
         WHERE hotel_id = $1
           AND snapshot_date <= $2
         ORDER BY snapshot_date DESC
         LIMIT 1`,
        [hotelId, prevDateStr]
      )

      if (prevResult.rows.length > 0) {
        const prev = prevResult.rows[0]
        delta = {
          total: total - (parseInt(prev.total_batches) || 0),
          good: good - (parseInt(prev.good_count) || 0),
          warning: warning - (parseInt(prev.warning_count) || 0),
          critical: critical - (parseInt(prev.critical_count) || 0),
          expired: expired - (parseInt(prev.expired_count) || 0),
          health: healthScore - (parseInt(prev.health_score) || 0),
        }
      }
    }

    res.json({
      success: true,
      data: {
        total,
        good,
        warning,
        critical,
        expired,
        health_score: healthScore,
        delta,
      },
    })
  } catch (err) {
    logError('analytics/summary error', err)
    res.status(500).json({ success: false, error: 'Failed to load summary' })
  }
})

export default router
