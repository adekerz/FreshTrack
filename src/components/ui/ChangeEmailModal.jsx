/**
 * ChangeEmailModal - Modal for changing user email with OTP verification
 */

import { useState, useCallback, useRef } from 'react'
import { Mail, X, Lock } from 'lucide-react'
import Modal from './Modal'
import CodeInput from './CodeInput'
import { apiFetch } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'

export function ChangeEmailModal({ isOpen, onClose, currentEmail, onSuccess }) {
  const { addToast } = useToast()
  const { t } = useTranslation()
  const [step, setStep] = useState('password') // password, otp
  const [formData, setFormData] = useState({ newEmail: '', password: '' })
  const [otp, setOtp] = useState('')
  const [partialToken, setPartialToken] = useState('')
  const [loading, setLoading] = useState(false)
  const newEmailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  const handleNewEmailChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, newEmail: e.target.value }))
  }, [])

  const handlePasswordChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, password: e.target.value }))
  }, [])

  const handleRequestChange = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await apiFetch('/auth/change-email', {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      if (response.success) {
        setPartialToken(response.partialToken)
        setStep('otp')
        addToast(t('auth.otpSent') || 'OTP sent to new email', 'success')
      }
    } catch (error) {
      addToast(error.message || 'Failed to request email change', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (code) => {
    setLoading(true)

    try {
      const response = await apiFetch('/auth/verify-email-change', {
        method: 'POST',
        body: JSON.stringify({ partialToken, otp: code })
      })

      if (response.success) {
        addToast(t('auth.emailChanged') || 'Email changed successfully!', 'success')
        onSuccess()
        handleClose()
      }
    } catch (error) {
      addToast(error.message || 'Verification failed', 'error')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep('password')
    setFormData({ newEmail: '', password: '' })
    setOtp('')
    setPartialToken('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.changeEmail') || 'Изменить email'}
      size="md"
    >
      {step === 'password' ? (
        <form onSubmit={handleRequestChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              {t('auth.currentEmail') || 'Текущий email'}
            </label>
            <input
              type="email"
              value={currentEmail}
              disabled
              className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              {t('auth.newEmail') || 'Новый email'}
            </label>
            <input
              ref={newEmailInputRef}
              type="email"
              value={formData.newEmail}
              onChange={handleNewEmailChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              placeholder="new@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              {t('auth.password') || 'Пароль'}
            </label>
            <input
              ref={passwordInputRef}
              type="password"
              value={formData.password}
              onChange={handlePasswordChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('auth.passwordRequiredForChange') || 'Введите пароль для подтверждения'}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel') || 'Отмена'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (t('common.sending') || 'Отправка...') : (t('auth.sendCode') || 'Отправить код')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <p className="text-center text-muted-foreground">
            {t('auth.otpSentTo') || 'Код отправлен на'} <strong>{formData.newEmail}</strong>
          </p>

          <div className="flex justify-center">
            <CodeInput
              onComplete={handleVerifyOTP}
              disabled={loading}
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.otpExpires') || 'Код действителен 15 минут'}
          </p>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('password')}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              {t('common.back') || 'Назад'}
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel') || 'Отмена'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
