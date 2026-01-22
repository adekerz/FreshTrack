import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { apiFetch, authAPI } from '../services/api'
import { cn } from '../utils/classNames'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, updateUser } = useAuth()
  const { addToast } = useToast()
  
  const isFirstLogin = location.state?.firstLogin || false
  const userEmail = location.state?.email || user?.email
  
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
  const [validation, setValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false
  })

  // Validate password in real-time
  const validatePasswordRules = (password, confirm) => {
    setValidation({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*\-_=+]/.test(password),
      match: password === confirm && password.length > 0
    })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const newFormData = { ...formData, [name]: value }
    setFormData(newFormData)
    
    if (name === 'newPassword' || name === 'confirmPassword') {
      validatePasswordRules(newFormData.newPassword, newFormData.confirmPassword)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Final validation
    const allValid = Object.values(validation).every(v => v === true)
    if (!allValid) {
      addToast('Пароль не соответствует требованиям', 'error')
      return
    }
    
    setLoading(true)
    try {
      const result = await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      })
      
      if (result.success || !result.error) {
        addToast('Пароль успешно изменен!', 'success')
        
        // Refresh user data to update mustChangePassword flag
        try {
          const userResponse = await authAPI.getCurrentUser()
          if (userResponse?.user) {
            // Update user in context using updateUser method
            const updatedUser = userResponse.user
            updateUser(updatedUser)
            
            // Small delay to ensure state update propagates
            await new Promise(resolve => setTimeout(resolve, 200))
            
            if (isFirstLogin) {
              // For first login, redirect to dashboard
              navigate('/inventory', { replace: true })
            } else {
              // For regular password change, go back
              navigate(-1)
            }
          } else {
            // Fallback: reload if getCurrentUser fails
            console.warn('getCurrentUser returned no user, reloading page')
            window.location.reload()
          }
        } catch (refreshError) {
          console.warn('Failed to refresh user after password change:', refreshError)
          // If refresh fails, try to update user with mustChangePassword: false
          if (user) {
            updateUser({ ...user, mustChangePassword: false })
            await new Promise(resolve => setTimeout(resolve, 200))
            if (isFirstLogin) {
              navigate('/inventory', { replace: true })
            } else {
              navigate(-1)
            }
          } else {
            // Last resort: reload
            window.location.reload()
          }
        }
      }
    } catch (error) {
      addToast(error.message || 'Ошибка смены пароля', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (isFirstLogin) {
      // Can't cancel first-time password change - must logout
      logout()
      navigate('/login')
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isFirstLogin ? 'Установите постоянный пароль' : 'Смена пароля'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFirstLogin 
                ? 'Для безопасности смените временный пароль на постоянный'
                : 'Введите текущий пароль и новый пароль'
              }
            </p>
            {userEmail && (
              <p className="text-sm text-muted-foreground mt-2">
                <strong>{userEmail}</strong>
              </p>
            )}
          </div>

          {/* Warning for first login */}
          {isFirstLogin && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm text-warning">
                <strong>Временный пароль</strong>
                <p className="mt-1">Вы вошли с временным паролем. Пожалуйста, установите постоянный пароль для продолжения работы.</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {isFirstLogin ? 'Временный пароль' : 'Текущий пароль'}
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder={isFirstLogin ? 'Из письма на email' : 'Введите текущий пароль'}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Новый пароль
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Придумайте надежный пароль"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Подтвердите пароль
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 pr-12 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Повторите новый пароль"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground mb-3">Требования к паролю:</p>
              {[
                { key: 'length', label: 'Минимум 8 символов', valid: validation.length },
                { key: 'uppercase', label: 'Заглавная буква (A-Z)', valid: validation.uppercase },
                { key: 'lowercase', label: 'Строчная буква (a-z)', valid: validation.lowercase },
                { key: 'number', label: 'Цифра (0-9)', valid: validation.number },
                { key: 'special', label: 'Спецсимвол (!@#$%^&*-_=+)', valid: validation.special },
                { key: 'match', label: 'Пароли совпадают', valid: validation.match }
              ].map(req => (
                <div key={req.key} className="flex items-center gap-2 text-sm">
                  {req.valid ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={req.valid ? 'text-success' : 'text-muted-foreground'}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isFirstLogin ? 'Выйти' : 'Отмена'}
              </button>
              <button
                type="submit"
                disabled={loading || !Object.values(validation).every(v => v === true)}
                className={cn(
                  "flex-1 px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium",
                  !Object.values(validation).every(v => v === true) && "opacity-50 cursor-not-allowed"
                )}
              >
                {loading ? 'Сохранение...' : 'Сменить пароль'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Храните пароль в безопасности. Никому его не сообщайте.
        </p>
      </div>
    </div>
  )
}
