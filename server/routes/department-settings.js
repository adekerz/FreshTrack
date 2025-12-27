/**
 * FreshTrack Department Settings API
 * Per-department notification and system settings
 */

import express from 'express'
import { query, logAudit } from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/department-settings - Get all department settings for hotel
 */
router.get('/', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    // Get all departments for the hotel
    const deptResult = await query(
      'SELECT id FROM departments WHERE hotel_id = $1',
      [req.hotelId]
    )
    
    const settings = {}
    
    for (const dept of deptResult.rows) {
      // Get settings for each department
      const settingsResult = await query(
        `SELECT key, value FROM settings 
         WHERE hotel_id = $1 AND department_id = $2`,
        [req.hotelId, dept.id]
      )
      
      const deptSettings = {}
      for (const row of settingsResult.rows) {
        try {
          deptSettings[row.key] = JSON.parse(row.value)
        } catch {
          deptSettings[row.key] = row.value
        }
      }
      
      // Set defaults if not present
      settings[dept.id] = {
        telegramEnabled: deptSettings.telegram_enabled ?? true,
        pushEnabled: deptSettings.push_enabled ?? true,
        emailEnabled: deptSettings.email_enabled ?? false,
        quietHoursStart: deptSettings.quiet_hours_start ?? '22:00',
        quietHoursEnd: deptSettings.quiet_hours_end ?? '08:00',
        warningDays: deptSettings.warning_days ?? 7,
        criticalDays: deptSettings.critical_days ?? 3,
        ...deptSettings
      }
    }
    
    res.json({ success: true, settings })
  } catch (error) {
    console.error('Get department settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get department settings' })
  }
})

/**
 * GET /api/department-settings/:departmentId - Get settings for specific department
 */
router.get('/:departmentId', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.READ), async (req, res) => {
  try {
    const { departmentId } = req.params
    
    const settingsResult = await query(
      `SELECT key, value FROM settings 
       WHERE hotel_id = $1 AND department_id = $2`,
      [req.hotelId, departmentId]
    )
    
    const settings = {}
    for (const row of settingsResult.rows) {
      try {
        settings[row.key] = JSON.parse(row.value)
      } catch {
        settings[row.key] = row.value
      }
    }
    
    // Set defaults
    const result = {
      telegramEnabled: settings.telegram_enabled ?? true,
      pushEnabled: settings.push_enabled ?? true,
      emailEnabled: settings.email_enabled ?? false,
      quietHoursStart: settings.quiet_hours_start ?? '22:00',
      quietHoursEnd: settings.quiet_hours_end ?? '08:00',
      warningDays: settings.warning_days ?? 7,
      criticalDays: settings.critical_days ?? 3,
      ...settings
    }
    
    res.json({ success: true, settings: result })
  } catch (error) {
    console.error('Get department settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to get department settings' })
  }
})

/**
 * PUT /api/department-settings/:departmentId - Update department settings
 */
router.put('/:departmentId', authMiddleware, hotelIsolation, requirePermission(PermissionResource.SETTINGS, PermissionAction.UPDATE), async (req, res) => {
  try {
    const { departmentId } = req.params
    const settings = req.body
    
    // Map frontend keys to database keys
    const keyMap = {
      telegramEnabled: 'telegram_enabled',
      pushEnabled: 'push_enabled',
      emailEnabled: 'email_enabled',
      quietHoursStart: 'quiet_hours_start',
      quietHoursEnd: 'quiet_hours_end',
      warningDays: 'warning_days',
      criticalDays: 'critical_days'
    }
    
    for (const [frontendKey, value] of Object.entries(settings)) {
      const dbKey = keyMap[frontendKey] || frontendKey
      const jsonValue = JSON.stringify(value)
      
      await query(
        `INSERT INTO settings (hotel_id, department_id, key, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (hotel_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'), key)
         DO UPDATE SET value = $4, updated_at = NOW()`,
        [req.hotelId, departmentId, dbKey, jsonValue]
      )
    }
    
    await logAudit({
      hotel_id: req.hotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'update',
      entity_type: 'department_settings',
      entity_id: departmentId,
      details: { settings: Object.keys(settings) },
      ip_address: req.ip
    })
    
    res.json({ success: true })
  } catch (error) {
    console.error('Update department settings error:', error)
    res.status(500).json({ success: false, error: 'Failed to update department settings' })
  }
})

export default router
