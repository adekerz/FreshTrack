import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Leaf, User, Mail, Lock, Building, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { Input, Button } from '../components/ui'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { departments } = useProducts()
  const { t } = useTranslation()
  const { addToast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({})

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
  const strengthLabels = ['', t('auth.weak'), t('auth.fair'), t('auth.good'), t('auth.strong'), t('auth.veryStrong')]
  const strengthColors = ['bg-gray-200', 'bg-danger', 'bg-warning', 'bg-warning', 'bg-success', 'bg-success']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    if (formData.password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    setIsLoading(true)
    const result = await register(formData)

    if (result.success) {
      addToast(t('toast.registerSuccess'), 'success')
      navigate('/')
    } else {
      setError(result.error)
      addToast(t('toast.registerError'), 'error')
    }

    setIsLoading(false)
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  // Validation errors
  const errors = {
    name: touched.name && !formData.name ? t('validation.required') : '',
    email: touched.email && !formData.email ? t('validation.required') : 
           touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? t('validation.invalidEmail') : '',
    department: touched.department && !formData.department ? t('validation.required') : '',
    password: touched.password && !formData.password ? t('validation.required') :
              touched.password && formData.password.length < 6 ? t('auth.passwordTooShort') : '',
    confirmPassword: touched.confirmPassword && !formData.confirmPassword ? t('validation.required') :
                     touched.confirmPassword && formData.password !== formData.confirmPassword ? t('validation.passwordMismatch') : ''
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
            <p className="text-warmgray leading-relaxed">{t('auth.joinSubtitle')}</p>
          </div>

          <div />
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-cream overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in py-4">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 border border-charcoal flex items-center justify-center">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
          </div>

          <div className="mb-8">
            <h2 className="font-serif text-3xl mb-2">{t('auth.createAccount')}</h2>
            <p className="text-warmgray">{t('auth.joinSubtitle')}</p>
          </div>

          {/* Server error */}
          {error && (
            <div className="flex items-start gap-3 text-danger text-sm bg-danger/10 p-4 rounded-lg animate-fade-in mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
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

            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <Input
                type="email"
                label={t('auth.email')}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                icon={Mail}
                error={errors.email}
                autoComplete="email"
              />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block font-medium">
                {t('auth.department')}
              </label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warmgray pointer-events-none" />
                <select
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  onBlur={() => handleBlur('department')}
                  className={`w-full h-12 pl-12 pr-4 bg-white border rounded-lg appearance-none cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all
                    ${errors.department ? 'border-danger' : 'border-sand hover:border-warmgray'}`}
                  required
                >
                  <option value="">{t('auth.selectDepartment')}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.department && (
                <p className="text-danger text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.department}
                </p>
              )}
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
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
                          passwordStrength >= level ? strengthColors[passwordStrength] : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-warmgray flex items-center gap-1">
                    {passwordStrength >= 4 && <CheckCircle className="w-3 h-3 text-success" />}
                    {strengthLabels[passwordStrength]}
                  </p>
                </div>
              )}
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
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

            <div className="pt-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="w-full"
              >
                {!isLoading && (
                  <>
                    <span>{t('auth.createAccount')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="text-center animate-fade-in-up" style={{ animationDelay: '350ms' }}>
              <span className="text-warmgray text-sm">{t('auth.haveAccount')} </span>
              <Link
                to="/login"
                className="text-charcoal text-sm font-medium hover:text-accent transition-colors underline-offset-4 hover:underline"
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
