/**
 * useSessionSettings — загружает настройки сессии текущего отеля.
 *
 * Возвращает { autoLogoutMinutes, rememberDevice, loading }.
 * Используется в App для передачи в useAutoLogout.
 *
 * Настройки привязаны к отелю (hotelIsolation на сервере),
 * поэтому каждый отель может иметь свои значения.
 */

import { useState, useEffect } from 'react'
import { apiFetch } from '../services/api'

const DEFAULT_SETTINGS = {
  autoLogoutMinutes: 60,
  rememberDevice: true
}

export function useSessionSettings(isAuthenticated) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchSettings = async () => {
      try {
        const data = await apiFetch('/settings/general')
        if (!cancelled && data) {
          setSettings({
            autoLogoutMinutes: typeof data.autoLogoutMinutes === 'number'
              ? data.autoLogoutMinutes
              : DEFAULT_SETTINGS.autoLogoutMinutes,
            rememberDevice: typeof data.rememberDevice === 'boolean'
              ? data.rememberDevice
              : DEFAULT_SETTINGS.rememberDevice
          })
        }
      } catch {
        // При ошибке используем defaults — лучше 60 минут чем вообще нет выхода
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSettings()

    return () => { cancelled = true }
  }, [isAuthenticated])

  return { ...settings, loading }
}
