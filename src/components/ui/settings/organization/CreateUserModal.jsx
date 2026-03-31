/**
 * CreateUserModal - Модальное окно создания пользователя
 */

import { X, UserPlus } from 'lucide-react'
import { ButtonLoader } from '../..'
import PasswordFields from '../../PasswordFields'

export default function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  hotels,
  departments: _departments,
  hotelId,
  departmentId,
  creating,
  error,
  t,
  canCreateSuperAdmin = false,
  generatePassword,
  setGeneratePassword,
}) {
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
            <h3 className="text-lg font-semibold text-foreground">
              Создать пользователя
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hotelName}
              {deptName ? ` → ${deptName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
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
              Логин *
            </label>
            <input
              type="text"
              placeholder="username"
              value={formState.login}
              onChange={(e) =>
                setFormState({ ...formState, login: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
          </div>

          {/* Password */}
          <PasswordFields
            password={formState.password}
            onPasswordChange={(val) =>
              setFormState({ ...formState, password: val })
            }
            generatePassword={generatePassword}
            onGenerateChange={setGeneratePassword}
            t={t}
          />

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Имя *
            </label>
            <input
              type="text"
              placeholder="Иван Иванов"
              value={formState.name}
              onChange={(e) =>
                setFormState({ ...formState, name: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email{' '}
              {generatePassword ? (
                <span className="text-danger">*</span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  (необязательно)
                </span>
              )}
            </label>
            <input
              type="email"
              placeholder="user@example.com"
              value={formState.email}
              onChange={(e) =>
                setFormState({ ...formState, email: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {generatePassword
                ? 'Обязателен — на него отправим временный пароль'
                : 'Если указан — придёт уведомление с данными для входа'}
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Роль
            </label>
            {canCreateSuperAdmin ? (
              // SUPER_ADMIN (is_owner): может создать HOTEL_ADMIN или SUPER_ADMIN
              <select
                value={formState.role}
                onChange={(e) =>
                  setFormState({ ...formState, role: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              >
                <option value="HOTEL_ADMIN">
                  {t?.('users.roles.HOTEL_ADMIN') || 'Hotel Admin'}
                </option>
                <option value="SUPER_ADMIN">
                  {t?.('users.roles.SUPER_ADMIN') || 'Super Admin'}
                </option>
              </select>
            ) : !departmentId ? (
              // HOTEL_ADMIN без отдела: может создать только HOTEL_ADMIN — убрано, теперь DEPARTMENT_MANAGER
              <select
                value={formState.role}
                onChange={(e) =>
                  setFormState({ ...formState, role: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              >
                <option value="DEPARTMENT_MANAGER">
                  {t?.('users.roles.DEPARTMENT_MANAGER') || 'Dept Manager'}
                </option>
                <option value="STAFF">
                  {t?.('users.roles.STAFF') || 'Staff'}
                </option>
              </select>
            ) : (
              // Создание в конкретном отделе: STAFF или DEPARTMENT_MANAGER
              <select
                value={formState.role}
                onChange={(e) =>
                  setFormState({ ...formState, role: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              >
                <option value="STAFF">
                  {t?.('users.roles.STAFF') || 'Staff'}
                </option>
                <option value="DEPARTMENT_MANAGER">
                  {t?.('users.roles.DEPARTMENT_MANAGER') || 'Dept Manager'}
                </option>
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
