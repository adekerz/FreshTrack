/**
 * FreshTrack Hotels API
 * Hotel management - SUPER_ADMIN only
 */

import express from 'express'
import { 
  getAllHotels, 
  getHotelById, 
  getHotelByCode,
  createHotel, 
  updateHotel,
  logAudit 
} from '../db/database.js'
import { authMiddleware, superAdminOnly } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/hotels - Get all hotels
 * SUPER_ADMIN only
 */
router.get('/', authMiddleware, superAdminOnly, (req, res) => {
  try {
    const hotels = getAllHotels()
    res.json({ success: true, hotels })
  } catch (error) {
    console.error('Get hotels error:', error)
    res.status(500).json({ success: false, error: 'Failed to get hotels' })
  }
})

/**
 * GET /api/hotels/current - Get current user's hotel
 * Any authenticated user
 */
router.get('/current', authMiddleware, (req, res) => {
  try {
    if (!req.user.hotel_id) {
      // Super admin may not have a hotel
      if (req.user.role === 'SUPER_ADMIN') {
        return res.json({ success: true, hotel: null })
      }
      return res.status(404).json({ success: false, error: 'No hotel assigned' })
    }
    
    const hotel = getHotelById(req.user.hotel_id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    res.json({ success: true, hotel })
  } catch (error) {
    console.error('Get current hotel error:', error)
    res.status(500).json({ success: false, error: 'Failed to get hotel' })
  }
})

/**
 * GET /api/hotels/:id - Get hotel by ID
 * SUPER_ADMIN only
 */
router.get('/:id', authMiddleware, superAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const hotel = getHotelById(id)
    
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    res.json({ success: true, hotel })
  } catch (error) {
    console.error('Get hotel error:', error)
    res.status(500).json({ success: false, error: 'Failed to get hotel' })
  }
})

/**
 * POST /api/hotels - Create new hotel
 * SUPER_ADMIN only
 */
router.post('/', authMiddleware, superAdminOnly, (req, res) => {
  try {
    const { name, code, address, city, country, timezone } = req.body
    
    // Validation
    if (!name || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and code are required' 
      })
    }
    
    // Check if code exists
    const existing = getHotelByCode(code)
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: 'Hotel with this code already exists' 
      })
    }
    
    const hotel = createHotel({ name, code, address, city, country, timezone })
    
    // Log action
    logAudit({
      hotel_id: hotel.id,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'hotel',
      entity_id: hotel.id,
      details: { name, code },
      ip_address: req.ip
    })
    
    res.status(201).json({ success: true, hotel })
  } catch (error) {
    console.error('Create hotel error:', error)
    res.status(500).json({ success: false, error: 'Failed to create hotel' })
  }
})

/**
 * PUT /api/hotels/:id - Update hotel
 * SUPER_ADMIN only
 */
router.put('/:id', authMiddleware, superAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const { name, address, city, country, timezone, is_active } = req.body
    
    const hotel = getHotelById(id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    const success = updateHotel(id, { name, address, city, country, timezone, is_active })
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'hotel',
        entity_id: id,
        details: { name, is_active },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Update hotel error:', error)
    res.status(500).json({ success: false, error: 'Failed to update hotel' })
  }
})

export default router
