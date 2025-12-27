/**
 * FreshTrack Audit API - PostgreSQL Async Version
 */

import express from 'express'
import { getAuditLogs } from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/audit
router.get('/', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { 
      user_id, action, entity_type, entity_id, 
      start_date, end_date, limit = 100, offset = 0 
    } = req.query
    
    const filters = {
      user_id, action, entity_type, entity_id,
      start_date, end_date,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
    
    const logs = await getAuditLogs(req.hotelId, filters)
    res.json({ success: true, logs })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ success: false, error: 'Failed to get audit logs' })
  }
})

// GET /api/audit/actions
router.get('/actions', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const actions = [
      'login', 'logout', 'create', 'update', 'delete',
      'view_report', 'export', 'import', 'change_password',
      'update_profile', 'write_off'
    ]
    res.json({ success: true, actions })
  } catch (error) {
    console.error('Get audit actions error:', error)
    res.status(500).json({ success: false, error: 'Failed to get audit actions' })
  }
})

// GET /api/audit/entity-types
router.get('/entity-types', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const entityTypes = [
      'user', 'hotel', 'department', 'category', 'product',
      'batch', 'write_off', 'notification', 'settings', 'report'
    ]
    res.json({ success: true, entity_types: entityTypes })
  } catch (error) {
    console.error('Get entity types error:', error)
    res.status(500).json({ success: false, error: 'Failed to get entity types' })
  }
})

export default router
