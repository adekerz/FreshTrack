/**
 * DepartmentEmailVerification - Компонент для верификации email отдела
 * Показывается при редактировании отдела, если указан email
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { apiFetch } from '../../../services/api'
import { Mail, CheckCircle2, RefreshCw } from 'lucide-react'
import { ButtonSpinner } from '..'
import { cn } from '../../../utils/classNames'

export default function DepartmentEmailVerification({
  departmentId,
  email,
  onVerified,
}) {
  const { t } = useTranslation()
  const { addToast } = useToast()

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Fetch verification status on mount and when email changes
  useEffect(() => {
    if (departmentId && email) {
      fetchStatus()
    } else {
      setStatus(null)
    }
  }, [departmentId, email])

  // Auto-refresh status when tab becomes visible (e.g., user returns after clicking email link)
  useEffect(() => {
    if (!departmentId || !email) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [departmentId, email])

  const fetchStatus = async () => {
    if (!departmentId) return

    setLoading(true)
    try {
      const data = await apiFetch(
        `/departments/${departmentId}/verification-status`
      )
      setStatus(data)
    } catch (error) {
      addToast(error.message || 'Ошибка загрузки статуса', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sendConfirmation = async () => {
    if (!departmentId || !email) return

    setSending(true)
    try {
      await apiFetch(`/departments/${departmentId}/send-confirmation`, {
        method: 'POST',
      })

      addToast(
        t('settings.departments.emailConfirmationSent') ||
          'Письмо отправлено. Email подтверждён.',
        'success'
      )
      await fetchStatus()
      if (onVerified) onVerified()
    } catch (error) {
      addToast(
        error.message ||
          t('settings.departments.emailConfirmationError') ||
          'Ошибка отправки',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  if (!email) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ButtonSpinner />
        <span>Загрузка статуса...</span>
      </div>
    )
  }

  const isVerified = status?.verified || false

  return (
    <div className="mt-3 p-3 border border-border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {t('settings.departments.emailVerification') || 'Верификация email'}
          </span>
          {isVerified && <CheckCircle2 className="w-4 h-4 text-success" />}
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title="Обновить статус"
        >
          <RefreshCw
            className={cn(
              'w-4 h-4 text-muted-foreground',
              loading && 'animate-spin'
            )}
          />
        </button>
      </div>

      {isVerified ? (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {t('settings.departments.emailVerified') ||
              'Email подтверждён. Отчёты будут отправляться на этот адрес.'}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('settings.departments.emailVerificationHint') ||
              'Для получения ежедневных отчётов отправьте письмо подтверждения.'}
          </p>
          <button
            onClick={sendConfirmation}
            disabled={sending}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
              'bg-accent-button text-white hover:bg-accent-button/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {sending ? (
              <>
                <ButtonSpinner />
                <span>{t('common.sending') || 'Отправка...'}</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>
                  {t('settings.departments.sendConfirmation') ||
                    'Отправить письмо подтверждения'}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
