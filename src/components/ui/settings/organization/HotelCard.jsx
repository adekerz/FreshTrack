/**
 * HotelCard - Карточка отеля с департаментами и пользователями
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
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
          <Building2 className="w-5 h-5 text-accent" />
          <div>
            <h3 className="font-medium text-foreground">{hotel.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
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
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs ${
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
            className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isExpanded && <div className="border-t border-border">{children}</div>}
    </div>
  )
}
