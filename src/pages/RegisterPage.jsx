import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Leaf,
  User,
  Mail,
  Lock,
  Key,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Building2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { Input, TouchButton, ButtonLoader } from '../components/ui'
import { apiFetch } from '../services/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setUserAndToken } = useAuth()
  const { t } = useTranslation()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    login: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    hotelCode: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({})
  const [hotelValidation, setHotelValidation] = useState({
    loading: false,
    valid: null,
    hotel: null
  })

  // Validate hotel code with debounce
  useEffect(() => {
    if (!formData.hotelCode || formData.hotelCode.length < 5) {
      setHotelValidation({ loading: false, valid: null, hotel: null })
      return
    }

    const timer = setTimeout(async () => {
      setHotelValidation({ loading: true, valid: null, hotel: null })
      try {
        const response = await apiFetch(`/auth/validate-hotel-code?code=${formData.hotelCode}`)
        if (response.valid) {
          // Handle both existing hotels and new MARSHA codes
          const hotelInfo =
            response.hotel ||
            (response.marsha
              ? {
                  name: response.marsha.hotelName,
                  code: response.marsha.code,
                  city: response.marsha.city,
                  country: response.marsha.country,
                  brand: response.marsha.brand,
                  isNew: true
                }
              : null)
          setHotelValidation({ loading: false, valid: true, hotel: hotelInfo })
        } else {
          setHotelValidation({ loading: false, valid: false, hotel: null })
        }
      } catch {
        setHotelValidation({ loading: false, valid: false, hotel: null })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.hotelCode])

  // Password strength indicator
  const getPasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 6) strength++
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const strengthLabels = [
    '',
    t('auth.weak'),
    t('auth.fair'),
    t('auth.good'),
    t('auth.strong'),
    t('auth.veryStrong')
  ]
  const strengthColors = [
    'bg-gray-200',
    'bg-danger',
    'bg-warning',
    'bg-warning',
    'bg-success',
    'bg-success'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Email is now required
    if (!formData.email) {
      setError(t('auth.emailRequired') || 'Email обязателен для регистрации')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    if (formData.password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    // Validate hotel code if provided
    if (formData.hotelCode && !hotelValidation.valid) {
      setError(t('auth.invalidHotelCode') || 'Неверный код отеля')
      return
    }

    setIsLoading(true)

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          login: formData.login,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          hotelCode: formData.hotelCode || null
        })
      })

      if (response.success) {
        if (response.needsEmailVerification && response.partialToken) {
          localStorage.setItem('partialToken', response.partialToken)
          localStorage.setItem('pendingEmail', formData.email)
          addToast(t('auth.otpSent') || 'Код отправлен на ваш email', 'success')
          navigate('/verify-email', {
            state: { partialToken: response.partialToken, email: formData.email }
          })
        } else if (response.token && response.user) {
          setUserAndToken(response.user, response.token)
          addToast(t('toast.registerSuccess'), 'success')
          navigate('/pending-approval', { replace: true })
        } else {
          setError(response.error || 'Unexpected response')
        }
      } else {
        setError(response.error)
      }
    } catch (err) {
      setError(err.message || t('toast.registerError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  // Validation errors
  const errors = {
    login: touched.login && !formData.login ? t('validation.required') : '',
    name: touched.name && !formData.name ? t('validation.required') : '',
    email:
      touched.email && !formData.email
        ? t('validation.required')
        : touched.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
          ? t('validation.invalidEmail')
          : '',
    password:
      touched.password && !formData.password
        ? t('validation.required')
        : touched.password && formData.password.length < 6
          ? t('auth.passwordTooShort')
          : '',
    confirmPassword:
      touched.confirmPassword && !formData.confirmPassword
        ? t('validation.required')
        : touched.confirmPassword && formData.password !== formData.confirmPassword
          ? t('validation.passwordMismatch')
          : ''
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-80 h-80 border border-white/20 rounded-full" />
          <div className="absolute bottom-40 left-20 w-48 h-48 border border-accent/30 rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-16 text-cream">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 border border-accent flex items-center justify-center">
                <Leaf className="w-5 h-5 text-accent" />
              </div>
              <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="font-serif text-5xl leading-tight mb-6">
              {t('auth.joinExcellence')}
              <br />
              <span className="text-accent">{t('auth.precisionHighlight')}</span>
            </h1>
            <p className="text-muted-foreground leading-relaxed">{t('auth.joinSubtitle')}</p>
          </div>

          <div />
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-background overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-4">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 border border-foreground flex items-center justify-center">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-3xl mb-2">{t('auth.createAccount')}</h2>
            <p className="text-muted-foreground">{t('auth.joinSubtitle')}</p>
          </div>

          {/* Server error */}
          {error && (
            <div className="flex items-start gap-3 text-danger text-sm bg-danger/10 p-4 rounded-lg animate-fade-in mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Login */}
            <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <Input
                type="text"
                label={t('auth.login') || 'Логин'}
                value={formData.login}
                onChange={(e) => handleChange('login', e.target.value)}
                onBlur={() => handleBlur('login')}
                icon={User}
                error={errors.login}
                autoComplete="username"
              />
            </div>

            {/* Full Name */}
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <Input
                type="text"
                label={t('auth.fullName')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                icon={User}
                error={errors.name}
                autoComplete="name"
              />
            </div>

            {/* Email (required) */}
            <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <Input
                type="email"
                label={t('auth.email')}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                icon={Mail}
                error={errors.email}
                autoComplete="email"
                required
              />
            </div>

            {/* Hotel Code */}
            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="relative">
                <Input
                  type="text"
                  label={t('auth.hotelCode') || 'Код отеля'}
                  value={formData.hotelCode}
                  onChange={(e) => handleChange('hotelCode', e.target.value.toUpperCase())}
                  icon={Key}
                  maxLength={5}
                  autoComplete="off"
                  placeholder="Например: WASSX"
                />
                {hotelValidation.loading && (
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    role="status"
                    aria-label="Проверка"
                  >
                    <ButtonLoader />
                  </div>
                )}
                {hotelValidation.valid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-5 h-5 text-success" />
                  </div>
                )}
                {hotelValidation.valid === false && formData.hotelCode.length >= 5 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AlertCircle className="w-5 h-5 text-danger" />
                  </div>
                )}
              </div>
              {hotelValidation.valid === true && hotelValidation.hotel && (
                <p className="text-success text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <Building2 className="w-3 h-3" />
                  {hotelValidation.hotel.name}
                </p>
              )}
              {hotelValidation.valid === false && formData.hotelCode.length >= 5 && (
                <p className="text-danger text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" />
                  {t('auth.invalidHotelCode') || 'Неверный MARSHA код'}
                </p>
              )}
              <p className="text-muted-foreground text-xs mt-2">
                MARSHA код — 5 символов, например: TSEXR, WASSX, ASTLC
              </p>
            </div>

            {/* Password */}
            <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <Input
                type="password"
                label={t('auth.password')}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                icon={Lock}
                error={errors.password}
                autoComplete="new-password"
              />
              {/* Password strength indicator */}
              {formData.password && (
                <div className="mt-2 animate-fade-in">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordStrength >= level
                            ? strengthColors[passwordStrength]
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {passwordStrength >= 4 && <CheckCircle className="w-3 h-3 text-success" />}
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <Input
                type="password"
                label={t('auth.confirmPassword')}
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                icon={Lock}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              {/* Match indicator */}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="text-success text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <CheckCircle className="w-3 h-3" />
                  {t('auth.passwordsMatch')}
                </p>
              )}
            </div>

            <div className="pt-4 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
              <TouchButton
                type="submit"
                variant="primary"
                size="large"
                loading={isLoading}
                fullWidth
                icon={ArrowRight}
                iconPosition="right"
              >
                {t('auth.createAccount')}
              </TouchButton>
            </div>

            <div className="text-center animate-fade-in-up" style={{ animationDelay: '350ms' }}>
              <span className="text-muted-foreground text-sm">{t('auth.haveAccount')} </span>
              <Link
                to="/login"
                className="text-foreground text-sm font-medium hover:text-accent transition-colors underline-offset-4 hover:underline"
              >
                {t('auth.signIn')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
