/**
 * FreshTrack Enterprise Auth Context
 * Clean authentication - NO demo users
 */

import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    // Check saved user in localStorage
    const savedUser = localStorage.getItem('freshtrack_user')
    const savedToken = localStorage.getItem('freshtrack_token')

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser))
        setToken(savedToken)
      } catch (e) {
        // Invalid data in localStorage
        localStorage.removeItem('freshtrack_user')
        localStorage.removeItem('freshtrack_token')
      }
    }
    setLoading(false)
  }, [])

  /**
   * Login - supports email OR username
   */
  const login = async (identifier, password) => {
    try {
      const response = await authAPI.login(identifier, password)

      if (response.success) {
        const userData = response.user
        setUser(userData)
        setToken(response.token)
        localStorage.setItem('freshtrack_user', JSON.stringify(userData))
        localStorage.setItem('freshtrack_token', response.token)
        return { success: true }
      }

      return { success: false, error: response.error || 'Invalid credentials' }
    } catch (error) {
      console.error('Login error:', error.message)
      return { 
        success: false, 
        error: 'Unable to connect to server. Please check your connection.' 
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
   * @deprecated Prefer using hasPermission() for granular checks
   */
  const isAdmin = () => {
    const role = user?.role?.toUpperCase()
    return role === 'ADMIN' || role === 'ADMINISTRATOR' || role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
  }

  /**
   * Check if user is super admin
   * @deprecated Prefer using hasPermission() for granular checks
   */
  const isSuperAdmin = () => {
    return user?.role?.toUpperCase() === 'SUPER_ADMIN'
  }

  /**
   * Check if user is hotel admin or super admin
   * @deprecated Prefer using hasPermission() for granular checks
   */
  const isHotelAdmin = () => {
    const role = user?.role?.toUpperCase()
    return role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
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
    login,
    register,
    logout,
    isAdmin,
    isSuperAdmin,
    isHotelAdmin,
    hasAccessToDepartment,
    getAccessibleDepartments,
    updateUser,
    hasPermission,
    canManage,
    canPerformAction
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
