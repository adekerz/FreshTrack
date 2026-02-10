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
    // MFA баннер отключён на dev (VITE_DISABLE_MFA_IN_DEV=true в .env.local)
    if (import.meta.env.VITE_DISABLE_MFA_IN_DEV === 'true') return

    // Only show for specific roles
    const requiredRoles = ['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']
    if (!user || !requiredRoles.includes(user.role)) {
      console.log('[MFA Banner] Not showing - user role not required:', user?.role)
      return
    }

    console.log('[MFA Banner] Checking MFA status for:', user.role)

    // Check MFA status from API
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/mfa/status`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) return

        const data = await response.json()
        if (data.mfaDisabledInDev) return

        // Показываем баннер если MFA не включен
        if (data.success && !data.enabled) {
          setGraceInfo({
            daysLeft: data.gracePeriodDaysLeft, // Может быть null
            gracePeriodEnds: data.gracePeriodEnds
          })
        } else {
          setGraceInfo(null)
        }
      } catch (error) {
        console.error('[MFA Banner] Failed to check MFA status', error)
      }
    }

    checkStatus()

    const handleMFAEnabled = () => {
      setGraceInfo(null)
      setTimeout(checkStatus, 1000)
    }

    window.addEventListener('auth:mfaEnabled', handleMFAEnabled)
    const interval = setInterval(checkStatus, 60 * 60 * 1000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('auth:mfaEnabled', handleMFAEnabled)
    }
  }, [user])

  const requiredRoles = ['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']
  if (!graceInfo || !user || !requiredRoles.includes(user.role)) {
    return null
  }

  const handleSetupClick = () => {
    navigate('/mfa-setup') // Или /settings/security
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 dark:bg-yellow-900/10 dark:border-yellow-600">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400 dark:text-yellow-600"
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
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Требуется настройка двухфакторной аутентификации (MFA)
          </h3>
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            <p className="mb-2">
              Для обеспечения безопасности вашего аккаунта необходимо включить MFA.
              {graceInfo.daysLeft !== null && graceInfo.daysLeft > 0 && (
                <span> У вас осталоcь <strong>{graceInfo.daysLeft} дней</strong> до блокировки доступа.</span>
              )}
            </p>
            <div className="bg-yellow-100/50 dark:bg-yellow-900/20 p-3 rounded-md mb-3">
              <p className="font-semibold mb-1">Как настроить:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Нажмите кнопку <strong>Настроить MFA</strong> ниже.</li>
                <li>Скачайте приложение (Google Authenticator, Authy и др.).</li>
                <li>Отсканируйте QR-код в приложении.</li>
                <li>Введите код подтверждения.</li>
              </ol>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleSetupClick}
              className="bg-yellow-400 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
            >
              Настроить MFA сейчас
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
