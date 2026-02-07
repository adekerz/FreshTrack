/**
 * CreateUserModal - Модальное окно создания пользователя
 */

import { useState } from 'react'
import { X, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from '../../../../context/LanguageContext'
import { ButtonLoader, Switch } from '../..'

export default function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  hotels,
  departments,
  hotelId,
  departmentId,
  creating,
  error,
  t
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [generatePassword, setGeneratePassword] = useState(true)

  if (!isOpen) return null

  const hotelName = hotels?.find((h) => h.id === hotelId)?.name
  const deptName = hotels
    ?.find((h) => h.id === hotelId)
    ?.departments?.find((d) => d.id === departmentId)?.name

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Создать пользователя</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hotelName}
              {deptName ? ` → ${deptName}` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              onClose()
              setGeneratePassword(true)
              setShowPassword(false)
            }}
            className="p-2 hover:bg-muted rounded-lg"
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Логин *</label>
            <input
              type="text"
              placeholder="username"
              value={formState.login}
              onChange={(e) => setFormState({ ...formState, login: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
          </div>
          <div>
            <div
              className="flex items-center gap-2 mb-2 cursor-pointer"
              onClick={() => {
                const next = !generatePassword
                setGeneratePassword(next)
                if (next) setFormState((u) => ({ ...u, password: '' }))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  const next = !generatePassword
                  setGeneratePassword(next)
                  if (next) setFormState((u) => ({ ...u, password: '' }))
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Switch
                checked={generatePassword}
                onChange={(v) => {
                  setGeneratePassword(v)
                  if (v) setFormState((u) => ({ ...u, password: '' }))
                }}
                aria-label="Сгенерировать пароль автоматически"
              />
              <span className="text-sm font-medium text-foreground">
                Сгенерировать пароль автоматически
              </span>
            </div>
            {generatePassword ? (
              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <p className="text-xs text-info">
                  <strong>Временный пароль будет сгенерирован и отправлен на email.</strong> Пользователь должен будет сменить его при первом входе.
                </p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-foreground mb-1">Пароль *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formState.password}
                    onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Мин. 8 символов, заглавные, строчные буквы и цифры
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Имя *</label>
            <input
              type="text"
              placeholder="Иван Иванов"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email {generatePassword && <span className="text-danger">*</span>}
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={formState.email}
              onChange={(e) => setFormState({ ...formState, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            {generatePassword && (
              <p className="text-xs text-muted-foreground mt-1">
                Обязателен для отправки временного пароля
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Роль</label>
            {!departmentId ? (
              <div className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted/50 text-foreground">
                {t('users.roles.HOTEL_ADMIN')}
              </div>
            ) : (
              <select
                value={formState.role}
                onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              >
                <option value="STAFF">{t('users.roles.STAFF')}</option>
                <option value="DEPARTMENT_MANAGER">{t('users.roles.DEPARTMENT_MANAGER')}</option>
              </select>
            )}
          </div>
          <button
            onClick={onSubmit}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
            aria-busy={creating}
          >
            {creating ? <ButtonLoader /> : <UserPlus className="w-4 h-4" />}
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
