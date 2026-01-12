/**
 * Events Controller (SSE)
 * Real-time Server-Sent Events endpoint
 * 
 * @module modules/events
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
 */

import express from 'express'
import { authMiddleware, hotelIsolation, requirePermission } from '../../middleware/auth.js'
import sseManager from '../../services/SSEManager.js'
import { isSuperAdmin } from '../../utils/constants.js'
import { logInfo, logError } from '../../utils/logger.js'

const router = express.Router()

/**
 * GET /api/events/stream
 * SSE endpoint for real-time updates
 * 
 * Authentication: Bearer token in query param (EventSource doesn't support headers)
 * Usage: new EventSource('/api/events/stream?token=xxx')
 */
router.get('/stream', authMiddleware, hotelIsolation, (req, res) => {
  try {
    const { id: userId, name: userName, role } = req.user
    const hotelId = req.hotelId

    // SUPER_ADMIN without hotel gets global broadcast channel
    const effectiveHotelId = hotelId || 'global'

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable Nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    // Flush headers immediately
    res.flushHeaders()

    // Register client with role for filtered broadcasts
    sseManager.addClient(effectiveHotelId, userId, userName, role, res)

    // Send initial state info
    const initMsg = sseManager.formatMessage('init', {
      userId,
      userName,
      hotelId: effectiveHotelId,
      role,
      features: {
        branding: true,
        notifications: true,
        inventory: true
      }
    })
    res.write(initMsg)

    // Handle client disconnect
    req.on('close', () => {
      sseManager.removeClient(effectiveHotelId, userId)
    })

    req.on('error', (err) => {
      logError('SSE', `Connection error for ${userName}: ${err.message}`)
      sseManager.removeClient(effectiveHotelId, userId)
    })

  } catch (error) {
    logError('SSE', `Stream setup failed: ${error.message}`)
    res.status(500).json({ error: 'Failed to establish SSE connection' })
  }
})

/**
 * GET /api/events/stats
 * Get SSE connection statistics (admin only)
 */
router.get('/stats', authMiddleware, requirePermission('events', 'view'), (req, res) => {
  const stats = sseManager.getStats()

  // For non-SUPER_ADMIN, only show their hotel
  if (req.hotelId && !isSuperAdmin(req.user)) {
    res.json({
      success: true,
      hotelId: req.hotelId,
      clients: sseManager.getClientsByHotel(req.hotelId),
      totalInHotel: stats.hotels[req.hotelId] || 0
    })
  } else {
    // SUPER_ADMIN sees everything
    res.json({
      success: true,
      ...stats
    })
  }
})

/**
 * POST /api/events/broadcast
 * Manually broadcast an event (admin only)
 * For testing and manual notifications
 */
router.post('/broadcast', authMiddleware, hotelIsolation, requirePermission('events', 'broadcast'), (req, res) => {
  const { event, data, targetHotelId } = req.body

  if (!event || !data) {
    return res.status(400).json({ error: 'event and data are required' })
  }

  // Non-SUPER_ADMIN can only broadcast to their hotel
  const hotelId = isSuperAdmin(req.user)
    ? (targetHotelId || req.hotelId)
    : req.hotelId

  if (!hotelId && !isSuperAdmin(req.user)) {
    return res.status(400).json({ error: 'hotelId is required' })
  }

  let sent
  if (isSuperAdmin(req.user) && !hotelId) {
    // Broadcast to all hotels
    sent = sseManager.broadcastAll(event, {
      ...data,
      source: 'admin-broadcast',
      broadcastBy: req.user.name
    })
  } else {
    sent = sseManager.broadcast(hotelId, event, {
      ...data,
      source: 'admin-broadcast',
      broadcastBy: req.user.name
    })
  }

  logInfo('SSE', `Admin broadcast [${event}] by ${req.user.name}: ${sent} clients`)

  res.json({
    success: true,
    event,
    clientsReached: sent
  })
})

/**
 * POST /api/events/send-to-user
 * Send event to specific user (admin only)
 */
router.post('/send-to-user', authMiddleware, hotelIsolation, requirePermission('events', 'send'), (req, res) => {
  const { userId, event, data } = req.body

  if (!userId || !event || !data) {
    return res.status(400).json({ error: 'userId, event, and data are required' })
  }

  const hotelId = req.hotelId || 'global'
  const sent = sseManager.sendToUser(hotelId, userId, event, data)

  res.json({
    success: sent,
    message: sent ? 'Event sent' : 'User not connected'
  })
})

/**
 * GET /api/events/health
 * Health check for SSE service
 */
router.get('/health', (req, res) => {
  const stats = sseManager.getStats()
  res.json({
    status: 'ok',
    service: 'SSE',
    totalClients: stats.totalClients,
    hotelsActive: Object.keys(stats.hotels).length
  })
})

export default router
