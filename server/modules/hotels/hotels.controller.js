/**
 * Hotels Controller
 * 
 * HTTP handlers для управления отелями.
 */

import { Router } from 'express'
import { logError } from '../../utils/logger.js'
import { query as dbQuery } from '../../db/postgres.js'
import {
  getAllHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
  logAudit
} from '../../db/database.js'
import { 
  authMiddleware, 
  requirePermission,
  PermissionResource,
  PermissionAction,
  superAdminOnly
} from '../../middleware/auth.js'
import { requireMFA } from '../../middleware/requireMFA.js'
import { CreateHotelSchema, UpdateHotelSchema, validate } from './hotels.schemas.js'
import { GeoNamesService } from '../../services/GeoNamesService.js'

const router = Router()

/**
 * POST /api/hotels/detect-timezone
 * Автоопределение timezone по городу (GeoNames).
 */
router.post('/detect-timezone',
  authMiddleware,
  requirePermission(PermissionResource.HOTELS, PermissionAction.READ),
  async (req, res) => {
    try {
      const { city, countryCode } = req.body || {}
      if (!city || typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({ success: false, error: 'City name is required' })
      }
      if (!GeoNamesService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Timezone auto-detection is not configured',
          fallbackRequired: true
        })
      }
      const result = await GeoNamesService.getTimezoneByCity(city.trim(), countryCode || null)
      res.json({ success: true, ...result })
    } catch (error) {
      logError('POST /hotels/detect-timezone', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to detect timezone',
        fallbackRequired: true
      })
    }
  }
)

/**
 * GET /api/hotels/city-suggestions?q=...
 * Подсказки городов для autocomplete.
 */
router.get('/city-suggestions',
  authMiddleware,
  requirePermission(PermissionResource.HOTELS, PermissionAction.READ),
  async (req, res) => {
    try {
      const q = (req.query.q || '').toString().trim()
      if (q.length < 2) {
        return res.json({ success: true, suggestions: [] })
      }
      if (!GeoNamesService.isConfigured()) {
        return res.json({ success: true, suggestions: [] })
      }
      const suggestions = await GeoNamesService.getCitySuggestions(q, 10)
      res.json({ success: true, suggestions })
    } catch (error) {
      logError('GET /hotels/city-suggestions', error)
      res.status(500).json({ success: false, error: 'Failed to fetch suggestions' })
    }
  }
)

/**
 * GET /api/hotels
 */
router.get('/', 
  authMiddleware, 
  requirePermission(PermissionResource.HOTELS, PermissionAction.READ),
  requireMFA, // MFA required for SUPER_ADMIN
  async (req, res) => {
    try {
      if (req.user.role === 'SUPER_ADMIN') {
      const hotels = await getAllHotels()
      res.json({ success: true, hotels })
    } else if (req.user.hotel_id) {
      const hotel = await getHotelById(req.user.hotel_id)
      res.json({ success: true, hotels: hotel ? [hotel] : [] })
    } else {
      res.json({ success: true, hotels: [] })
    }
  } catch (error) {
    logError('Get hotels error', error)
    res.status(500).json({ success: false, error: 'Failed to get hotels' })
  }
})

/**
 * GET /api/hotels/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const hotel = await getHotelById(req.params.id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.user.hotel_id !== hotel.id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, hotel })
  } catch (error) {
    logError('Get hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to get hotel' })
  }
})

/**
 * POST /api/hotels
 */
router.post('/', 
  authMiddleware, 
  requirePermission(PermissionResource.HOTELS, PermissionAction.CREATE),
  requireMFA, // MFA required for SUPER_ADMIN
  async (req, res) => {
  try {
    const validation = validate(CreateHotelSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }

    const {
      name,
      description,
      address,
      phone,
      email,
      settings,
      timezone,
      city,
      country,
      latitude,
      longitude,
      timezone_auto_detected,
      marsha_code,
      marsha_code_id
    } = validation.data

    const hotel = await createHotel({
      name,
      address,
      city,
      country,
      timezone,
      latitude,
      longitude,
      timezone_auto_detected,
      marsha_code,
      marsha_code_id
    })
    
    // Если указан MARSHA код - пометить его как назначенный
    if (marsha_code_id && hotel.id) {
      try {
        await dbQuery(`
          UPDATE marsha_codes 
          SET is_assigned = true, assigned_to_hotel_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [hotel.id, marsha_code_id])
      } catch (marshaError) {
        console.error('Failed to assign MARSHA code:', marshaError)
      }
    }
    
    await logAudit({
      hotel_id: hotel.id, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'hotel', entity_id: hotel.id,
      details: { name, marsha_code }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, hotel })
  } catch (error) {
    logError('Create hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to create hotel' })
  }
})

/**
 * PUT /api/hotels/:id
 */
router.put('/:id', authMiddleware, requirePermission(PermissionResource.HOTELS, PermissionAction.UPDATE, {
  getTargetHotelId: (req) => req.params.id
}), async (req, res) => {
  try {
    const hotel = await getHotelById(req.params.id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    if (req.user.role !== 'SUPER_ADMIN' && 
        !(req.user.role === 'HOTEL_ADMIN' && req.user.hotel_id === hotel.id)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const validation = validate(UpdateHotelSchema, req.body)
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: validation.errors })
    }

    const { name, description, address, phone, email, settings, timezone, is_active } = validation.data
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (address !== undefined) updates.address = address
    if (phone !== undefined) updates.phone = phone
    if (email !== undefined) updates.email = email
    if (settings !== undefined) updates.settings = settings
    if (timezone !== undefined) updates.timezone = timezone
    if (is_active !== undefined && req.user.role === 'SUPER_ADMIN') updates.is_active = is_active
    
    const success = await updateHotel(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: hotel.id, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'hotel', entity_id: req.params.id,
        details: { name: hotel.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Update hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to update hotel' })
  }
})

/**
 * DELETE /api/hotels/:id
 */
router.delete('/:id', 
  authMiddleware, 
  requirePermission(PermissionResource.HOTELS, PermissionAction.DELETE),
  requireMFA, // MFA required for SUPER_ADMIN
  async (req, res) => {
  try {
    const hotel = await getHotelById(req.params.id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    const success = await deleteHotel(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: null, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'hotel', entity_id: req.params.id,
        details: { name: hotel.name, marsha_code: hotel.marsha_code }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to delete hotel' })
  }
})

export default router
