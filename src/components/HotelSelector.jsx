/**
 * HotelSelector - Компонент выбора отеля для SUPER_ADMIN
 * Показывается в шапке страниц для фильтрации данных по отелю
 */

import { Building2, ChevronDown, Check } from 'lucide-react'
import { InlineLoader } from './ui'
import { useState, useRef, useEffect } from 'react'
import { useHotel } from '../context/HotelContext'
import { cn } from '../utils/classNames'

export default function HotelSelector({ className = '' }) {
  const { hotels, selectedHotel, selectHotel, canSelectHotel, loading, isSuperAdmin } = useHotel()

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Не показываем, если пользователь не может выбирать отель
  if (!isSuperAdmin) return null

  const compactCls = 'min-w-0 max-w-[120px] sm:max-w-none flex-1 sm:flex-initial'

  // Загрузка
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-2 sm:px-3 py-2 bg-muted/50 rounded-lg', compactCls, className)}>
        <InlineLoader />
        <span className="text-sm text-muted-foreground truncate">Загрузка...</span>
      </div>
    )
  }

  // Нет отелей
  if (!hotels.length) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 sm:px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg',
          compactCls,
          className
        )}
      >
        <Building2 className="w-4 h-4 flex-shrink-0 text-amber-600" />
        <span className="text-sm text-amber-700 dark:text-amber-400 truncate min-w-0">Нет отелей</span>
      </div>
    )
  }

  // Только один отель - показываем без выпадающего, но всё равно показываем для SUPER_ADMIN
  if (hotels.length === 1) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 sm:px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg',
          compactCls,
          className
        )}
      >
        <Building2 className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-foreground truncate min-w-0">
          {selectedHotel?.name || hotels[0]?.name}
        </span>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className={cn('relative min-w-0 flex-1 max-w-[120px] sm:max-w-none sm:flex-initial', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={selectedHotel?.name ? `Отель: ${selectedHotel.name}` : 'Выберите отель'}
        className="flex items-center gap-2 px-2 sm:px-3 py-2 min-h-[44px] bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 transition-colors min-w-0 w-full sm:min-w-[180px] touch-manipulation"
      >
        <Building2 className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-foreground flex-1 min-w-0 text-left truncate">
          {selectedHotel?.name || 'Выберите отель'}
        </span>
        <ChevronDown
          className={cn('w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          {hotels.map((hotel) => (
            <button
              type="button"
              key={hotel.id}
              onClick={() => {
                selectHotel(hotel.id)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-left hover:bg-muted transition-colors touch-manipulation ${
                selectedHotel?.id === hotel.id ? 'bg-accent/10' : ''
              }`}
            >
              <Building2
                className={`w-4 h-4 flex-shrink-0 ${
                  selectedHotel?.id === hotel.id ? 'text-accent' : 'text-muted-foreground'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    selectedHotel?.id === hotel.id ? 'text-accent' : 'text-foreground'
                  }`}
                >
                  {hotel.name}
                </p>
                {hotel.marsha_code && (
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    {hotel.marsha_code}
                  </p>
                )}
              </div>
              {selectedHotel?.id === hotel.id && (
                <Check className="w-4 h-4 text-accent flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
