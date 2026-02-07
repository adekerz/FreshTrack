import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const ThemeContext = createContext(null)

// Available themes
export const themes = [
  { id: 'light', name: 'Light', icon: 'Sun' },
  { id: 'dark', name: 'Dark', icon: 'Moon' },
  { id: 'system', name: 'System', icon: 'Monitor' }
]

const STORAGE_KEY = 'freshtrack_theme'
const HIGH_CONTRAST_KEY = 'freshtrack_high_contrast'

export function ThemeProvider({ children }) {
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      return saved
    }
    return 'system'
  })

  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(HIGH_CONTRAST_KEY) === 'true'
  })

  // Get the actual theme (resolving 'system' to light/dark)
  const [resolvedTheme, setResolvedTheme] = useState('light')

  // Update resolved theme based on system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light')
      } else {
        setResolvedTheme(theme)
      }
    }

    updateResolvedTheme()
    mediaQuery.addEventListener('change', updateResolvedTheme)
    
    return () => mediaQuery.removeEventListener('change', updateResolvedTheme)
  }, [theme])

  // Apply theme to document
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
    
    // Add/remove dark class on html element
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#1A1A1A' : '#FAF8F5')
    }
  }, [theme, resolvedTheme])

  // High contrast mode (a11y)
  useEffect(() => {
    localStorage.setItem(HIGH_CONTRAST_KEY, highContrast ? 'true' : 'false')
    if (highContrast) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }, [highContrast])

  const toggleHighContrast = useCallback(() => {
    setHighContrast(prev => !prev)
  }, [])

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'light'
      // If system, toggle to opposite of current resolved
      return resolvedTheme === 'dark' ? 'light' : 'dark'
    })
  }, [resolvedTheme])

  // Set specific theme
  const changeTheme = useCallback((newTheme) => {
    if (['light', 'dark', 'system'].includes(newTheme)) {
      setTheme(newTheme)
    }
  }, [])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    toggleTheme,
    changeTheme,
    highContrast,
    toggleHighContrast,
  }), [theme, resolvedTheme, toggleTheme, changeTheme, highContrast, toggleHighContrast])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export default ThemeContext
