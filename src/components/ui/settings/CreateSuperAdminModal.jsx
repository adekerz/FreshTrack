/**
 * CreateSuperAdminModal - Модальное окно создания супер-администратора
 * Используется на странице Аккаунты (AccountsSettings)
 */

import { X, UserPlus } from 'lucide-react'
import { ButtonLoader } from '../index'
import PasswordFields from '../PasswordFields'

export default function CreateSuperAdminModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  generatePassword = true,
  setGeneratePassword,
  creating,
  error,
  t
}) {
  if (!isOpen) return null

  const handleClose = () => {
    onClose()
    setGeneratePassword?.(true)
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t?.('accounts.addSuperAdmin') || 'Добавить супер-администратора'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t?.('accounts.addSuperAdminHint') || 'Супер-админ имеет доступ ко всей системе'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg"
            aria-label={t?.('common.close') || 'Закрыть'}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Login */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t?.('users.login') || 'Логин'} *
            </label>
            <input
              type="text"
              placeholder="username"
              value={formState.login}
              onChange={(e) => setFormState({ ...formState, login: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
              aria-required="true"
            />
          </div>

          {/* Password */}
          <PasswordFields
            password={formState.password}
            onPasswordChange={(val) => setFormState({ ...formState, password: val })}
            generatePassword={generatePassword}
            onGenerateChange={(val) => setGeneratePassword?.(val)}
            t={t}
          />

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t?.('users.name') || 'Имя'} *
            </label>
            <input
              type="text"
              placeholder="Иван Иванов"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
              aria-required="true"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t?.('users.email') || 'Email'} {generatePassword && <span className="text-danger">*</span>}
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={formState.email}
              onChange={(e) => setFormState({ ...formState, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
            />
            {generatePassword && (
              <p className="text-xs text-muted-foreground mt-1">
                {t?.('users.emailRequiredForTempPassword') || 'Обязателен для отправки временного пароля'}
              </p>
            )}
          </div>

          <button
            onClick={onSubmit}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
            aria-busy={creating}
          >
            {creating ? <ButtonLoader /> : <UserPlus className="w-4 h-4" />}
            {t?.('common.create') || 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
