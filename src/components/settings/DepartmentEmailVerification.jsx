/**
 * DepartmentEmailVerification - Компонент для верификации email отдела
 * Показывается при редактировании отдела, если указан email
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { apiFetch } from '../../services/api'
import { Mail, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import { ButtonSpinner } from '../ui'
import { cn } from '../../utils/classNames'

export default function DepartmentEmailVerification({ departmentId, email, onVerified }) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  
  const [status, setStatus] = useState(null) // { verified, canResend, attemptsLeft, expiresAt, isExpired }
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(0)

  // Fetch verification status
  useEffect(() => {
    if (departmentId && email) {
      fetchStatus()
    } else {
      setStatus(null)
    }
  }, [departmentId, email])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const fetchStatus = async () => {
    if (!departmentId) return
    
    setLoading(true)
    try {
      const data = await apiFetch(`/departments/${departmentId}/verification-status`)
      setStatus(data)
      
      // Set countdown if code is active
      if (data.expiresAt && !data.isExpired && !data.verified) {
        const expires = new Date(data.expiresAt)
        const now = new Date()
        const seconds = Math.max(0, Math.floor((expires - now) / 1000))
        setCountdown(seconds)
      }
    } catch (error) {
      addToast(error.message || 'Ошибка загрузки статуса', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sendCode = async () => {
    if (!departmentId || !email) return
    
    setSending(true)
    try {
      const data = await apiFetch(`/departments/${departmentId}/send-verification-code`, {
        method: 'POST'
      })
      
      addToast('Код отправлен на email', 'success')
      await fetchStatus()
      
      // Set countdown (15 minutes = 900 seconds)
      setCountdown(900)
    } catch (error) {
      addToast(error.message || 'Ошибка отправки кода', 'error')
    } finally {
      setSending(false)
    }
  }

  const verifyCode = async () => {
    if (!departmentId) return
    
    const codeString = code.join('')
    if (codeString.length !== 6) {
      addToast('Введите 6-значный код', 'warning')
      return
    }

    setVerifying(true)
    try {
      const data = await apiFetch(`/departments/${departmentId}/verify-email`, {
        method: 'POST',
        body: JSON.stringify({ code: codeString })
      })
      
      if (data.success) {
        addToast('Email подтверждён', 'success')
        setCode(['', '', '', '', '', ''])
        await fetchStatus()
        if (onVerified) onVerified()
      }
    } catch (error) {
      addToast(error.message || 'Неверный код', 'error')
      // Clear code on error
      setCode(['', '', '', '', '', ''])
      await fetchStatus()
    } finally {
      setVerifying(false)
    }
  }

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return
    
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`)
      if (nextInput) nextInput.focus()
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        setTimeout(() => verifyCode(), 100)
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split('')
      setCode(newCode)
      // Auto-submit
      setTimeout(() => verifyCode(), 100)
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`)
      if (prevInput) prevInput.focus()
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
  const canResend = status?.canResend !== false
  const attemptsLeft = status?.attemptsLeft || 0

  return (
    <div className="mt-3 p-3 border border-border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Верификация email</span>
        {isVerified && (
          <CheckCircle2 className="w-4 h-4 text-success" />
        )}
      </div>

      {isVerified ? (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="w-4 h-4" />
          <span>Email подтверждён. Отчёты будут отправляться на этот адрес.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Для получения ежедневных отчётов необходимо подтвердить email адрес.
          </p>

          {!status?.expiresAt || status?.isExpired ? (
            <button
              onClick={sendCode}
              disabled={sending || !canResend}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors",
                "bg-accent-button text-white hover:bg-accent-button/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {sending ? (
                <>
                  <ButtonSpinner />
                  <span>Отправка...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Отправить код</span>
                </>
              )}
            </button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Введите 6-значный код из письма:
                </label>
                <div className="flex items-center gap-2" onPaste={handlePaste}>
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      id={`code-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={cn(
                        "w-12 h-12 text-center text-lg font-semibold rounded-lg border-2",
                        "border-border bg-background focus:border-accent focus:outline-none",
                        "transition-colors"
                      )}
                      disabled={verifying}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
              </div>

              {countdown > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    Отправить повторно через {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {countdown === 0 && canResend && (
                <button
                  onClick={sendCode}
                  disabled={sending}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Отправить код повторно</span>
                </button>
              )}

              {attemptsLeft > 0 && attemptsLeft < 5 && (
                <p className="text-xs text-warning">
                  Осталось попыток: {attemptsLeft}
                </p>
              )}

              {attemptsLeft === 0 && (
                <p className="text-xs text-danger">
                  Превышен лимит попыток. Запросите новый код.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
