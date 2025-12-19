import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'

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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-cream">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 border border-charcoal flex items-center justify-center">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
          </div>

          <div className="mb-10">
            <h2 className="font-serif text-3xl mb-2">{t('auth.createAccount')}</h2>
            <p className="text-warmgray">{t('auth.joinSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.fullName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="elegant-input"
                placeholder={t('auth.fullNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="elegant-input"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.department')}
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="elegant-input bg-transparent cursor-pointer"
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

            <div>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="elegant-input"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                className="elegant-input"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>

            {error && <div className="text-danger text-sm bg-danger/10 p-4 rounded">{error}</div>}

            <div className="pt-4">
              <button type="submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </button>
            </div>

            <div className="text-center">
              <span className="text-warmgray text-sm">{t('auth.haveAccount')} </span>
              <Link
                to="/login"
                className="text-charcoal text-sm font-medium hover:text-accent transition-colors"
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
