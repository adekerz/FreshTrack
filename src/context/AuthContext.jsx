/**
 * FreshTrack Enterprise Auth Context
 * Clean authentication - NO demo users
 */

import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'
import { logError } from '../utils/logger'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)
  const [authError, setAuthError] = useState(null)

  // Listen for global auth events (401/403 from api.js)
  useEffect(() => {
    const handleUnauthorized = (event) => {
      console.warn('[Auth] Unauthorized event received:', event.detail)
      // Clear auth state
      localStorage.removeItem('freshtrack_user')
      localStorage.removeItem('freshtrack_token')
      setToken(null)
      setUser(null)
      setAuthError({ type: 'unauthorized', message: event.detail?.message })
    }

    const handleForbidden = (event) => {
      console.warn('[Auth] Forbidden event received:', event.detail)
      setAuthError({ type: 'forbidden', message: event.detail?.message, url: event.detail?.url })
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    window.addEventListener('auth:forbidden', handleForbidden)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
      window.removeEventListener('auth:forbidden', handleForbidden)
    }
  }, [])

  // Clear auth error after a delay
  useEffect(() => {
    if (authError) {
      const timer = setTimeout(() => setAuthError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [authError])

  // Validate token and refresh user data on mount
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = localStorage.getItem('freshtrack_user')
      const savedToken = localStorage.getItem('freshtrack_token')

      if (savedUser && savedToken) {
        try {
          // Set token first for API calls
          setToken(savedToken)

          // Fetch fresh user data from server
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${savedToken}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            if (data.user) {
              // Update with fresh data from server
              setUser(data.user)
              localStorage.setItem('freshtrack_user', JSON.stringify(data.user))
            } else {
              // Fallback to cached user if server returns no user
              setUser(JSON.parse(savedUser))
            }
          } else if (response.status === 401) {
            // Token expired or invalid - logout
            localStorage.removeItem('freshtrack_user')
            localStorage.removeItem('freshtrack_token')
            setToken(null)
            setUser(null)
          } else {
            // Server error - use cached data
            setUser(JSON.parse(savedUser))
          }
        } catch (e) {
          // Network error - use cached data
          console.warn('[Auth] Failed to refresh user, using cached data:', e.message)
          try {
            setUser(JSON.parse(savedUser))
          } catch {
            localStorage.removeItem('freshtrack_user')
            localStorage.removeItem('freshtrack_token')
          }
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  /**
   * Login - supports email OR username
   */
  const login = async (identifier, password) => {
    try {
      const response = await authAPI.login(identifier, password)

      // API returns { user, token } on success
      if (response.user && response.token) {
        const userData = response.user
        setUser(userData)
        setToken(response.token)
        localStorage.setItem('freshtrack_user', JSON.stringify(userData))
        localStorage.setItem('freshtrack_token', response.token)
        return { success: true }
      }

      return { success: false, error: response.error || 'Invalid credentials' }
    } catch (error) {
      logError('Login error:', error.message)
      // Передаём сообщение об ошибке от сервера (например, "Account is blocked")
      return {
        success: false,
        error: error.message || 'Unable to connect to server. Please check your connection.'
      }
    }
  }

  /**
   * Register new user
   */
  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData)

      if (response.success) {
        const newUser = response.user
        setUser(newUser)
        setToken(response.token)
        localStorage.setItem('freshtrack_user', JSON.stringify(newUser))
        localStorage.setItem('freshtrack_token', response.token)
        return { success: true }
      }

      return { success: false, error: response.error }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' }
    }
  }

  /**
   * Logout
   */
  const logout = async () => {
    // Log logout on server
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
    try {
      const currentToken = token || localStorage.getItem('freshtrack_token')
      if (currentToken) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        })
      }
    } catch (error) {
      console.log('Logout logging skipped:', error.message)
    }

    setUser(null)
    setToken(null)
    localStorage.removeItem('freshtrack_user')
    localStorage.removeItem('freshtrack_token')
    // Очистка кэша данных при выходе
    localStorage.removeItem('freshtrack_catalog')
    // Очистка выбранного отеля при выходе (важно для переключения между пользователями)
    localStorage.removeItem('freshtrack_selected_hotel')
  }

  /**
   * Check if user has a specific permission
   * Permission format: 'resource:action' (e.g., 'products:delete', 'settings:manage')
   * Supports wildcard permissions: '*' for full access, 'resource:*' for all actions on resource
   */
  const hasPermission = (permission) => {
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
  }

  /**
   * Check if user is admin (HOTEL_ADMIN or SUPER_ADMIN)
   * Uses backend capabilities when available, falls back to role check
   */
  const isAdmin = () => {
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
  }

  /**
   * Check if user is super admin
   * Uses backend capabilities when available
   */
  const isSuperAdmin = () => {
    if (user?.capabilities?.isSuperAdmin !== undefined) {
      return user.capabilities.isSuperAdmin
    }
    return user?.role?.toUpperCase() === 'SUPER_ADMIN'
  }

  /**
   * Check if user is hotel admin or super admin
   * Uses backend capabilities when available
   */
  const isHotelAdmin = () => {
    if (user?.capabilities?.isAdmin !== undefined) {
      return user.capabilities.isAdmin
    }
    const role = user?.role?.toUpperCase()
    return role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
  }

  /**
   * Check if user is department manager
   */
  const isDepartmentManager = () => {
    return user?.role?.toUpperCase() === 'DEPARTMENT_MANAGER'
  }

  /**
   * Check if user is staff
   */
  const isStaff = () => {
    return user?.role?.toUpperCase() === 'STAFF'
  }

  /**
   * Get user capabilities object from backend
   * Returns empty object if not available
   */
  const getCapabilities = () => {
    return user?.capabilities || {}
  }

  /**
   * Check specific capability
   */
  const hasCapability = (capability) => {
    return user?.capabilities?.[capability] === true
  }

  /**
   * Check if user can manage a resource (has manage or specific action permission)
   */
  const canManage = (resource) => {
    return hasPermission(`${resource}:manage`) || isAdmin()
  }

  /**
   * Check if user can perform action on resource
   */
  const canPerformAction = (resource, action) => {
    return hasPermission(`${resource}:${action}`)
  }

  /**
   * Check if user has access to department
   */
  const hasAccessToDepartment = (departmentId) => {
    if (!user) return false
    if (isAdmin()) return true
    return user.departments?.includes(departmentId)
  }

  /**
   * Get user's accessible departments
   */
  const getAccessibleDepartments = () => {
    if (!user) return []
    return user.departments || []
  }

  /**
   * Update user data
   */
  const updateUser = (userData) => {
    const updatedUser = { ...user, ...userData }
    setUser(updatedUser)
    localStorage.setItem('freshtrack_user', JSON.stringify(updatedUser))
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    authError,
    clearAuthError: () => setAuthError(null),
    login,
    register,
    logout,
    isAdmin,
    isSuperAdmin,
    isHotelAdmin,
    isDepartmentManager,
    isStaff,
    hasAccessToDepartment,
    getAccessibleDepartments,
    updateUser,
    hasPermission,
    canManage,
    canPerformAction,
    // New capability-based methods
    getCapabilities,
    hasCapability
  }

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
