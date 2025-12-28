/**
 * BottomSheet Component
 * Мобильный bottom sheet для фильтров и действий
 * Заменяет dropdown'ы на мобильных устройствах
 */

import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/classNames'

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showHandle = true,
  showCloseButton = true,
  maxHeight = '80vh',
  className = '',
}) {
  const sheetRef = useRef(null)
  const startY = useRef(0)
  const currentY = useRef(0)

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Блокировка скролла body при открытии
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Свайп для закрытия
  const handleTouchStart = useCallback((e) => {
    startY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e) => {
    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current
    
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const diff = currentY.current - startY.current
    
    if (sheetRef.current) {
      if (diff > 100) {
        // Свайп достаточно большой - закрываем
        onClose()
      } else {
        // Возвращаем на место
        sheetRef.current.style.transform = 'translateY(0)'
      }
    }
    startY.current = 0
    currentY.current = 0
  }, [onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'bg-card rounded-t-2xl shadow-xl',
          'transform transition-transform duration-300 ease-out',
          'animate-slide-up',
          className
        )}
        style={{ maxHeight }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-border rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            {title && (
              <h2
                id="bottom-sheet-title"
                className="text-lg font-semibold text-foreground"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-muted transition-colors touch-manipulation"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
          {children}
        </div>
      </div>
    </>
  )
}

/**
 * BottomSheetActions - компонент для действий (Apply, Clear) внизу sheet'а
 */
export function BottomSheetActions({ children, className = '' }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0',
        'p-4 bg-card border-t border-border',
        'safe-area-pb',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * FilterChips - компонент для фильтров в виде чипсов
 */
export function FilterChips({
  options,
  value,
  onChange,
  multiple = false,
  className = '',
}) {
  const handleSelect = (optionValue) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : []
      const newValue = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue]
      onChange(newValue)
    } else {
      onChange(value === optionValue ? null : optionValue)
    }
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const isSelected = (optionValue) => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue)
    }
    return value === optionValue
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleSelect(option.value)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium',
            'border transition-all duration-200',
            'touch-manipulation active:scale-95',
            isSelected(option.value)
              ? 'bg-accent/10 text-accent border-accent'
              : 'bg-muted text-foreground border-border hover:border-muted-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
