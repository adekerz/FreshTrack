/**
 * FreshTrack Enterprise Auth Context
 * Clean authentication - NO demo users
 * Split into AuthContext (state + permissions) and AuthActionsContext (stable actions)
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { authAPI, API_BASE_URL } from '../services/api'
import { logInfo, logError, logWarn } from '../utils/logger'

const AuthContext = createContext(null)
const AuthActionsContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Track whether user was authenticated (to detect session expiry vs fresh visit)
  const wasAuthenticatedRef = useRef(false)

  // Listen for global auth events (401/403 from api.js)
  useEffect(() => {
    const handleUnauthorized = (event) => {
      logWarn('[Auth] Unauthorized event received', event.detail)
      // If user was logged in, this is a session expiry
      if (wasAuthenticatedRef.current) {
        setSessionExpired(true)
        wasAuthenticatedRef.current = false
      }
      // Clear auth state (cookie cleared server-side or expired)
      localStorage.removeItem('freshtrack_user')
      setUser(null)
      setAuthError({ type: 'unauthorized', message: event.detail?.message })
    }

    const handleForbidden = (event) => {
      logWarn('[Auth] Forbidden event received', event.detail)
      setAuthError({ type: 'forbidden', message: event.detail?.message, url: event.detail?.url })
    }

    const handleUserUpdated = (event) => {
      logInfo('[Auth] User updated event received', event.detail)
      if (event.detail) {
        setUser(event.detail)
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    window.addEventListener('auth:forbidden', handleForbidden)
    window.addEventListener('auth:userUpdated', handleUserUpdated)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
      window.removeEventListener('auth:forbidden', handleForbidden)
      window.removeEventListener('auth:userUpdated', handleUserUpdated)
    }
  }, [])

  // Track authentication state for session expiry detection
  useEffect(() => {
    if (user) {
      wasAuthenticatedRef.current = true
    }
  }, [user])

  // Clear auth error after a delay
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(null), 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [authError])

  // Validate session cookie and refresh user data on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('freshtrack_user')

      // Always try to validate session via cookie
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            try {
              const data = await response.json()
              if (data.user) {
                setUser(data.user)
                localStorage.setItem('freshtrack_user', JSON.stringify(data.user))
              } else if (savedUser) {
                setUser(JSON.parse(savedUser))
              }
            } catch {
              logWarn('[Auth] Failed to parse JSON response, using cached data')
              if (savedUser) setUser(JSON.parse(savedUser))
            }
          } else {
            logWarn('[Auth] Server returned non-JSON response, using cached data')
            if (savedUser) setUser(JSON.parse(savedUser))
          }
        } else if (response.status === 401) {
          // Cookie expired or invalid
          localStorage.removeItem('freshtrack_user')
          setUser(null)
        } else if (savedUser) {
          // Server error - use cached data
          logWarn(`[Auth] Server returned status ${response.status}, using cached data`)
          setUser(JSON.parse(savedUser))
        }
      } catch (e) {
        // Network error - use cached data for offline resilience
        if (!e.message.includes('fetch') && !e.message.includes('network')) {
          logWarn('[Auth] Failed to refresh user, using cached data', e.message)
        }
        try {
          if (savedUser) setUser(JSON.parse(savedUser))
        } catch {
          localStorage.removeItem('freshtrack_user')
        }
      }

      setLoading(false)
    }

    initAuth()
  }, [])

  // ── Actions (stable, deps: []) ──────────────────────────

  /**
   * Login - supports email OR username
   */
  const login = useCallback(async (identifier, password) => {
    try {
      const response = await authAPI.login(identifier, password)

      // Check if MFA is required
      if (response.requiresMFA) {
        return {
          success: true,
          requiresMFA: true,
          partialToken: response.partialToken
        }
      }

      // Check if terms acceptance is required
      if (response.requiresTermsAcceptance) {
        return {
          success: true,
          requiresTermsAcceptance: true,
          partialToken: response.partialToken,
          currentTermsVersion: response.currentTermsVersion
        }
      }

      // API returns { user, token } on success (token also set as httpOnly cookie)
      if (response.user && response.token) {
        const userData = response.user
        setUser(userData)
        setSessionExpired(false)
        localStorage.setItem('freshtrack_user', JSON.stringify(userData))

        // Check if user must change password (first login with temporary password)
        if (userData.mustChangePassword) {
          return {
            success: true,
            mustChangePassword: true,
            email: userData.email
          }
        }

        return { success: true }
      }

      return { success: false, error: response.error || 'Invalid credentials' }
    } catch (error) {
      logError('Login error:', error.message)
      // 429: rate limit
      const retryMin = error.retryAfter ? Math.ceil(error.retryAfter / 60) : 0
      const isRateLimit = error.status === 429
      const rateLimitMsg = isRateLimit && retryMin > 0
        ? `Слишком много попыток входа. Попробуйте через ${retryMin} мин.`
        : null
      return {
        success: false,
        error: rateLimitMsg || error.message || 'Unable to connect to server. Please check your connection.',
        rateLimited: isRateLimit,
        retryAfter: error.retryAfter || 0
      }
    }
  }, [])

  /**
   * Register new user
   */
  const register = useCallback(async (userData) => {
    try {
      const response = await authAPI.register(userData)

      if (response.success) {
        const newUser = response.user
        if (newUser) {
          setUser(newUser)
          localStorage.setItem('freshtrack_user', JSON.stringify(newUser))
        }
        return { success: true, needsEmailVerification: !!response.needsEmailVerification }
      }

      return { success: false, error: response.error }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' }
    }
  }, [])

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    // Server clears httpOnly cookie
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      logInfo('Logout logging skipped', error.message)
    }

    setUser(null)
    localStorage.removeItem('freshtrack_user')
    localStorage.removeItem('freshtrack_catalog')
    localStorage.removeItem('freshtrack_selected_hotel')
  }, [])

  /**
   * Update user data (functional setState — no dependency on current user)
   */
  const updateUser = useCallback((userData) => {
    setUser(prev => {
      const updatedUser = userData.id ? userData : { ...prev, ...userData }
      localStorage.setItem('freshtrack_user', JSON.stringify(updatedUser))
      return updatedUser
    })
  }, [])

  /**
   * Set user data after verification flows (token is in httpOnly cookie)
   */
  const setUserAndToken = useCallback((userData) => {
    if (userData) {
      setUser(userData)
      localStorage.setItem('freshtrack_user', JSON.stringify(userData))
    }
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  // ── Permission helpers (depend on user) ──────────────────

  /**
   * Check if user has a specific permission
   * Permission format: 'resource:action' (e.g., 'products:delete', 'settings:manage')
   * Supports wildcard permissions: '*' for full access, 'resource:*' for all actions on resource
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false

    const role = user?.role?.toUpperCase()
    // SUPER_ADMIN has all permissions (implicit wildcard)
    if (role === 'SUPER_ADMIN') return true

    const userPermissions = user.permissions || []

    // Check for explicit wildcard
    if (userPermissions.includes('*')) return true

    // Check for exact match
    if (userPermissions.includes(permission)) return true

    // Check for resource wildcard (e.g., 'products:*' grants 'products:delete')
    const [resource] = permission.split(':')
    if (userPermissions.includes(`${resource}:*`)) return true
    if (userPermissions.includes(`${resource}:manage`)) return true

    return false
  }, [user])

  /**
   * Check if user is admin (HOTEL_ADMIN or SUPER_ADMIN)
   * Uses backend capabilities when available, falls back to role check
   */
  const isAdmin = useCallback(() => {
    // Prefer backend capabilities
    if (user?.capabilities?.isAdmin !== undefined) {
      return user.capabilities.isAdmin
    }
    // Fallback to role check
    const role = user?.role?.toUpperCase()
    return (
      role === 'ADMIN' ||
      role === 'ADMINISTRATOR' ||
      role === 'SUPER_ADMIN' ||
      role === 'HOTEL_ADMIN'
    )
  }, [user])

  /**
   * Check if user is super admin
   * Uses backend capabilities when available
   */
  const isSuperAdmin = useCallback(() => {
    if (user?.capabilities?.isSuperAdmin !== undefined) {
      return user.capabilities.isSuperAdmin
    }
    return user?.role?.toUpperCase() === 'SUPER_ADMIN'
  }, [user])

  /**
   * Check if user is hotel admin or super admin
   * Uses backend capabilities when available
   */
  const isHotelAdmin = useCallback(() => {
    if (user?.capabilities?.isAdmin !== undefined) {
      return user.capabilities.isAdmin
    }
    const role = user?.role?.toUpperCase()
    return role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
  }, [user])

  const isDepartmentManager = useCallback(() => {
    return user?.role?.toUpperCase() === 'DEPARTMENT_MANAGER'
  }, [user])

  const isStaff = useCallback(() => {
    return user?.role?.toUpperCase() === 'STAFF'
  }, [user])

  const getCapabilities = useCallback(() => {
    return user?.capabilities || {}
  }, [user])

  const hasCapability = useCallback((capability) => {
    return user?.capabilities?.[capability] === true
  }, [user])

  const canManage = useCallback((resource) => {
    return hasPermission(`${resource}:manage`) || isAdmin()
  }, [hasPermission, isAdmin])

  const canPerformAction = useCallback((resource, action) => {
    return hasPermission(`${resource}:${action}`)
  }, [hasPermission])

  const hasAccessToDepartment = useCallback((departmentId) => {
    if (!user) return false
    if (isAdmin()) return true
    return user.departments?.includes(departmentId)
  }, [user, isAdmin])

  const getAccessibleDepartments = useCallback(() => {
    if (!user) return []
    return user.departments || []
  }, [user])

  // ── Memoized context values ──────────────────────────────

  const authValue = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    authError,
    sessionExpired,
    isAdmin,
    isSuperAdmin,
    isHotelAdmin,
    isDepartmentManager,
    isStaff,
    hasAccessToDepartment,
    getAccessibleDepartments,
    hasPermission,
    canManage,
    canPerformAction,
    getCapabilities,
    hasCapability
  }), [
    user, loading, authError, sessionExpired,
    isAdmin, isSuperAdmin, isHotelAdmin, isDepartmentManager, isStaff,
    hasAccessToDepartment, getAccessibleDepartments,
    hasPermission, canManage, canPerformAction,
    getCapabilities, hasCapability
  ])

  const actionsValue = useMemo(() => ({
    login, register, logout, updateUser, setUserAndToken, clearAuthError
  }), [login, register, logout, updateUser, setUserAndToken, clearAuthError])

  return (
    <AuthContext.Provider value={authValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const auth = useContext(AuthContext)
  const actions = useContext(AuthActionsContext)
  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return { ...auth, ...actions }
}

export function useAuthActions() {
  const actions = useContext(AuthActionsContext)
  if (!actions) {
    throw new Error('useAuthActions must be used within an AuthProvider')
  }
  return actions
}
