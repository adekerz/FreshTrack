/**
 * Audit Logs SSE Hook
 * Подписка на поток новых записей журнала аудита (Server-Sent Events)
 * EventSource не поддерживает заголовки — токен передаётся в query.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE_URL } from '../services/api'

const MAX_NEW_LOGS = 10

export function useAuditSSE(enabled = true) {
  const [newLogs, setNewLogs] = useState([])
  const eventSourceRef = useRef(null)

  const clearNewLogs = useCallback(() => setNewLogs([]), [])

  useEffect(() => {
    if (!enabled) return

    const token = localStorage.getItem('freshtrack_token')
    if (!token) return

    const url = `${API_BASE_URL}/audit-logs/stream?token=${encodeURIComponent(token)}`

    const eventSource = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_log' && data.log) {
          setNewLogs((prev) => [data.log, ...prev].slice(0, MAX_NEW_LOGS))
        }
      } catch {
        // ignore parse errors (e.g. ping)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled])

  return { newLogs, clearNewLogs }
}
