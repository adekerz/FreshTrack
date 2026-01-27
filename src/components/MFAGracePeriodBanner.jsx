/**
 * MFA Grace Period Banner
 * Displays warning to SUPER_ADMIN users about MFA requirement
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../services/api'

export default function MFAGracePeriodBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [graceInfo, setGraceInfo] = useState(null)
  
  useEffect(() => {
    // Only show for SUPER_ADMIN
    if (!user || user.role !== 'SUPER_ADMIN') {
      console.log('[MFA Banner] Not showing - user:', user?.role)
      return
    }
    
    console.log('[MFA Banner] Checking grace period for SUPER_ADMIN:', user.id)
    
    // Check MFA status from API
    const checkGracePeriod = async () => {
      try {
        const token = localStorage.getItem('freshtrack_token')
        if (!token) {
          console.log('[MFA Banner] No token found')
          return
        }
        
        const response = await fetch(`${API_BASE_URL}/auth/mfa/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.log('[MFA Banner] API response not OK:', response.status)
          return
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('[MFA Banner] Received non-JSON response:', text.substring(0, 200))
          return
        }
        
        const data = await response.json()
        console.log('[MFA Banner] API response:', data)
        console.log('[MFA Banner] Grace period check:', {
          success: data.success,
          daysLeft: data.gracePeriodDaysLeft,
          gracePeriodEnds: data.gracePeriodEnds,
          mfaEnabled: data.enabled,
          mfaRequired: data.required,
          condition: data.success && !data.enabled && data.gracePeriodDaysLeft !== null && data.gracePeriodDaysLeft > 0
        })
        
        // Показываем баннер только если:
        // 1. MFA еще не включен (data.enabled === false)
        // 2. Grace period активен (daysLeft > 0)
        if (data.success && !data.enabled && data.gracePeriodDaysLeft !== null && data.gracePeriodDaysLeft > 0) {
          console.log('[MFA Banner] ✅ Setting grace info:', {
            daysLeft: data.gracePeriodDaysLeft,
            gracePeriodEnds: data.gracePeriodEnds
          })
          setGraceInfo({
            daysLeft: data.gracePeriodDaysLeft,
            gracePeriodEnds: data.gracePeriodEnds
          })
        } else {
          // Скрываем баннер если MFA включен или grace period истек
          console.log('[MFA Banner] ❌ Hiding banner:', {
            success: data.success,
            mfaEnabled: data.enabled,
            daysLeft: data.gracePeriodDaysLeft,
            daysLeftType: typeof data.gracePeriodDaysLeft,
            reason: !data.success ? 'success=false' : 
                    data.enabled ? 'MFA already enabled' :
                    data.gracePeriodDaysLeft === null ? 'daysLeft is null' :
                    data.gracePeriodDaysLeft <= 0 ? `daysLeft=${data.gracePeriodDaysLeft} (<=0)` : 'unknown'
          })
          setGraceInfo(null) // Явно скрываем баннер
        }
      } catch (error) {
        console.error('[MFA Banner] Failed to check MFA grace period', error)
      }
    }
    
    checkGracePeriod()
    
    // Listen for MFA enabled event
    const handleMFAEnabled = () => {
      console.log('[MFA Banner] MFA enabled event received, hiding banner')
      setGraceInfo(null)
      // Re-check status to ensure it's updated
      setTimeout(checkGracePeriod, 1000)
    }
    
    window.addEventListener('auth:mfaEnabled', handleMFAEnabled)
    
    // Check periodically (every hour)
    const interval = setInterval(checkGracePeriod, 60 * 60 * 1000)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('auth:mfaEnabled', handleMFAEnabled)
    }
  }, [user])
  
  if (!graceInfo || !user || user.role !== 'SUPER_ADMIN') {
    return null
  }
  
  const handleSetupClick = () => {
    navigate('/mfa-setup')
  }
  
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            MFA Setup Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              You have <strong>{graceInfo.daysLeft} day{graceInfo.daysLeft !== 1 ? 's' : ''}</strong> to enable 
              two-factor authentication. After this period, you will not be able to access critical features 
              without MFA.
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleSetupClick}
              className="bg-yellow-400 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Set up MFA now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
