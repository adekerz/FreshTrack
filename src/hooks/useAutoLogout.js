/**
 * useAutoLogout — автоматический выход при неактивности пользователя.
 *
 * Отслеживает события: mousemove, keydown, scroll, touchstart, click.
 * При бездействии дольше timeoutMinutes вызывает logout().
 * Если timeoutMinutes === 0 — автовыход отключён.
 */

import { useEffect, useRef, useCallback } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']

// Минимальный интервал сброса таймера (throttle) — 1 секунда
const THROTTLE_MS = 1000

export function useAutoLogout({ timeoutMinutes, logout, isAuthenticated }) {
  const timerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const throttleRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      console.info('[AutoLogout] Выход по неактивности')
      logout()
    }, timeoutMinutes * 60 * 1000)
  }, [timeoutMinutes, logout, clearTimer])

  const handleActivity = useCallback(() => {
    const now = Date.now()
    // Throttle: не сбрасывать таймер чаще раза в THROTTLE_MS
    if (now - lastActivityRef.current < THROTTLE_MS) return
    lastActivityRef.current = now
    startTimer()
  }, [startTimer])

  useEffect(() => {
    // Не запускаем если пользователь не авторизован или таймаут отключён
    if (!isAuthenticated || !timeoutMinutes || timeoutMinutes <= 0) {
      clearTimer()
      return
    }

    // Запускаем начальный таймер
    startTimer()

    // Подписываемся на события активности
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearTimer()
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [isAuthenticated, timeoutMinutes, startTimer, handleActivity, clearTimer])
}
