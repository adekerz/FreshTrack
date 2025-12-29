/**
 * HotelSelector - Компонент выбора отеля для SUPER_ADMIN
 * Показывается в шапке страниц для фильтрации данных по отелю
 */

import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useHotel } from '../context/HotelContext'
import { useProducts } from '../context/ProductContext'

export default function HotelSelector({ className = '' }) {
  const { 
    hotels, 
    selectedHotel, 
    selectHotel, 
    canSelectHotel, 
    loading,
    isSuperAdmin 
  } = useHotel()
  const { refresh } = useProducts()
  
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

  // Загрузка
  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Загрузка...</span>
      </div>
    )
  }

  // Нет отелей
  if (!hotels.length) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg ${className}`}>
        <Building2 className="w-4 h-4 text-amber-600" />
        <span className="text-sm text-amber-700 dark:text-amber-400">Нет отелей</span>
      </div>
    )
  }

  // Только один отель - показываем без выпадающего списка
  if (!canSelectHotel) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg ${className}`}>
        <Building2 className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-foreground">{selectedHotel?.name || 'Отель'}</span>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 transition-colors min-w-[180px]"
      >
        <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
          {selectedHotel?.name || 'Выберите отель'}
        </span>
        <ChevronDown className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          {hotels.map((hotel) => (
            <button
              key={hotel.id}
              onClick={() => {
                selectHotel(hotel.id)
                setIsOpen(false)
                // Перезагружаем данные для нового отеля
                setTimeout(() => refresh(), 100)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors ${
                selectedHotel?.id === hotel.id ? 'bg-accent/10' : ''
              }`}
            >
              <Building2 className={`w-4 h-4 flex-shrink-0 ${
                selectedHotel?.id === hotel.id ? 'text-accent' : 'text-muted-foreground'
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  selectedHotel?.id === hotel.id ? 'text-accent' : 'text-foreground'
                }`}>
                  {hotel.name}
                </p>
                {hotel.code && (
                  <p className="text-xs text-muted-foreground truncate">
                    {hotel.code}
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
