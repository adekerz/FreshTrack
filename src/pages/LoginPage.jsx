import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Leaf,
  ShieldCheck,
  Bell,
  BarChart3,
  ArrowRight,
  User,
  Lock,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { Input, TouchButton, ButtonLoader } from '../components/ui'
import { API_BASE_URL } from '../services/api'
import CodeInput from '../components/ui/CodeInput'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({ identifier: false, password: false })

  // Login page branding from backend
  const [loginBranding, setLoginBranding] = useState(null)
  const [brandingLoading, setBrandingLoading] = useState(true)

  // Load login branding on mount (public endpoint, no auth)
  useEffect(() => {
    const loadLoginBranding = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/settings/login-branding`)
        const data = await response.json()
        if (data.success && data.loginBranding) {
          setLoginBranding(data.loginBranding)
        }
      } catch (error) {
        console.error('Failed to load login branding:', error)
        // Use defaults on error
      } finally {
        setBrandingLoading(false)
      }
    }
    loadLoginBranding()
  }, [])

  // Branding values with fallback to locale
  const brandingTitle = loginBranding?.title || t('auth.precisionTitle')
  const brandingHighlight = loginBranding?.highlight || t('auth.precisionHighlight')
  const brandingDescription = loginBranding?.description || t('auth.precisionDescription')
  const brandingFeature1 = loginBranding?.feature1 || t('auth.secure')
  const brandingFeature2 = loginBranding?.feature2 || t('auth.smartAlerts')
  const brandingFeature3 = loginBranding?.feature3 || t('auth.analytics')
  const brandingSiteName = loginBranding?.siteName || t('common.appName')

  const [mfaStep, setMfaStep] = useState(false)
  const [partialToken, setPartialToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await login(identifier, password)

    if (result.success) {
      // Check if MFA is required
      if (result.requiresMFA) {
        setPartialToken(result.partialToken)
        setMfaStep(true)
        setIsLoading(false)
        return
      }

      if (result.mustChangePassword) {
        // Redirect to change password page for first login
        navigate('/change-password', { 
          state: { firstLogin: true, email: result.email || identifier } 
        })
      } else {
        addToast(t('toast.loginSuccess'), 'success')
        navigate('/')
      }
    } else {
      setError(result.error || t('auth.invalidCredentials'))
      addToast(t('toast.loginError'), 'error')
    }

    setIsLoading(false)
  }

  const handleMFAVerify = async () => {
    if (!mfaCode || (useBackup ? mfaCode.length < 8 : mfaCode.length !== 6)) {
      setError(useBackup ? 'Backup code must be 8 characters' : 'Code must be 6 digits')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          partialToken, 
          code: mfaCode, 
          useBackup 
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Verification failed')
      }

      // Store token and user
      localStorage.setItem('freshtrack_token', data.token)
      localStorage.setItem('freshtrack_user', JSON.stringify(data.user))
      
      // Reload page to update auth context
      window.location.href = '/'
    } catch (error) {
      setError(error.message || 'Verification failed')
      setMfaCode('')
      addToast(error.message || 'Verification failed', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  // Inline validation
  const identifierError = touched.identifier && !identifier ? t('validation.required') : ''
  const passwordError = touched.password && !password ? t('validation.required') : ''

  // MFA verification step
  if (mfaStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-3xl mb-2 text-foreground">Two-Factor Authentication</h2>
            <p className="text-muted-foreground">Enter code from your authenticator app:</p>
          </div>

          {error && (
            <div className="flex items-start gap-3 text-danger text-sm bg-danger/10 p-4 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex justify-center">
              {!useBackup ? (
                <CodeInput
                  onComplete={(code) => {
                    setMfaCode(code)
                    handleMFAVerify()
                  }}
                  disabled={isLoading}
                />
              ) : (
                <input
                  type="text"
                  placeholder="Enter 8-character backup code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground"
                />
              )}
            </div>

            <div className="text-center">
              <button
                onClick={() => setUseBackup(!useBackup)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {useBackup ? 'Use authenticator code' : 'Use backup code instead'}
              </button>
            </div>


            <TouchButton
              onClick={handleMFAVerify}
              variant="primary"
              size="large"
              loading={isLoading}
              fullWidth
            >
              Verify
            </TouchButton>

            <button
              onClick={() => {
                setMfaStep(false)
                setMfaCode('')
                setPartialToken('')
                setError('')
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 border border-white/20 rounded-full" />
          <div className="absolute bottom-20 right-20 w-64 h-64 border border-white/20 rounded-full" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 border border-accent/30 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-16 text-cream">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 border border-accent flex items-center justify-center">
                <Leaf className="w-5 h-5 text-accent" />
              </div>
              <span className="font-serif text-2xl tracking-wide">{brandingSiteName}</span>
            </div>
            <p className="text-muted-foreground text-sm">{t('common.tagline')}</p>
          </div>

          <div className="max-w-md">
            {brandingLoading ? (
              <div
                className="flex items-center gap-2 text-muted-foreground"
                role="status"
                aria-label="Загрузка"
              >
                <ButtonLoader />
              </div>
            ) : (
              <>
                <h1 className="font-serif text-5xl leading-tight mb-6">
                  {brandingTitle}
                  <br />
                  <span className="text-accent">{brandingHighlight}</span>
                </h1>
                <p className="text-muted-foreground leading-relaxed">{brandingDescription}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{brandingFeature1}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span>{brandingFeature2}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>{brandingFeature3}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background transition-colors duration-300">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 border border-charcoal dark:border-accent flex items-center justify-center">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            <span className="font-serif text-2xl tracking-wide text-foreground">
              {brandingSiteName}
            </span>
          </div>

          <div className="mb-10">
            <h2 className="font-serif text-3xl mb-2 text-foreground">{t('auth.welcomeBack')}</h2>
            <p className="text-muted-foreground">{t('auth.signInSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Server error */}
            {error && (
              <div className="flex items-start gap-3 text-danger text-sm bg-danger/10 p-4 rounded-lg animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <Input
                type="text"
                label={t('auth.loginOrEmail')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => handleBlur('identifier')}
                icon={User}
                error={identifierError}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <Input
                type="password"
                label={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur('password')}
                icon={Lock}
                error={passwordError}
                autoComplete="current-password"
              />
            </div>

            <div className="animate-fade-in-up pt-2" style={{ animationDelay: '300ms' }}>
              <TouchButton
                type="submit"
                variant="primary"
                size="large"
                loading={isLoading}
                fullWidth
                icon={ArrowRight}
                iconPosition="right"
              >
                {t('auth.signIn')}
              </TouchButton>
            </div>

            <div
              className="animate-fade-in-up text-center pt-2"
              style={{ animationDelay: '400ms' }}
            >
              <span className="text-muted-foreground text-sm">{t('auth.noAccount')} </span>
              <Link
                to="/register"
                className="text-foreground text-sm font-medium hover:text-accent transition-colors underline-offset-4 hover:underline"
              >
                {t('auth.createAccount')}
              </Link>
            </div>
          </form>

          <div className="mt-12 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">{t('auth.demoCredentials')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
