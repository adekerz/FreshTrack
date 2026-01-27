/**
 * VerifyEmailPage - Страница подтверждения email после регистрации
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { Mail, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { ButtonSpinner } from '../components/ui'

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const email = location.state?.email || user?.email
  const statusParam = searchParams.get('status') // success, expired, error, invalid

  const handleContinue = () => {
    setRedirecting(true)
    if (user?.status === 'pending') {
      navigate('/pending-approval', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  // Handle status from URL (from confirmation link)
  useEffect(() => {
    if (statusParam === 'success') {
      setVerified(true)
      addToast('Email подтверждён успешно', 'success')
      
      // Refresh user data
      if (user) {
        apiFetch('/auth/me')
          .then(data => {
            if (data.user) {
              updateUser(data.user)
            }
          })
          .catch(() => {})
      }
      
      // Auto-redirect after 2 seconds
      const timer = setTimeout(() => {
        handleContinue()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [statusParam, user, navigate, addToast, updateUser])

  // Redirect if already verified
  useEffect(() => {
    if (user?.emailVerified || verified) {
      const timer = setTimeout(() => {
        setRedirecting(true)
        if (user?.status === 'pending') {
          navigate('/pending-approval', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [user, verified, navigate])


  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  // Success state
  if (statusParam === 'success' || user?.emailVerified || verified) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div>
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Email подтверждён</h1>
            {redirecting ? (
              <p className="text-muted-foreground mb-4">Перенаправление...</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">
                  Ваш email успешно подтверждён. Вы будете перенаправлены автоматически.
                </p>
                <button
                  onClick={handleContinue}
                  className="w-full px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
                >
                  Продолжить
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Error states
  if (statusParam === 'expired' || statusParam === 'invalid' || statusParam === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div>
            {statusParam === 'expired' ? (
              <>
                <XCircle className="w-16 h-16 text-warning mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Ссылка истекла</h1>
                <p className="text-muted-foreground mb-6">
                  Ссылка для подтверждения email истекла. Пожалуйста, зарегистрируйтесь заново или запросите новую ссылку.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
                <h1 className="text-2xl font-semibold mb-2">Ошибка подтверждения</h1>
                <p className="text-muted-foreground mb-6">
                  Не удалось подтвердить email. Пожалуйста, попробуйте зарегистрироваться заново.
                </p>
              </>
            )}
            <button
              onClick={() => navigate('/register')}
              className="w-full px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors mb-3"
            >
              Зарегистрироваться заново
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Вернуться к входу</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default state - waiting for email
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div>
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Проверьте email</h1>
          <p className="text-muted-foreground mb-6">
            Мы отправили ссылку для подтверждения на <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Нажмите на ссылку в письме, чтобы подтвердить ваш email адрес.
            Ссылка действительна 24 часа.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Вернуться к входу</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
