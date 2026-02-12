/**
 * HotelCard - Карточка отеля с департаментами и пользователями
 * Мобилка: название в 2 строки, статус и кнопки не сдавливаются
 */

import { Building2, ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react'

export default function HotelCard({
  hotel,
  isExpanded,
  onToggle,
  onDelete,
  onCopyCode,
  children
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {/* Верхняя строка: chevron + иконка + название + кнопки */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <Building2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />

          {/* Название — растягивается, переносится */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground leading-snug">{hotel.name}</h3>
          </div>

          {/* Статус + удаление — не сжимаются */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                hotel.is_active !== false
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {hotel.is_active !== false ? 'Активен' : 'Неактивен'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(hotel.id, hotel.name)
              }}
              className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
              title="Удалить отель"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Нижняя строка: MARSHA код + счётчики */}
        <div className="flex items-center gap-2 mt-2 ml-[52px] flex-wrap">
          {hotel.marsha_code && (
            <>
              <code className="text-xs bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded text-purple-700 dark:text-purple-400 font-mono">
                {hotel.marsha_code}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCopyCode(hotel.marsha_code)
                }}
                className="p-1 hover:bg-muted rounded"
                title="Копировать MARSHA код"
              >
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
            </>
          )}
          <span className="text-xs text-muted-foreground">
            • {hotel.departments?.length || 0} деп. • {hotel.users?.length || 0} польз.
          </span>
        </div>
      </div>

      {isExpanded && <div className="border-t border-border">{children}</div>}
    </div>
  )
}
