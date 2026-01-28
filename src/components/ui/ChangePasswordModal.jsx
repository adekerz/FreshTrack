/**
 * ChangePasswordModal - Modal for changing user password
 */

import { useState, useCallback, useRef } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import Modal from './Modal'
import { apiFetch } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'

export function ChangePasswordModal({ isOpen, onClose }) {
  const { addToast } = useToast()
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [loading, setLoading] = useState(false)
  const currentPasswordInputRef = useRef(null)
  const newPasswordInputRef = useRef(null)
  const confirmPasswordInputRef = useRef(null)

  const handleCurrentPasswordChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, currentPassword: e.target.value }))
  }, [])

  const handleNewPasswordChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, newPassword: e.target.value }))
  }, [])

  const handleConfirmPasswordChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      addToast(t('auth.passwordMismatch') || 'Passwords do not match', 'error')
      return
    }

    if (formData.newPassword.length < 8) {
      addToast(t('auth.passwordTooShort') || 'Password must be at least 8 characters', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      })

      if (response.success) {
        addToast(t('auth.passwordChanged') || 'Password changed successfully!', 'success')
        handleClose()
      }
    } catch (error) {
      addToast(error.message || 'Failed to change password', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setShowPasswords({ current: false, new: false, confirm: false })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.changePassword') || 'Сменить пароль'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            {t('auth.currentPassword') || 'Текущий пароль'}
          </label>
          <div className="relative">
            <input
              ref={currentPasswordInputRef}
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={handleCurrentPasswordChange}
              required
              className="w-full px-4 py-2 pr-10 border border-border rounded-lg bg-background text-foreground"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            {t('auth.newPassword') || 'Новый пароль'}
          </label>
          <div className="relative">
            <input
              ref={newPasswordInputRef}
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={handleNewPasswordChange}
              required
              minLength={8}
              className="w-full px-4 py-2 pr-10 border border-border rounded-lg bg-background text-foreground"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('auth.passwordMinLength') || 'Минимум 8 символов'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            {t('auth.confirmPassword') || 'Подтвердите пароль'}
          </label>
          <div className="relative">
            <input
              ref={confirmPasswordInputRef}
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              className="w-full px-4 py-2 pr-10 border border-border rounded-lg bg-background text-foreground"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
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
            {loading ? (t('common.saving') || 'Сохранение...') : (t('auth.changePassword') || 'Сменить пароль')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
