/**
 * UserRow - Компонент строки пользователя
 * Мобилка: 2-строчная карточка (инфо + кнопки)
 * Десктоп: горизонтальная однострочная раскладка
 */

import { User, Ban, Trash2, Mail } from 'lucide-react'

export default function UserRow({
  user,
  currentUserId,
  onResendPassword,
  onToggleStatus,
  onDelete,
  getRoleBadge,
  t
}) {
  const isOnline = (user.id === currentUserId) ||
    (user.last_login && (new Date() - new Date(user.last_login) < 60 * 60 * 1000))

  const lastSeenTitle = isOnline
    ? 'Сессия активна'
    : `Был в сети: ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Никогда'}`

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Верхняя строка: аватар + инфо */}
      <div className="flex items-start gap-3 p-3 pb-2">
        {/* Аватар */}
        <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-accent" />
        </div>

        {/* Информация */}
        <div className="min-w-0 flex-1">
          {/* Имя + онлайн-индикатор */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{user.name || user.login}</span>
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isOnline
                  ? 'bg-success animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                  : 'bg-muted'
              }`}
              title={lastSeenTitle}
            />
          </div>

          {/* Логин и email */}
          <div className="mt-0.5 space-y-0.5">
            <div className="text-xs text-muted-foreground truncate">
              @{user.login}
            </div>
            {user.email && (
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            )}
          </div>

          {/* Роль */}
          <div className="mt-1.5">
            {getRoleBadge(user.role)}
          </div>
        </div>

        {/* Статус активности — только бейдж, кнопки внизу */}
        <div className="flex-shrink-0">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              user.is_active !== false
                ? 'bg-success/10 text-success'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {user.is_active !== false ? 'Активен' : 'Заблок.'}
          </span>
        </div>
      </div>

      {/* Нижняя строка: кнопки действий */}
      <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-border/50 bg-muted/20">
        {user.email && user.is_active !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onResendPassword(user.id, user.email)
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
            title="Переотправить временный пароль"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Пароль</span>
          </button>
        )}
        <button
          onClick={() => onToggleStatus(user.id, user.is_active !== false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
            user.is_active !== false
              ? 'text-muted-foreground hover:text-danger hover:bg-danger/10'
              : 'text-muted-foreground hover:text-success hover:bg-success/10'
          }`}
          title={user.is_active !== false ? 'Заблокировать' : 'Разблокировать'}
        >
          <Ban className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {user.is_active !== false ? 'Блок.' : 'Разблок.'}
          </span>
        </button>
        {user.role !== 'SUPER_ADMIN' && (
          <button
            onClick={() => onDelete(user.id, user.name)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Удалить</span>
          </button>
        )}
      </div>
    </div>
  )
}
