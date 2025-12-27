/**
 * FreshTrack Settings API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getSettings,
  getSetting,
  updateSettings,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/settings
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { category } = req.query
    const settings = await getSettings(req.hotelId, category)
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get settings' })
  }
})

// GET /api/settings/:key
router.get('/:key', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const setting = await getSetting(req.hotelId, req.params.key)
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' })
    }
    res.json({ success: true, setting })
  } catch (error) {
    console.error('Get setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to get setting' })
  }
})

// PUT /api/settings
router.put('/', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { settings } = req.body
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' })
    }
    
    const success = await updateSettings(req.hotelId, settings)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'settings', entity_id: null,
        details: { keys: Object.keys(settings) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to update settings' })
  }
})

// PUT /api/settings/:key
router.put('/:key', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { value } = req.body
    
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' })
    }
    
    const settings = { [req.params.key]: value }
    const success = await updateSettings(req.hotelId, settings)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'settings', entity_id: null,
        details: { key: req.params.key }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update setting error:', error)
    res.status(500).json({ success: false, error: 'Failed to update setting' })
  }
})

export default router
