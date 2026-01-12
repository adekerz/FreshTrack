/**
 * MARSHA Codes Controller
 * Marriott MARSHA code management
 * 
 * @module modules/marsha-codes
 */

import express from 'express'
import { authMiddleware, requirePermission, PermissionResource, PermissionAction } from '../../middleware/auth.js'
import MarshaCodeService from '../../services/MarshaCodeService.js'
import { logError } from '../../utils/logger.js'

const router = express.Router()

// Apply auth to all routes
router.use(authMiddleware)

/**
 * GET /api/marsha-codes/search
 * Search MARSHA codes by hotel name (fuzzy matching)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10, includeAssigned = false } = req.query

    console.log('[MARSHA Search] Query:', q, 'Limit:', limit)

    if (!q || q.length < 2) {
      console.log('[MARSHA Search] Query too short, returning empty results')
      return res.json({ success: true, results: [] })
    }

    const results = await MarshaCodeService.searchByName(q, {
      limit: parseInt(limit),
      includeAssigned: includeAssigned === 'true'
    })

    console.log('[MARSHA Search] Found', results.length, 'results')
    res.json({ success: true, results })
  } catch (error) {
    console.error('[MARSHA Search] Error:', error.message)
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to search MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/suggest
 * Auto-suggest MARSHA code based on hotel name
 */
router.get('/suggest', async (req, res) => {
  try {
    const { hotelName } = req.query

    if (!hotelName || hotelName.length < 3) {
      return res.json({ success: true, suggestions: [] })
    }

    const suggestions = await MarshaCodeService.suggestForHotelName(hotelName)

    res.json({ success: true, suggestions })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to suggest MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/available
 * Get all available (unassigned) MARSHA codes
 */
router.get('/available', async (req, res) => {
  try {
    const { country, region, brand, limit = 100, offset = 0 } = req.query

    const codes = await MarshaCodeService.getAvailableCodes({
      country,
      region,
      brand,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json({ success: true, codes })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/stats
 * Get MARSHA code statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await MarshaCodeService.getStats()
    res.json({ success: true, stats })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MARSHA statistics'
    })
  }
})

/**
 * GET /api/marsha-codes/filters
 * Get available filter options (countries, regions, brands)
 */
router.get('/filters', async (req, res) => {
  try {
    const [countries, regions, brands] = await Promise.all([
      MarshaCodeService.getCountries(),
      MarshaCodeService.getRegions(),
      MarshaCodeService.getBrands()
    ])

    res.json({
      success: true,
      filters: { countries, regions, brands }
    })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options'
    })
  }
})

/**
 * GET /api/marsha-codes/:code
 * Get MARSHA code details by code
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params

    const marshaCode = await MarshaCodeService.getByCode(code)

    if (!marshaCode) {
      return res.status(404).json({
        success: false,
        error: 'MARSHA code not found'
      })
    }

    res.json({ success: true, marshaCode })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MARSHA code'
    })
  }
})

/**
 * POST /api/marsha-codes/assign
 * Assign MARSHA code to a hotel
 * Requires: hotels:manage permission
 */
router.post('/assign', requirePermission(PermissionResource.HOTELS, PermissionAction.MANAGE), async (req, res) => {
  try {
    const { hotelId, marshaCodeId } = req.body

    if (!hotelId || !marshaCodeId) {
      return res.status(400).json({
        success: false,
        error: 'hotelId and marshaCodeId are required'
      })
    }

    const result = await MarshaCodeService.assignToHotel(
      hotelId,
      marshaCodeId,
      req.user
    )

    res.json({
      success: true,
      message: 'MARSHA code assigned successfully',
      ...result
    })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to assign MARSHA code'
    })
  }
})

/**
 * DELETE /api/marsha-codes/release/:hotelId
 * Release MARSHA code from a hotel
 * Requires: hotels:manage permission
 */
router.delete('/release/:hotelId', requirePermission(PermissionResource.HOTELS, PermissionAction.MANAGE), async (req, res) => {
  try {
    const { hotelId } = req.params

    const result = await MarshaCodeService.releaseFromHotel(hotelId, req.user)

    res.json({
      success: true,
      message: 'MARSHA code released successfully',
      ...result
    })
  } catch (error) {
    logError('MarshaCodesController', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to release MARSHA code'
    })
  }
})

export default router
