/**
 * FreshTrack SSE Hook
 * React hook for Server-Sent Events with auto-reconnect
 * 
 * Features:
 * - Automatic exponential backoff reconnection
 * - Event-specific handlers
 * - Connection state management
 * - Clean cleanup on unmount
 * 
 * @see https://javascript.info/server-sent-events
 * @see https://web.dev/articles/eventsource-basics
 */

import { useEffect, useRef, useState, useCallback } from 'react'

// Connection states
export const SSE_STATE = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
}

// Default event types - must match server/utils/constants.js SSE_EVENTS
export const SSE_EVENTS = {
  // System events
  CONNECTED: 'connected',
  INIT: 'init',
  
  // Branding & Settings
  BRANDING_UPDATE: 'branding-update',
  SETTINGS_UPDATE: 'settings-update',
  
  // Inventory (Products)
  PRODUCT_CREATED: 'product-created',
  PRODUCT_UPDATED: 'product-updated',
  PRODUCT_DELETED: 'product-deleted',
  
  // Batches
  BATCH_ADDED: 'batch-added',
  BATCH_UPDATED: 'batch-updated',
  
  // Write-offs
  WRITE_OFF: 'write-off',
  BULK_WRITE_OFF: 'bulk-write-off',
  
  // Expiry alerts
  EXPIRING_CRITICAL: 'expiring-critical',
  EXPIRING_WARNING: 'expiring-warning',
  EXPIRED: 'expired',
  
  // Users (admins only)
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',
  
  // Dashboard
  STATS_UPDATE: 'stats-update',
  
  // Generic notifications
  NOTIFICATION: 'notification'
}

/**
 * SSE Hook for real-time updates
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Enable/disable SSE connection
 * @param {Object} options.handlers - Event handlers { [eventName]: (data) => void }
 * @param {Function} options.onConnect - Called when connected
 * @param {Function} options.onDisconnect - Called when disconnected
 * @param {Function} options.onError - Called on error
 * 
 * @returns {Object} { state, reconnect, disconnect }
 */
export function useSSE(options = {}) {
  const {
    enabled = true,
    handlers = {},
    onConnect,
    onDisconnect,
    onError
  } = options

  const [state, setState] = useState(SSE_STATE.DISCONNECTED)
  const [lastEvent, setLastEvent] = useState(null)
  const [connectionInfo, setConnectionInfo] = useState(null)
  
  const eventSourceRef = useRef(null)
  const handlersRef = useRef(handlers)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimeoutRef = useRef(null)
  const mountedRef = useRef(true)

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  // Calculate backoff delay
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptRef.current
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
    return delay
  }, [])

  // Get SSE URL with token
  const getSSEUrl = useCallback(() => {
    const token = localStorage.getItem('freshtrack_token')
    if (!token) return null

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    // EventSource doesn't support headers, so we pass token in query
    return `${baseUrl}/api/events/stream?token=${encodeURIComponent(token)}`
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (mountedRef.current) {
      setState(SSE_STATE.DISCONNECTED)
    }
  }, [])

  // Connect
  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return

    const url = getSSEUrl()
    if (!url) {
      console.warn('[SSE] No auth token, skipping connection')
      return
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState(SSE_STATE.CONNECTING)
    console.log('[SSE] Connecting...', url.split('?')[0])

    try {
      const eventSource = new EventSource(url, { withCredentials: false })
      eventSourceRef.current = eventSource

      // Connection opened
      eventSource.onopen = () => {
        if (!mountedRef.current) return
        console.log('[SSE] Connection opened')
        reconnectAttemptRef.current = 0
      }

      // Handle 'connected' event
      eventSource.addEventListener('connected', (e) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(e.data)
          console.log('[SSE] Connected:', data)
          setState(SSE_STATE.CONNECTED)
          setConnectionInfo(data)
          setLastEvent({ event: 'connected', data, time: new Date() })
          onConnect?.(data)
        } catch (err) {
          console.error('[SSE] Parse error:', err)
        }
      })

      // Handle 'init' event
      eventSource.addEventListener('init', (e) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(e.data)
          console.log('[SSE] Init:', data)
          setConnectionInfo(prev => ({ ...prev, ...data }))
          handlersRef.current.onInit?.(data)
        } catch (err) {
          console.error('[SSE] Parse error:', err)
        }
      })

      // Register all event handlers
      const eventTypes = [
        // Branding & Settings
        SSE_EVENTS.BRANDING_UPDATE,
        SSE_EVENTS.SETTINGS_UPDATE,
        // Inventory
        SSE_EVENTS.PRODUCT_CREATED,
        SSE_EVENTS.PRODUCT_UPDATED,
        SSE_EVENTS.PRODUCT_DELETED,
        // Batches
        SSE_EVENTS.BATCH_ADDED,
        SSE_EVENTS.BATCH_UPDATED,
        // Write-offs
        SSE_EVENTS.WRITE_OFF,
        SSE_EVENTS.BULK_WRITE_OFF,
        // Expiry
        SSE_EVENTS.EXPIRING_CRITICAL,
        SSE_EVENTS.EXPIRING_WARNING,
        SSE_EVENTS.EXPIRED,
        // Users
        SSE_EVENTS.USER_ONLINE,
        SSE_EVENTS.USER_OFFLINE,
        // Dashboard
        SSE_EVENTS.STATS_UPDATE,
        // Generic
        SSE_EVENTS.NOTIFICATION
      ]

      eventTypes.forEach(eventType => {
        eventSource.addEventListener(eventType, (e) => {
          if (!mountedRef.current) return
          try {
            const data = JSON.parse(e.data)
            console.log(`[SSE] Event [${eventType}]:`, data)
            setLastEvent({ event: eventType, data, time: new Date() })
            
            // Call specific handler if exists
            // Convert event-name to camelCase: 'branding-update' → 'onBrandingUpdate'
            const handlerName = 'on' + eventType
              .split('-')
              .map((word, i) => word.charAt(0).toUpperCase() + word.slice(1))
              .join('')
            
            handlersRef.current[handlerName]?.(data)
            
            // Also call generic handler
            handlersRef.current.onEvent?.(eventType, data)
          } catch (err) {
            console.error(`[SSE] Parse error for ${eventType}:`, err)
          }
        })
      })

      // Handle errors
      eventSource.onerror = (e) => {
        if (!mountedRef.current) return
        console.error('[SSE] Connection error:', e)
        
        setState(SSE_STATE.ERROR)
        onError?.(e)
        
        // Close and try to reconnect
        eventSource.close()
        eventSourceRef.current = null
        
        // Schedule reconnect with backoff
        const delay = getReconnectDelay()
        reconnectAttemptRef.current++
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && enabled) {
            connect()
          }
        }, delay)

        onDisconnect?.()
      }

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
      setState(SSE_STATE.ERROR)
      onError?.(error)
    }
  }, [enabled, getSSEUrl, getReconnectDelay, onConnect, onDisconnect, onError])

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0
    disconnect()
    setTimeout(() => connect(), 100)
  }, [connect, disconnect])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      connect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled]) // Only re-run if enabled changes

  return {
    state,
    isConnected: state === SSE_STATE.CONNECTED,
    isConnecting: state === SSE_STATE.CONNECTING,
    connectionInfo,
    lastEvent,
    reconnect,
    disconnect
  }
}

export default useSSE
