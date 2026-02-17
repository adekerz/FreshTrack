/**
 * PasswordFields — переиспользуемый блок полей пароля с
 * тоглом "Сгенерировать автоматически" и чеклистом требований.
 *
 * Props:
 *   password           {string}
 *   onPasswordChange   {(val: string) => void}
 *   generatePassword   {boolean}
 *   onGenerateChange   {(val: boolean) => void}
 *   t                  {(key: string) => string} — translation fn (optional)
 */

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Switch } from '.'

const PASSWORD_REQUIREMENTS = [
  { key: 'length',    label: 'Минимум 8 символов',       test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'Заглавная буква (A-Z)',     test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'Строчная буква (a-z)',      test: (p) => /[a-z]/.test(p) },
  { key: 'number',    label: 'Цифра (0-9)',               test: (p) => /\d/.test(p) },
  { key: 'special',   label: 'Спецсимвол (!@#$%^&*-_=+)', test: (p) => /[!@#$%^&*\-_=+]/.test(p) }
]

export default function PasswordFields({
  password,
  onPasswordChange,
  generatePassword,
  onGenerateChange,
  t = (k) => k
}) {
  const [showPassword, setShowPassword] = useState(false)

  const handleToggleGenerate = (val) => {
    onGenerateChange(val)
    if (val) onPasswordChange('')
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => handleToggleGenerate(!generatePassword)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggleGenerate(!generatePassword)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <Switch
          checked={generatePassword}
          onChange={handleToggleGenerate}
          aria-label={t('users.generatePassword') || 'Сгенерировать пароль автоматически'}
        />
        <span className="text-sm font-medium text-foreground">
          {t('users.generatePassword') || 'Сгенерировать пароль автоматически'}
        </span>
      </div>

      {generatePassword ? (
        <div className="bg-info/10 border border-info/20 rounded-lg p-3">
          <p className="text-xs text-info">
            {t('users.generatePasswordHint') ||
              'Временный пароль будет сгенерирован и отправлен на email. Пользователь должен будет сменить его при первом входе.'}
          </p>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-foreground">
            {t('users.password') || 'Пароль'} *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? (t('common.hide') || 'Скрыть') : (t('common.show') || 'Показать')}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground mb-1">Требования к паролю:</p>
            {PASSWORD_REQUIREMENTS.map((req) => {
              const valid = req.test(password)
              return (
                <div key={req.key} className="flex items-center gap-2 text-xs">
                  <span className={valid ? 'text-success' : 'text-muted-foreground'}>
                    {valid ? '✓' : '•'}
                  </span>
                  <span className={valid ? 'text-success' : 'text-muted-foreground'}>
                    {req.label}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
