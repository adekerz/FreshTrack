import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Leaf, ShieldCheck, Bell, BarChart3, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const result = await login(identifier, password)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || t('auth.invalidCredentials'))
    }

    setIsLoading(false)
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
              <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
            </div>
            <p className="text-warmgray text-sm">{t('common.tagline')}</p>
          </div>

          <div className="max-w-md">
            <h1 className="font-serif text-5xl leading-tight mb-6">
              {t('auth.precisionTitle')}
              <br />
              <span className="text-accent">{t('auth.precisionHighlight')}</span>
            </h1>
            <p className="text-warmgray leading-relaxed">{t('auth.precisionDescription')}</p>
          </div>

          <div className="flex items-center gap-8 text-sm text-warmgray">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('auth.secure')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span>{t('auth.smartAlerts')}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>{t('auth.analytics')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-cream">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 border border-charcoal flex items-center justify-center">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
          </div>

          <div className="mb-12">
            <h2 className="font-serif text-3xl mb-2">{t('auth.welcomeBack')}</h2>
            <p className="text-warmgray">{t('auth.signInSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="animate-slide-up stagger-1" style={{ opacity: 0 }}>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.loginOrEmail')}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="elegant-input"
                placeholder={t('auth.loginOrEmailPlaceholder')}
                required
              />
            </div>

            <div className="animate-slide-up stagger-2" style={{ opacity: 0 }}>
              <label className="text-xs uppercase tracking-wider text-warmgray mb-2 block">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="elegant-input"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>

            {error && <div className="text-danger text-sm bg-danger/10 p-4 rounded">{error}</div>}

            <div className="animate-slide-up stagger-3 pt-4" style={{ opacity: 0 }}>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>{t('auth.signingIn')}</span>
                ) : (
                  <>
                    <span>{t('auth.signIn')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="animate-slide-up stagger-4 text-center" style={{ opacity: 0 }}>
              <span className="text-warmgray text-sm">{t('auth.noAccount')} </span>
              <Link
                to="/register"
                className="text-charcoal text-sm font-medium hover:text-accent transition-colors"
              >
                {t('auth.createAccount')}
              </Link>
            </div>
          </form>

          <div className="mt-16 pt-8 border-t border-sand">
            <p className="text-xs text-warmgray text-center">{t('auth.demoCredentials')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
