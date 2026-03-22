/**
 * DepartmentEmailVerification - OTP-based email verification for departments
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '../../../context/ToastContext'
import { apiFetch } from '../../../services/api'
import { Mail, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react'
import { ButtonSpinner } from '..'
import { cn } from '../../../utils/classNames'
import CodeInput from '../CodeInput'

const RESEND_COOLDOWN = 60

export default function DepartmentEmailVerification({
  departmentId,
  email,
  onVerified,
}) {
  const { addToast } = useToast()

  // phase: 'idle' | 'sending' | 'code_sent' | 'verifying' | 'verified'
  const [phase, setPhase] = useState('idle')
  const [countdown, setCountdown] = useState(0)
  const [codeInputKey, setCodeInputKey] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)
  const [remainingAttempts, setRemainingAttempts] = useState(null)
  const [shaking, setShaking] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const countdownRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    if (!departmentId) return
    setStatusLoading(true)
    try {
      const data = await apiFetch(
        `/departments/${departmentId}/verification-status`
      )
      if (data?.verified) {
        setPhase('verified')
      } else {
        setPhase('idle')
      }
    } catch {
      setPhase('idle')
    } finally {
      setStatusLoading(false)
    }
  }, [departmentId])

  // Load initial verification status
  useEffect(() => {
    if (departmentId && email) {
      fetchStatus()
    } else {
      setPhase('idle')
    }
  }, [departmentId, email, fetchStatus])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => clearInterval(countdownRef.current)
  }, [])

  const startCountdown = (seconds) => {
    setCountdown(seconds)
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const triggerShake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 700)
  }

  const sendCode = async () => {
    if (!departmentId || !email) return
    setPhase('sending')
    setErrorMsg(null)
    try {
      await apiFetch(`/departments/${departmentId}/send-code`, {
        method: 'POST',
      })
      setPhase('code_sent')
      startCountdown(RESEND_COOLDOWN)
      setCodeInputKey((k) => k + 1)
      setRemainingAttempts(5) // reset local attempt counter
    } catch (error) {
      setPhase('idle')
      addToast(error.message || 'Ошибка отправки кода', 'error')
    }
  }

  const handleVerify = async (code) => {
    setPhase('verifying')
    setErrorMsg(null)
    try {
      await apiFetch(`/departments/${departmentId}/verify-code`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      setPhase('verified')
      if (onVerified) onVerified()
    } catch (error) {
      // apiFetch shape: error.message = jsonBody.error for 400s; error.status=429 for 429
      const errMsg = error.message
      const is429 = error.status === 429

      if (is429) {
        setErrorMsg(
          error.message || 'Превышено число попыток. Запросите новый код.'
        )
        clearInterval(countdownRef.current)
        setCountdown(0)
        setPhase('code_sent')
      } else if (errMsg === 'invalid_code') {
        // Track attempts locally (remaining_attempts not attached to errorObj by apiFetch)
        const newRemaining = (remainingAttempts ?? 5) - 1
        setRemainingAttempts(newRemaining)
        setErrorMsg(
          newRemaining > 0
            ? `Неверный код. Осталось попыток: ${newRemaining}`
            : 'Неверный код'
        )
        setCodeInputKey((k) => k + 1)
        triggerShake()
        setPhase('code_sent')
      } else if (errMsg === 'expired') {
        setErrorMsg('Код устарел. Запросите новый.')
        clearInterval(countdownRef.current)
        setCountdown(0)
        setPhase('code_sent')
        triggerShake()
      } else if (errMsg === 'no_code') {
        setErrorMsg('Код не найден. Запросите новый.')
        clearInterval(countdownRef.current)
        setCountdown(0)
        setPhase('code_sent')
      } else {
        addToast(error.message || 'Ошибка проверки кода', 'error')
        setPhase('code_sent')
      }
    }
  }

  if (!email) return null

  if (statusLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
        <ButtonSpinner />
        <span>Загрузка статуса...</span>
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 border border-border rounded-lg bg-muted/30 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Верификация email
          </span>
          {phase === 'verified' && (
            <CheckCircle2 className="w-4 h-4 text-success" />
          )}
        </div>
        {(phase === 'idle' || phase === 'verified') && (
          <button
            type="button"
            onClick={fetchStatus}
            disabled={statusLoading}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            aria-label="Обновить статус"
            title="Обновить статус"
          >
            <RefreshCw
              className={cn(
                'w-4 h-4 text-muted-foreground',
                statusLoading && 'animate-spin'
              )}
            />
          </button>
        )}
      </div>

      {/* Verified state */}
      {phase === 'verified' && (
        <div className="flex items-center gap-2 text-sm text-success transition-opacity duration-300">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            Email подтверждён. Отчёты будут отправляться на этот адрес.
          </span>
        </div>
      )}

      {/* Idle state */}
      {phase === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Для получения ежедневных отчётов подтвердите email отдела кодом.
          </p>
          <button
            type="button"
            onClick={sendCode}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
              'bg-accent-button text-white hover:bg-accent-button/90'
            )}
          >
            <Mail className="w-4 h-4" />
            <span>Отправить код</span>
          </button>
        </div>
      )}

      {/* Sending state */}
      {phase === 'sending' && (
        <button
          type="button"
          disabled
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-accent-button/50 text-white cursor-not-allowed"
        >
          <ButtonSpinner />
          <span>Отправка...</span>
        </button>
      )}

      {/* Code sent / verifying state */}
      {(phase === 'code_sent' || phase === 'verifying') && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Код отправлен на <strong>{email}</strong>. Введите его ниже:
          </p>

          {/* CodeInput with shake animation wrapper */}
          <div className={cn('relative', shaking && 'animate-danger-shake')}>
            <CodeInput
              key={codeInputKey}
              onComplete={handleVerify}
              disabled={phase === 'verifying'}
              autoFocus
            />
            {phase === 'verifying' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

          {/* Resend button / countdown */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sendCode}
              disabled={countdown > 0 || phase === 'verifying'}
              className={cn(
                'text-sm transition-colors',
                countdown > 0 || phase === 'verifying'
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'text-accent hover:text-accent/80 underline-offset-2 hover:underline'
              )}
            >
              {countdown > 0
                ? `Отправить повторно через ${countdown}с`
                : 'Отправить повторно'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
