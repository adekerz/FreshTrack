/**
 * VerifyEmailPage — единый поток OTP: письмо с кодом, ввод кода на странице
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import CodeInput from '../components/ui/CodeInput'

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { setUserAndToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const partialToken = location.state?.partialToken || localStorage.getItem('partialToken')
  const email = location.state?.email || localStorage.getItem('pendingEmail')

  useEffect(() => {
    if (!partialToken || !email) {
      navigate('/register', { replace: true })
    }
  }, [partialToken, email, navigate])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleVerify = async (code) => {
    setLoading(true)
    try {
      const response = await apiFetch('/auth/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ partialToken, otp: code })
      })
      if (response.token) {
        localStorage.setItem('freshtrack_token', response.token)
      }
      localStorage.removeItem('partialToken')
      localStorage.removeItem('pendingEmail')
      if (response.user && response.token) {
        setUserAndToken(response.user, response.token)
      }
      addToast(t('auth.emailVerified') || 'Email подтверждён!', 'success')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      addToast(error.message || t('auth.verificationFailed') || 'Ошибка верификации', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      const response = await apiFetch('/auth/resend-email-otp', {
        method: 'POST',
        body: JSON.stringify({ partialToken })
      })
      setResendCooldown(response.cooldownSeconds ?? 60)
      addToast(t('auth.otpResent') || 'Новый код отправлен!', 'success')
    } catch (error) {
      addToast(error.message || t('auth.resendCodeFailed') || 'Не удалось отправить код', 'error')
    }
  }

  if (!partialToken || !email) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent/5 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl p-6 sm:p-8 border border-border">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('auth.verifyEmail') || 'Подтвердите email'}
            </h1>
            <p className="text-muted-foreground">
              {t('auth.otpSentTo') || 'Код отправлен на'} <strong>{email}</strong>
            </p>
          </div>

          <div className="mb-6">
            <CodeInput
              onComplete={handleVerify}
              disabled={loading}
            />
          </div>

          <p className="text-center text-sm text-muted-foreground mb-6">
            {t('auth.otpExpires') || 'Код действителен 15 минут'}
          </p>

          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('auth.resendIn') || 'Отправить повторно через'} {resendCooldown} с
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-accent hover:text-accent/80 text-sm font-medium flex items-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                {t('auth.resendCode') || 'Отправить код повторно'}
              </button>
            )}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="mt-6 w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.backToLogin') || 'Вернуться к входу'}
          </button>
        </div>
      </div>
    </div>
  )
}
