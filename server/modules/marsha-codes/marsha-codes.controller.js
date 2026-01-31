/**
 * MARSHA Codes Controller
 * Marriott MARSHA code management
 * 
 * @module modules/marsha-codes
 */

import express from 'express'
import { authMiddleware, requirePermission, PermissionResource, PermissionAction } from '../../middleware/auth.js'
import MarshaCodeService from '../../services/MarshaCodeService.js'
import { GeoNamesService } from '../../services/GeoNamesService.js'
import { logError } from '../../utils/logger.js'

const router = express.Router()

/** Конвертация названия страны → ISO код для GeoNames */
function getCountryCode(countryName) {
  if (!countryName || typeof countryName !== 'string') return null
  const name = countryName.trim()
  const countryMap = {
    Kazakhstan: 'KZ',
    'United Kingdom': 'GB',
    France: 'FR',
    Germany: 'DE',
    Spain: 'ES',
    Italy: 'IT',
    Netherlands: 'NL',
    Belgium: 'BE',
    Austria: 'AT',
    Switzerland: 'CH',
    Portugal: 'PT',
    'Czech Republic': 'CZ',
    Poland: 'PL',
    Greece: 'GR',
    Turkey: 'TR',
    Sweden: 'SE',
    Denmark: 'DK',
    Norway: 'NO',
    Finland: 'FI',
    UAE: 'AE',
    'Saudi Arabia': 'SA',
    Qatar: 'QA',
    Kuwait: 'KW',
    Bahrain: 'BH',
    Oman: 'OM',
    Jordan: 'JO',
    Israel: 'IL',
    Egypt: 'EG',
    'South Africa': 'ZA',
    Morocco: 'MA',
    Kenya: 'KE',
    Nigeria: 'NG',
    Ghana: 'GH',
    Australia: 'AU',
    'New Zealand': 'NZ',
    USA: 'US',
    'United States': 'US'
  }
  return countryMap[name] || null
}

/** Маппинг города/страны Казахстана → IANA timezone UTC+6 (Asia/Qostanay) */
function getCityTimezoneOverride(city, country) {
  if (!country || String(country).trim() !== 'Kazakhstan') return null
  return 'Asia/Qostanay'
}

// ===== PUBLIC ROUTES (no auth required) =====
// These are used during registration when user is not authenticated

/**
 * GET /api/marsha-codes/public/search
 * Public search for MARSHA codes (used in registration)
 */
router.get('/public/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query

    console.log('[MARSHA Public Search] Query:', q, 'Limit:', limit)

    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] })
    }

    const results = await MarshaCodeService.searchByName(q, {
      limit: parseInt(limit),
      includeAssigned: false // Only show unassigned for registration
    })

    console.log('[MARSHA Public Search] Found', results.length, 'results')
    res.json({ success: true, results })
  } catch (error) {
    console.error('[MARSHA Public Search] Error:', error.message)
    logError('MarshaCodesController', error)
    res.status(500).json({
      success: false,
      error: 'Failed to search MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/public/suggest
 * Public auto-suggest (used in registration)
 */
router.get('/public/suggest', async (req, res) => {
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
 * GET /api/marsha-codes/public/:code
 * Get public details of a MARSHA code
 */
router.get('/public/:code', async (req, res) => {
  try {
    const { code } = req.params
    const marshaCode = await MarshaCodeService.getByCode(code.toUpperCase())

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

// ===== PROTECTED ROUTES (auth required) =====
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
 * GET /api/marsha-codes/export
 * Export MARSHA codes to CSV/XLSX/JSON (SUPER_ADMIN only)
 */
router.get('/export', async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role?.toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. SUPER_ADMIN only.'
      })
    }

    const { format = 'xlsx', search, country, region, brand, isAssigned } = req.query

    // Get all codes without pagination for export
    const result = await MarshaCodeService.getAll({
      search,
      country,
      region,
      brand,
      isAssigned,
      page: 1,
      limit: 50000 // Max for export
    })

    // Transform data for export
    const exportData = result.codes.map(code => ({
      code: code.code,
      hotelName: code.hotelName,
      city: code.city,
      country: code.country,
      region: code.region,
      brand: code.brand,
      isAssigned: code.isAssigned ? 'Да' : 'Нет',
      assignedHotelName: code.assignedHotel?.name || '',
      assignedAt: code.assignedAt
    }))

    const { ExportService } = await import('../../services/ExportService.js')

    await ExportService.sendExport(res, exportData, 'marshaCodes', format, {
      filename: `marsha_codes_export_${new Date().toISOString().split('T')[0]}`,
      user: req.user,
      ipAddress: req.ip,
      filters: { search, country, region, brand, isAssigned }
    })
  } catch (error) {
    logError('MarshaCodesController /export', error)
    res.status(500).json({
      success: false,
      error: 'Failed to export MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/all
 * Get all MARSHA codes with filtering and pagination (SUPER_ADMIN only)
 */
router.get('/all', async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role?.toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. SUPER_ADMIN only.'
      })
    }

    const { search, country, region, brand, isAssigned, page = 1, limit = 50 } = req.query

    const result = await MarshaCodeService.getAll({
      search,
      country,
      region,
      brand,
      isAssigned,
      page: parseInt(page),
      limit: parseInt(limit)
    })

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    logError('MarshaCodesController /all', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MARSHA codes'
    })
  }
})

/**
 * GET /api/marsha-codes/:code
 * Детали MARSHA кода с автоопределением timezone по городу (GeoNames).
 * Для Казахстана всегда Asia/Qostanay (UTC+6).
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

    let timezoneData = null
    if (marshaCode.city && marshaCode.country) {
      const override = getCityTimezoneOverride(marshaCode.city, marshaCode.country)
      if (override) {
        timezoneData = { timezone: override, coordinates: null }
      } else if (GeoNamesService.isConfigured()) {
        try {
          const countryCode = getCountryCode(marshaCode.country)
          timezoneData = await GeoNamesService.getTimezoneByCity(
            marshaCode.city,
            countryCode || undefined
          )
        } catch (err) {
          logError('MarshaCodesController GET /:code timezone', err)
        }
      }
    }

    const payload = {
      ...marshaCode,
      timezone: timezoneData?.timezone ?? null,
      coordinates: timezoneData?.coordinates ?? null
    }

    res.json({ success: true, marshaCode: payload })
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
