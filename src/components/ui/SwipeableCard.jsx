/**
 * SwipeableCard Component
 * Карточка со свайп-действиями (удаление, редактирование)
 * Реализует swipe-to-reveal pattern
 */

import { useState, useRef, useCallback } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { cn } from '../../utils/classNames'
import { useTranslation } from '../../context/LanguageContext'

const SWIPE_THRESHOLD = 80 // Минимальный свайп для активации действия
const ACTION_WIDTH = 80   // Ширина области действия

export default function SwipeableCard({
  children,
  onDelete,
  onEdit,
  disabled = false,
  className = '',
  deleteLabel,
  editLabel,
}) {
  const { t } = useTranslation()
  const [translateX, setTranslateX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)
  const containerRef = useRef(null)

  const handleTouchStart = useCallback((e) => {
    if (disabled) return
    startX.current = e.touches[0].clientX
    currentX.current = startX.current
    setIsSwiping(true)
  }, [disabled])

  const handleTouchMove = useCallback((e) => {
    if (!isSwiping || disabled) return
    
    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current
    
    // Ограничиваем свайп влево (для показа действий справа)
    const maxSwipe = onDelete && onEdit ? -ACTION_WIDTH * 2 : -ACTION_WIDTH
    const newTranslate = Math.max(maxSwipe, Math.min(0, diff))
    
    setTranslateX(newTranslate)
  }, [isSwiping, disabled, onDelete, onEdit])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping || disabled) return
    
    setIsSwiping(false)
    const diff = currentX.current - startX.current
    
    // Если свайп достаточно большой - показываем действия
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      const maxSwipe = onDelete && onEdit ? -ACTION_WIDTH * 2 : -ACTION_WIDTH
      setTranslateX(maxSwipe)
    } else {
      // Возвращаем на место
      setTranslateX(0)
    }
  }, [isSwiping, disabled, onDelete, onEdit])

  const handleAction = (action) => {
    // Закрываем свайп
    setTranslateX(0)
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(15)
    // Выполняем действие
    action?.()
  }

  const resetSwipe = () => {
    setTranslateX(0)
  }

  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-hidden rounded-xl', className)}
    >
      {/* Действия (справа за карточкой) */}
      <div className="absolute inset-y-0 right-0 flex">
        {onEdit && (
          <button
            onClick={() => handleAction(onEdit)}
            className={cn(
              'flex items-center justify-center',
              'bg-accent-button text-white',
              'touch-manipulation transition-opacity',
              'min-h-[48px]'
            )}
            style={{ width: ACTION_WIDTH }}
            aria-label={editLabel || t('actions.edit') || 'Редактировать'}
          >
            <Edit2 className="w-5 h-5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => handleAction(onDelete)}
            className={cn(
              'flex items-center justify-center',
              'bg-danger text-white',
              'touch-manipulation transition-opacity',
              'min-h-[48px]'
            )}
            style={{ width: ACTION_WIDTH }}
            aria-label={deleteLabel || t('actions.delete') || 'Удалить'}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Основной контент карточки */}
      <div
        className={cn(
          'relative bg-card',
          'transition-transform duration-200 ease-out',
          isSwiping && 'transition-none'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={translateX < 0 ? resetSwipe : undefined}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Hook для определения поддержки свайпа
 */
export function useSwipeSupport() {
  const isTouchDevice = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  
  return { isTouchDevice }
}
