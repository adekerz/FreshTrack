import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

// Системные пользователи для демо (fallback если backend недоступен)
const systemUsers = [
  {
    id: 1,
    login: 'admin',
    email: 'admin@ritzcarlton.com',
    password: 'AdminRC2025!',
    name: 'Administrator',
    role: 'admin',
    departments: ['honor-bar', 'mokki-bar', 'ozen-bar']
  },
  {
    id: 2,
    login: 'honorbar',
    email: 'honorbar@ritzcarlton.com',
    password: 'Honor2025RC!',
    name: 'Honor Bar Manager',
    role: 'manager',
    departments: ['honor-bar']
  },
  {
    id: 3,
    login: 'mokkibar',
    email: 'mokkibar@ritzcarlton.com',
    password: 'Mokki2025RC!',
    name: 'Mokki Bar Manager',
    role: 'manager',
    departments: ['mokki-bar']
  },
  {
    id: 4,
    login: 'ozenbar',
    email: 'ozenbar@ritzcarlton.com',
    password: 'Ozen2025RC!',
    name: 'Ozen Bar Manager',
    role: 'manager',
    departments: ['ozen-bar']
  }
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    // Проверяем сохранённого пользователя в localStorage
    const savedUser = localStorage.getItem('freshtrack_user')
    const savedToken = localStorage.getItem('freshtrack_token')

    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
      setToken(savedToken)
    }
    setLoading(false)
  }, [])

  /**
   * Вход в систему
   * Поддерживает вход по email ИЛИ логину
   */
  const login = async (identifier, password) => {
    try {
      // Пробуем через API
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
      console.warn('API login failed, trying local auth:', error.message)

      // Fallback на локальную авторизацию
      return localLogin(identifier, password)
    }
  }

  /**
   * Локальная авторизация (fallback если backend недоступен)
   */
  const localLogin = (identifier, password) => {
    // Определяем, это email или логин
    const isEmail = identifier.includes('@')

    const foundUser = systemUsers.find((u) => {
      if (isEmail) {
        return u.email === identifier && u.password === password
      }
      return u.login === identifier && u.password === password
    })

    if (foundUser) {
      // eslint-disable-next-line no-unused-vars
      const { password: _unused, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      localStorage.setItem('freshtrack_user', JSON.stringify(userWithoutPassword))
      return { success: true }
    }

    return {
      success: false,
      error: 'Неверные данные. Попробуйте admin / AdminRC2025!'
    }
  }

  /**
   * Регистрация нового пользователя
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
      return { success: false, error: 'Registration failed' }
    }
  }

  /**
   * Выход из системы
   */
  const logout = async () => {
    // Логируем выход на сервере (игнорируем ошибки)
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
   * Проверка, является ли пользователь админом
   */
  const isAdmin = () => {
    return user?.role === 'admin'
  }

  /**
   * Проверка, имеет ли пользователь доступ к отделу
   */
  const hasAccessToDepartment = (departmentId) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.departments?.includes(departmentId)
  }

  /**
   * Получить доступные отделы пользователя
   */
  const getAccessibleDepartments = () => {
    if (!user) return []
    return user.departments || []
  }

  /**
   * Обновить данные пользователя
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
    hasAccessToDepartment,
    getAccessibleDepartments,
    updateUser
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
