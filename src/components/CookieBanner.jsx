/**
 * Cookie Banner Component
 * Displays a cookie consent banner at the bottom of the page.
 * Stores consent in localStorage with a 1-year expiration.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, Check, Settings } from 'lucide-react'
import { TouchButton } from './ui'
import { cn } from '../utils/classNames'

const COOKIE_CONSENT_KEY = 'cookie_consent'
const COOKIE_CONSENT_VERSION = '1.0'

// Check if consent is valid (not expired and correct version)
function isConsentValid() {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return false

    const consent = JSON.parse(stored)

    // Check version
    if (consent.version !== COOKIE_CONSENT_VERSION) return false

    // Check expiration (1 year)
    const expirationDate = new Date(consent.timestamp)
    expirationDate.setFullYear(expirationDate.getFullYear() + 1)

    if (new Date() > expirationDate) {
      localStorage.removeItem(COOKIE_CONSENT_KEY)
      return false
    }

    return consent.accepted
  } catch (error) {
    return false
  }
}

// Save consent to localStorage
function saveConsent(accepted) {
  const consent = {
    accepted,
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString()
  }
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
}

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Small delay to prevent flash on page load
    const timer = setTimeout(() => {
      setIsVisible(!isConsentValid())
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const handleAccept = () => {
    saveConsent(true)
    setIsVisible(false)
  }

  const handleDecline = () => {
    // Even if declined, we need to store that decision
    saveConsent(false)
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6',
        'animate-slide-up'
      )}
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Main content */}
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Cookie className="w-5 h-5 text-accent" />
              </div>

              <div className="flex-1 min-w-0">
                <h2
                  id="cookie-banner-title"
                  className="text-lg font-semibold text-foreground mb-2"
                >
                  Мы используем cookies
                </h2>
                <p
                  id="cookie-banner-description"
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  Для работы системы FreshTrack необходимы файлы cookie. Мы используем их для
                  авторизации, сохранения настроек темы и языка. Мы не передаём данные третьим
                  лицам для рекламных целей.{' '}
                  <Link
                    to="/privacy"
                    className="text-accent hover:underline"
                  >
                    Подробнее в Политике конфиденциальности
                  </Link>
                </p>

                {/* Details section */}
                {showDetails && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                      Используемые cookies:
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>freshtrack_token</strong> — авторизация (обязательный)
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>freshtrack_theme</strong> — тема оформления
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>freshtrack_lang</strong> — язык интерфейса
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-foreground">
                          <strong>cookie_consent</strong> — ваше согласие
                        </span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-6">
              <TouchButton
                variant="primary"
                onClick={handleAccept}
                icon={Check}
                iconPosition="left"
                className="flex-1 sm:flex-none"
              >
                Принять все
              </TouchButton>

              <TouchButton
                variant="outline"
                onClick={handleDecline}
                className="flex-1 sm:flex-none"
              >
                Только необходимые
              </TouchButton>

              <TouchButton
                variant="ghost"
                size="small"
                onClick={() => setShowDetails(!showDetails)}
                icon={Settings}
                iconPosition="left"
                className="text-muted-foreground"
              >
                {showDetails ? 'Скрыть детали' : 'Подробнее'}
              </TouchButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export utility function to check consent
export function hasCookieConsent() {
  return isConsentValid()
}

// Export utility function to reset consent (for testing or settings)
export function resetCookieConsent() {
  localStorage.removeItem(COOKIE_CONSENT_KEY)
}
