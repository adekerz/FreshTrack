/**
 * FreshTrack Hotels API - PostgreSQL Async Version
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
  logAudit
} from '../db/database.js'
import { 
  authMiddleware, 
  superAdminOnly, 
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// GET /api/hotels
router.get('/', authMiddleware, requirePermission(PermissionResource.HOTELS, PermissionAction.READ), async (req, res) => {
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

// GET /api/hotels/:id
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

// POST /api/hotels
router.post('/', authMiddleware, requirePermission(PermissionResource.HOTELS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { name, description, address, phone, email, settings, timezone } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Hotel name is required' })
    }
    
    // Auto-generate code from name
    const code = generateHotelCode(name)
    
    const hotel = await createHotel({
      name, code, description, address, phone, email, settings, timezone
    })
    
    await logAudit({
      hotel_id: hotel.id, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'hotel', entity_id: hotel.id,
      details: { name, code }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, hotel })
  } catch (error) {
    logError('Create hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to create hotel' })
  }
})

/**
 * Generate unique hotel code from name
 * Takes first letters of each word + random suffix
 */
function generateHotelCode(name) {
  // Take first letters of each word, uppercase
  const prefix = name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3) || 'HTL'
  
  // Add random 4-digit suffix
  const suffix = Math.floor(1000 + Math.random() * 9000)
  
  return `${prefix}${suffix}`
}

// PUT /api/hotels/:id
router.put('/:id', authMiddleware, requirePermission(PermissionResource.HOTELS, PermissionAction.UPDATE, {
  getTargetHotelId: (req) => req.params.id
}), async (req, res) => {
  try {
    const hotel = await getHotelById(req.params.id)
    if (!hotel) {
      return res.status(404).json({ success: false, error: 'Hotel not found' })
    }
    
    // Only SUPER_ADMIN or HOTEL_ADMIN of same hotel can update
    if (req.user.role !== 'SUPER_ADMIN' && 
        !(req.user.role === 'HOTEL_ADMIN' && req.user.hotel_id === hotel.id)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { name, code, description, address, phone, email, settings, timezone, is_active } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (code !== undefined && req.user.role === 'SUPER_ADMIN') updates.code = code
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

// DELETE /api/hotels/:id
router.delete('/:id', authMiddleware, requirePermission(PermissionResource.HOTELS, PermissionAction.DELETE), async (req, res) => {
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
        details: { name: hotel.name, code: hotel.code }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete hotel error', error)
    res.status(500).json({ success: false, error: 'Failed to delete hotel' })
  }
})

export default router



