/**
 * UserRow - Компонент строки пользователя
 * Вертикальная раскладка: имя, роль, логин не наезжают друг на друга
 */

import { User, Ban, Trash2, Mail } from 'lucide-react'
import { useTranslation } from '../../../../context/LanguageContext'

export default function UserRow({
  user,
  currentUserId,
  onResendPassword,
  onToggleStatus,
  onDelete,
  getRoleBadge,
  t
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
      <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <User className="w-4 h-4 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground truncate">{user.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {getRoleBadge(user.role)}
          <span className="text-xs text-muted-foreground truncate">
            {user.login}
            {user.email ? ` • ${user.email}` : ''}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-xs ${user.is_active !== false ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
            }`}
        >
          {user.is_active !== false ? 'Активен' : 'Заблок.'}
        </span>
        {/* Session Status Indicator */}
        <div
          className={`w-3 h-3 rounded-full ${(user.last_login && (new Date() - new Date(user.last_login) < 15 * 60 * 1000))
              ? 'bg-success animate-pulse'
              : 'bg-muted'
            }`}
          title={(user.last_login && (new Date() - new Date(user.last_login) < 15 * 60 * 1000))
            ? 'Сессия активна'
            : 'Не в сети'
          }
        />
        {user.email && user.is_active !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onResendPassword(user.id, user.email)
            }}
            className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
            title="Переотправить временный пароль"
          >
            <Mail className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() =>
            onToggleStatus(user.id, user.is_active !== false)
          }
          className={`p-1.5 rounded transition-colors ${user.is_active !== false
              ? 'text-muted-foreground hover:text-danger hover:bg-danger/10'
              : 'text-muted-foreground hover:text-success hover:bg-success/10'
            }`}
          title={user.is_active !== false ? 'Заблокировать' : 'Разблокировать'}
        >
          <Ban className="w-4 h-4" />
        </button>
        {user.role !== 'SUPER_ADMIN' && (
          <button
            onClick={() => onDelete(user.id, user.name)}
            className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
