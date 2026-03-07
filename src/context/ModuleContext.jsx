/**
 * ModuleContext
 *
 * Управляет состоянием модулей для текущего пользователя.
 * Загружает доступные модули с сервера и предоставляет
 * функции для проверки доступа к модулям.
 *
 * Поддерживает real-time обновления через SSE:
 * - module-disabled → обновляет модули + уведомляет ProtectedRoute
 * - module-enabled  → обновляет модули + показывает предупреждение если давно отключён
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useAuth } from './AuthContext'
import { apiFetch } from '../services/api'
import { useSSE } from '../hooks/useSSE'
import { logError, logInfo } from '../utils/logger'

const ModuleContext = createContext(null)

export function ModuleProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Real-time module change events (для ProtectedRoute countdown и banner)
  const [recentlyDisabledModule, setRecentlyDisabledModule] = useState(null)
  const [recentlyEnabledModule, setRecentlyEnabledModule] = useState(null)

  // Timers for auto-clearing module events
  const disabledTimerRef = useRef(null)
  const enabledTimerRef = useRef(null)

  /**
   * Загрузить модули текущего пользователя
   */
  const fetchModules = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setModules([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const data = await apiFetch('/modules/my-modules')

      if (data.success && Array.isArray(data.modules)) {
        setModules(data.modules)
      } else {
        setModules([])
      }
    } catch (err) {
      logError('[ModuleContext] Failed to fetch modules:', err.message)
      setError(err.message)
      setModules([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  // Загружаем модули при авторизации
  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (disabledTimerRef.current) clearTimeout(disabledTimerRef.current)
      if (enabledTimerRef.current) clearTimeout(enabledTimerRef.current)
    }
  }, [])

  // SSE обработчики для событий модулей
  const sseHandlers = useMemo(
    () => ({
      onModuleDisabled: (data) => {
        logInfo('[ModuleContext] Module disabled via SSE:', data.module_code)

        // Track which module was disabled (for countdown overlay in ProtectedRoute)
        setRecentlyDisabledModule({
          module_code: data.module_code,
          timestamp: Date.now(),
        })

        // Auto-clear after 30s
        if (disabledTimerRef.current) clearTimeout(disabledTimerRef.current)
        disabledTimerRef.current = setTimeout(() => {
          setRecentlyDisabledModule(null)
        }, 30000)

        // Refresh module list
        fetchModules()
      },
      onModuleEnabled: (data) => {
        logInfo('[ModuleContext] Module enabled via SSE:', data.module_code)

        // Track which module was enabled (for inactivity banner)
        setRecentlyEnabledModule({
          module_code: data.module_code,
          inactive_days: data.inactive_days || 0,
          timestamp: Date.now(),
        })

        // Auto-clear after 30s
        if (enabledTimerRef.current) clearTimeout(enabledTimerRef.current)
        enabledTimerRef.current = setTimeout(() => {
          setRecentlyEnabledModule(null)
        }, 30000)

        // Refresh module list
        fetchModules()
      },
    }),
    [fetchModules]
  )

  // Subscribe to SSE module events (only when authenticated)
  useSSE({
    enabled: isAuthenticated && !!user,
    handlers: sseHandlers,
  })

  /**
   * Проверить наличие доступа к модулю
   * @param {string} moduleCode - Код модуля
   * @returns {boolean}
   */
  const hasModule = useCallback(
    (moduleCode) => {
      if (!moduleCode) return true // Если модуль не указан — доступ открыт

      // Админы имеют доступ ко всем модулям
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'HOTEL_ADMIN') {
        return true
      }

      return modules.some((m) => m.code === moduleCode)
    },
    [modules, user?.role]
  )

  /**
   * Проверить наличие доступа к любому из модулей
   * @param {string[]} moduleCodes - Коды модулей
   * @returns {boolean}
   */
  const hasAnyModule = useCallback(
    (moduleCodes) => {
      if (!moduleCodes || moduleCodes.length === 0) return true

      // Админы имеют доступ ко всем модулям
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'HOTEL_ADMIN') {
        return true
      }

      return moduleCodes.some((code) => modules.some((m) => m.code === code))
    },
    [modules, user?.role]
  )

  /**
   * Получить список кодов доступных модулей
   * @returns {string[]}
   */
  const moduleCodes = useMemo(() => {
    return modules.map((m) => m.code)
  }, [modules])

  /**
   * Сбросить событие "модуль отключён" (после показа countdown)
   */
  const clearDisabledEvent = useCallback(() => {
    setRecentlyDisabledModule(null)
    if (disabledTimerRef.current) clearTimeout(disabledTimerRef.current)
  }, [])

  /**
   * Сбросить событие "модуль включён" (после показа banner)
   */
  const clearEnabledEvent = useCallback(() => {
    setRecentlyEnabledModule(null)
    if (enabledTimerRef.current) clearTimeout(enabledTimerRef.current)
  }, [])

  const value = useMemo(
    () => ({
      modules,
      moduleCodes,
      loading,
      error,
      hasModule,
      hasAnyModule,
      refetchModules: fetchModules,
      // Real-time events
      recentlyDisabledModule,
      recentlyEnabledModule,
      clearDisabledEvent,
      clearEnabledEvent,
    }),
    [
      modules,
      moduleCodes,
      loading,
      error,
      hasModule,
      hasAnyModule,
      fetchModules,
      recentlyDisabledModule,
      recentlyEnabledModule,
      clearDisabledEvent,
      clearEnabledEvent,
    ]
  )

  return (
    <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>
  )
}

/**
 * Hook для доступа к контексту модулей
 */
export function useModules() {
  const context = useContext(ModuleContext)
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider')
  }
  return context
}

export default ModuleContext
