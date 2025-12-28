/**
 * PullToRefresh Component
 * Жест "потянуть для обновления" для мобильных устройств
 */

import { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '../../utils/classNames'

const PULL_THRESHOLD = 80 // Минимальная дистанция для активации
const MAX_PULL = 120      // Максимальная дистанция pull

export default function PullToRefresh({
  onRefresh,
  children,
  className = '',
  disabled = false,
}) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef(null)

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return
    
    // Проверяем, что скроллер в самом верху
    const scrollTop = containerRef.current?.scrollTop || window.scrollY
    if (scrollTop > 0) return
    
    startY.current = e.touches[0].clientY
    setIsPulling(true)
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e) => {
    if (!isPulling || disabled || isRefreshing) return
    
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    
    if (diff > 0) {
      // Добавляем сопротивление для естественного ощущения
      const resistance = 0.5
      const newDistance = Math.min(MAX_PULL, diff * resistance)
      setPullDistance(newDistance)
      
      // Предотвращаем скролл страницы
      if (newDistance > 10) {
        e.preventDefault()
      }
    }
  }, [isPulling, disabled, isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return
    
    setIsPulling(false)
    
    if (pullDistance >= PULL_THRESHOLD && onRefresh) {
      setIsRefreshing(true)
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(20)
      
      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [isPulling, pullDistance, onRefresh, disabled])

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD)
  const shouldTrigger = pullDistance >= PULL_THRESHOLD

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex items-center justify-center',
          'transition-opacity duration-200',
          'pointer-events-none z-10',
          (pullDistance > 0 || isRefreshing) ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: 0,
          height: Math.max(pullDistance, isRefreshing ? 60 : 0),
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-card shadow-md border border-border',
            'transition-transform duration-200',
            shouldTrigger && !isRefreshing && 'scale-110'
          )}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5 text-accent',
              'transition-transform duration-200',
              isRefreshing && 'animate-spin'
            )}
            style={{
              transform: isRefreshing 
                ? undefined 
                : `rotate(${progress * 180}deg)`
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: isRefreshing 
            ? 'translateY(60px)' 
            : `translateY(${pullDistance}px)`
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Hook для pull-to-refresh логики
 * Можно использовать отдельно от компонента
 */
export function usePullToRefresh({ onRefresh, threshold = 80 }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)

  const handlers = {
    onTouchStart: (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY
      }
    },
    onTouchMove: (e) => {
      if (startY.current === 0) return
      const diff = e.touches[0].clientY - startY.current
      if (diff > 0) {
        setPullDistance(Math.min(threshold * 1.5, diff * 0.5))
      }
    },
    onTouchEnd: async () => {
      if (pullDistance >= threshold && onRefresh && !isRefreshing) {
        setIsRefreshing(true)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
        }
      }
      setPullDistance(0)
      startY.current = 0
    },
  }

  return {
    pullDistance,
    isRefreshing,
    progress: pullDistance / threshold,
    handlers,
  }
}
