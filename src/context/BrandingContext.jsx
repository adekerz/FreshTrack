/**
 * FreshTrack Branding Context
 * Real-time branding updates via SSE
 * 
 * Features:
 * - Load branding from backend on start
 * - Real-time updates via SSE
 * - CSS variables for theming
 * - Logo, site name, colors
 * 
 * Backend = Single Source of Truth
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSSE, SSE_EVENTS } from '../hooks/useSSE'
import { apiFetch } from '../services/api'
import { useAuth } from './AuthContext'

// Default branding (fallback only)
const DEFAULT_BRANDING = {
  siteName: 'FreshTrack',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#FF8D6B',     // --primary
  secondaryColor: '#4A7C59',   // --success
  accentColor: '#F59E0B',      // --warning
  dangerColor: '#C4554D',      // --danger
  footerText: '© 2024 FreshTrack',
  customCss: null
}

const BrandingContext = createContext(null)

/**
 * Apply branding to CSS variables
 */
function applyBrandingToCSS(branding) {
  const root = document.documentElement
  
  if (branding.primaryColor) {
    // Convert hex to RGB for CSS variables
    const rgb = hexToRgb(branding.primaryColor)
    if (rgb) {
      root.style.setProperty('--branding-primary', branding.primaryColor)
      root.style.setProperty('--primary', `${rgb.r} ${rgb.g} ${rgb.b}`)
    }
  }
  
  if (branding.secondaryColor) {
    const rgb = hexToRgb(branding.secondaryColor)
    if (rgb) {
      root.style.setProperty('--branding-secondary', branding.secondaryColor)
    }
  }
  
  if (branding.accentColor) {
    const rgb = hexToRgb(branding.accentColor)
    if (rgb) {
      root.style.setProperty('--branding-accent', branding.accentColor)
    }
  }

  if (branding.dangerColor) {
    const rgb = hexToRgb(branding.dangerColor)
    if (rgb) {
      root.style.setProperty('--branding-danger', branding.dangerColor)
      root.style.setProperty('--danger', `${rgb.r} ${rgb.g} ${rgb.b}`)
    }
  }

  // Apply custom CSS if provided
  if (branding.customCss) {
    let styleEl = document.getElementById('freshtrack-custom-css')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'freshtrack-custom-css'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = branding.customCss
  }

  // Update favicon if provided
  if (branding.faviconUrl) {
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link')
    link.rel = 'icon'
    link.href = branding.faviconUrl
    document.head.appendChild(link)
  }

  // Update page title with site name
  if (branding.siteName) {
    const baseTitle = document.title.split(' | ').pop() || 'Dashboard'
    document.title = `${branding.siteName} | ${baseTitle}`
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  if (!hex) return null
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

export function BrandingProvider({ children }) {
  const { user } = useAuth()
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Handle SSE branding update
  const handleBrandingUpdate = useCallback((data) => {
    console.log('[Branding] SSE update received:', data)
    
    if (data.settings) {
      const newBranding = { ...branding, ...data.settings }
      setBranding(newBranding)
      applyBrandingToCSS(newBranding)
      setLastUpdate({
        timestamp: data.timestamp || new Date().toISOString(),
        updatedBy: data.updatedBy || 'system'
      })
    }
  }, [branding])

  // Handle settings update (may include branding keys)
  const handleSettingsUpdate = useCallback((data) => {
    const brandingKeys = ['siteName', 'logoUrl', 'faviconUrl', 'primaryColor', 
                         'secondaryColor', 'accentColor', 'dangerColor', 
                         'footerText', 'customCss']
    
    if (data.key && brandingKeys.includes(data.key)) {
      setBranding(prev => {
        const updated = { ...prev, [data.key]: data.value }
        applyBrandingToCSS(updated)
        return updated
      })
    }
  }, [])

  // SSE connection
  const { isConnected, connectionInfo } = useSSE({
    enabled: !!user,
    handlers: {
      onBrandingUpdate: handleBrandingUpdate,
      onSettingsUpdate: handleSettingsUpdate
    }
  })

  // Load branding on mount
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadBranding = async () => {
      try {
        setLoading(true)
        const response = await apiFetch('/settings/branding')
        
        if (response.success && response.branding) {
          const serverBranding = { ...DEFAULT_BRANDING, ...response.branding }
          setBranding(serverBranding)
          applyBrandingToCSS(serverBranding)
        }
      } catch (err) {
        console.error('[Branding] Failed to load:', err)
        setError(err.message)
        // Apply defaults on error
        applyBrandingToCSS(DEFAULT_BRANDING)
      } finally {
        setLoading(false)
      }
    }

    loadBranding()
  }, [user])

  // Save branding to backend
  const updateBranding = useCallback(async (updates) => {
    try {
      const response = await apiFetch('/settings/branding', {
        method: 'PUT',
        body: JSON.stringify(updates)
      })

      if (response.success) {
        // Optimistic update (SSE will confirm)
        const newBranding = { ...branding, ...updates }
        setBranding(newBranding)
        applyBrandingToCSS(newBranding)
        return { success: true }
      }

      return { success: false, error: response.error }
    } catch (err) {
      console.error('[Branding] Failed to update:', err)
      return { success: false, error: err.message }
    }
  }, [branding])

  // Reset to defaults
  const resetBranding = useCallback(async () => {
    try {
      const response = await apiFetch('/settings/branding/reset', {
        method: 'POST'
      })

      if (response.success) {
        setBranding(DEFAULT_BRANDING)
        applyBrandingToCSS(DEFAULT_BRANDING)
        return { success: true }
      }

      return { success: false, error: response.error }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  const value = {
    // State
    branding,
    loading,
    error,
    lastUpdate,
    
    // SSE status
    isConnected,
    connectionInfo,
    
    // Actions
    updateBranding,
    resetBranding,
    
    // Helpers
    siteName: branding.siteName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor
  }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider')
  }
  return context
}

export default BrandingContext
