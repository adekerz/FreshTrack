/**
 * FreshTrack SSE Manager
 * Server-Sent Events for real-time updates
 * 
 * Features:
 * - Hotel-isolated broadcasts (multi-tenant)
 * - User-specific messages
 * - Automatic heartbeat (30s)
 * - Connection cleanup
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
 */

import { logInfo, logError, logWarn } from '../utils/logger.js'
import { HOTEL_WIDE_ROLES } from '../utils/constants.js'

class SSEManager {
  constructor() {
    // Map<hotelId, Map<userId, { res, connectedAt, lastHeartbeat }>>
    this.clients = new Map()
    
    // Heartbeat interval (30 seconds)
    this.heartbeatInterval = 30000
    this.heartbeatTimer = null
    
    // Start heartbeat
    this.startHeartbeat()
    
    logInfo('SSE', 'SSEManager initialized')
  }

  /**
   * Format SSE message according to spec
   * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
   */
  formatMessage(event, data, id = null) {
    const messageId = id || Date.now()
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data)
    
    let message = `id: ${messageId}\n`
    message += `event: ${event}\n`
    message += `data: ${jsonData}\n\n`
    
    return message
  }

  /**
   * Add client connection
   * @param {string} hotelId - Hotel ID for isolation
   * @param {string} userId - User ID
   * @param {string} userName - User name for logging
   * @param {string} userRole - User role for filtering broadcasts
   * @param {Response} res - Express response object
   */
  addClient(hotelId, userId, userName, userRole, res) {
    // Create hotel map if doesn't exist
    if (!this.clients.has(hotelId)) {
      this.clients.set(hotelId, new Map())
    }

    const hotelClients = this.clients.get(hotelId)
    
    // Close existing connection for this user if any
    if (hotelClients.has(userId)) {
      const existing = hotelClients.get(userId)
      try {
        existing.res.end()
      } catch (e) {
        // Connection already closed
      }
    }

    // Store new connection with role
    hotelClients.set(userId, {
      res,
      userName,
      userRole,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    })

    // Send connected event
    const connectMsg = this.formatMessage('connected', {
      userId,
      hotelId,
      timestamp: new Date().toISOString(),
      message: 'SSE connection established'
    })
    
    try {
      res.write(connectMsg)
    } catch (e) {
      logError('SSE', `Failed to send connect message: ${e.message}`)
    }

    const totalClients = this.getTotalClients()
    logInfo('SSE', `Client connected: ${userName} (hotel: ${hotelId.slice(0, 8)}...) | Total: ${totalClients}`)
    
    return true
  }

  /**
   * Remove client connection
   * @param {string} hotelId - Hotel ID
   * @param {string} userId - User ID
   */
  removeClient(hotelId, userId) {
    const hotelClients = this.clients.get(hotelId)
    if (!hotelClients) return false

    const client = hotelClients.get(userId)
    if (client) {
      hotelClients.delete(userId)
      
      // Clean up empty hotel maps
      if (hotelClients.size === 0) {
        this.clients.delete(hotelId)
      }
      
      logInfo('SSE', `Client disconnected: ${client.userName} | Total: ${this.getTotalClients()}`)
      return true
    }
    
    return false
  }

  /**
   * Broadcast to all clients in a hotel
   * @param {string} hotelId - Target hotel ID
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcast(hotelId, event, data) {
    const hotelClients = this.clients.get(hotelId)
    if (!hotelClients || hotelClients.size === 0) {
      logWarn('SSE', `No clients for hotel ${hotelId?.slice(0, 8)}... to broadcast ${event}`)
      return 0
    }

    const message = this.formatMessage(event, {
      ...data,
      timestamp: new Date().toISOString()
    })

    let sent = 0
    const failed = []

    for (const [userId, client] of hotelClients) {
      try {
        client.res.write(message)
        sent++
      } catch (e) {
        failed.push(userId)
      }
    }

    // Clean up failed connections
    for (const userId of failed) {
      this.removeClient(hotelId, userId)
    }

    logInfo('SSE', `Broadcast [${event}] to ${sent}/${hotelClients.size} clients in hotel ${hotelId?.slice(0, 8)}...`)
    return sent
  }

  /**
   * Broadcast to admin users only in a hotel (SUPER_ADMIN, HOTEL_ADMIN)
   * @param {string} hotelId - Target hotel ID
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcastToAdmins(hotelId, event, data) {
    const hotelClients = this.clients.get(hotelId)
    if (!hotelClients || hotelClients.size === 0) {
      return 0
    }

    const message = this.formatMessage(event, {
      ...data,
      timestamp: new Date().toISOString()
    })

    let sent = 0
    const failed = []

    for (const [userId, client] of hotelClients) {
      // Only send to admins (HOTEL_WIDE_ROLES)
      if (!HOTEL_WIDE_ROLES.includes(client.userRole)) {
        continue
      }
      
      try {
        client.res.write(message)
        sent++
      } catch (e) {
        failed.push(userId)
      }
    }

    // Clean up failed connections
    for (const userId of failed) {
      this.removeClient(hotelId, userId)
    }

    if (sent > 0) {
      logInfo('SSE', `Broadcast [${event}] to ${sent} admins in hotel ${hotelId?.slice(0, 8)}...`)
    }
    return sent
  }

  /**
   * Broadcast to ALL hotels (for SUPER_ADMIN updates)
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcastAll(event, data) {
    let totalSent = 0
    
    for (const [hotelId] of this.clients) {
      totalSent += this.broadcast(hotelId, event, data)
    }
    
    logInfo('SSE', `Broadcast ALL [${event}] to ${totalSent} total clients`)
    return totalSent
  }

  /**
   * Send to specific user
   * @param {string} hotelId - Hotel ID
   * @param {string} userId - Target user ID
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  sendToUser(hotelId, userId, event, data) {
    const hotelClients = this.clients.get(hotelId)
    if (!hotelClients) return false

    const client = hotelClients.get(userId)
    if (!client) return false

    const message = this.formatMessage(event, {
      ...data,
      timestamp: new Date().toISOString()
    })

    try {
      client.res.write(message)
      logInfo('SSE', `Sent [${event}] to user ${client.userName}`)
      return true
    } catch (e) {
      this.removeClient(hotelId, userId)
      return false
    }
  }

  /**
   * Start heartbeat interval
   * Keeps connections alive and cleans up dead ones
   */
  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.heartbeatInterval)
    
    logInfo('SSE', `Heartbeat started (every ${this.heartbeatInterval / 1000}s)`)
  }

  /**
   * Send heartbeat to all clients
   */
  sendHeartbeat() {
    const heartbeat = `: heartbeat ${new Date().toISOString()}\n\n`
    const failed = []

    for (const [hotelId, hotelClients] of this.clients) {
      for (const [userId, client] of hotelClients) {
        try {
          client.res.write(heartbeat)
          client.lastHeartbeat = new Date()
        } catch (e) {
          failed.push({ hotelId, userId })
        }
      }
    }

    // Clean up failed connections
    for (const { hotelId, userId } of failed) {
      this.removeClient(hotelId, userId)
    }

    if (failed.length > 0) {
      logInfo('SSE', `Heartbeat: cleaned up ${failed.length} dead connections`)
    }
  }

  /**
   * Get total client count
   */
  getTotalClients() {
    let total = 0
    for (const hotelClients of this.clients.values()) {
      total += hotelClients.size
    }
    return total
  }

  /**
   * Get clients by hotel
   */
  getClientsByHotel(hotelId) {
    const hotelClients = this.clients.get(hotelId)
    if (!hotelClients) return []
    
    return Array.from(hotelClients.entries()).map(([userId, client]) => ({
      userId,
      userName: client.userName,
      connectedAt: client.connectedAt,
      lastHeartbeat: client.lastHeartbeat
    }))
  }

  /**
   * Get connection stats
   */
  getStats() {
    const stats = {
      totalClients: 0,
      hotels: {}
    }

    for (const [hotelId, hotelClients] of this.clients) {
      const clientCount = hotelClients.size
      stats.hotels[hotelId] = clientCount
      stats.totalClients += clientCount
    }

    return stats
  }

  /**
   * Shutdown - close all connections
   */
  shutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    for (const [hotelId, hotelClients] of this.clients) {
      for (const [userId, client] of hotelClients) {
        try {
          client.res.end()
        } catch (e) {
          // Ignore errors during shutdown
        }
      }
    }

    this.clients.clear()
    logInfo('SSE', 'SSEManager shutdown complete')
  }
}

// Singleton instance
const sseManager = new SSEManager()

// Graceful shutdown - only cleanup, don't call process.exit here
// Let the main process handle the exit
process.on('SIGTERM', () => sseManager.shutdown())
process.on('SIGINT', () => {
  sseManager.shutdown()
  process.exit(0)
})

export default sseManager
export { sseManager, SSEManager }
