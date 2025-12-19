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
    try {
      const currentToken = token || localStorage.getItem('freshtrack_token')
      if (currentToken) {
        await fetch('http://localhost:3001/api/auth/logout', {
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
   * Check if user is admin
   */
  const isAdmin = () => {
    const role = user?.role?.toLowerCase()
    return role === 'admin' || role === 'administrator' || role === 'super_admin'
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

  /**
   * Check permission
   */
  const hasPermission = (permission) => {
    if (!user) return false
    if (isAdmin()) return true
    
    const userPermissions = user.permissions || []
    if (userPermissions.includes('*')) return true
    
    return userPermissions.some(p => {
      if (p === permission) return true
      if (p.endsWith('.*')) {
        const prefix = p.slice(0, -2)
        return permission.startsWith(prefix)
      }
      return false
    })
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
    hasAccessToDepartment,
    getAccessibleDepartments,
    updateUser,
    hasPermission
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
