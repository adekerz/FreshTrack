/**
 * Tooltip Component
 * Accessible tooltips with CSS animations
 * WCAG 2.1 compliant - works with keyboard focus
 * No framer-motion dependency for optimal bundle size
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Tooltip - всплывающая подсказка
 * @param {React.Node} children - Trigger element
 * @param {string|React.Node} content - Tooltip content
 * @param {string} placement - Позиция ('top'|'bottom'|'left'|'right')
 * @param {number} delay - Задержка показа (мс)
 * @param {boolean} disabled - Отключить tooltip
 * @param {string} className - Дополнительные классы
 */
export default function Tooltip({
  children,
  content,
  placement = 'top',
  delay = 300,
  disabled = false,
  className = ''
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const timeoutRef = useRef(null)

  // Вычисление позиции tooltip
  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let top = 0
    let left = 0

    switch (placement) {
      case 'top':
        top = triggerRect.top + scrollY - tooltipRect.height - 8
        left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = triggerRect.bottom + scrollY + 8
        left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2
        left = triggerRect.left + scrollX - tooltipRect.width - 8
        break
      case 'right':
        top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2
        left = triggerRect.right + scrollX + 8
        break
      default:
        break
    }

    // Ensure tooltip stays in viewport
    const padding = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < padding) left = padding
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding
    }

    if (top < scrollY + padding) top = scrollY + padding
    if (top + tooltipRect.height > scrollY + viewportHeight - padding) {
      top = scrollY + viewportHeight - tooltipRect.height - padding
    }

    setPosition({ top, left })
  }

  const showTooltip = () => {
    if (disabled) return

    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  // Пересчитываем позицию при показе
  useEffect(() => {
    if (isVisible) {
      calculatePosition()

      // Recalculate on window resize/scroll
      const handleUpdate = () => calculatePosition()
      window.addEventListener('resize', handleUpdate)
      window.addEventListener('scroll', handleUpdate, true)

      return () => {
        window.removeEventListener('resize', handleUpdate)
        window.removeEventListener('scroll', handleUpdate, true)
      }
    }
  }, [isVisible])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Arrow position classes
  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2',
    left: 'right-[-4px] top-1/2 -translate-y-1/2',
    right: 'left-[-4px] top-1/2 -translate-y-1/2'
  }

  return (
    <>
      {/* Trigger element */}
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </span>

      {/* Tooltip portal */}
      {!disabled &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            aria-hidden={!isVisible}
            style={{
              position: 'absolute',
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 9999,
              pointerEvents: 'none',
              opacity: isVisible ? 1 : 0,
              visibility: isVisible ? 'visible' : 'hidden',
              transition: 'opacity 150ms ease-in-out, visibility 150ms ease-in-out'
            }}
            className={`
              bg-gray-900 dark:bg-gray-800
              text-white text-xs sm:text-sm
              px-3 py-2 rounded-lg shadow-lg
              max-w-xs sm:max-w-sm
              ${isVisible ? 'animate-scale-in' : ''}
              ${className}
            `}
          >
            {content}

            {/* Arrow */}
            <div
              className={`
                absolute w-2 h-2
                bg-gray-900 dark:bg-gray-800
                transform rotate-45
                ${arrowClasses[placement]}
              `}
            />
          </div>,
          document.body
        )}
    </>
  )
}

/**
 * TooltipIcon - иконка с tooltip
 * @param {Component} icon - Lucide icon component
 * @param {string} content - Tooltip content
 * @param {string} placement - Позиция tooltip
 */
export function TooltipIcon({ icon: Icon, content, placement = 'top' }) {
  return (
    <Tooltip content={content} placement={placement}>
      <span className="inline-flex text-muted-foreground hover:text-foreground transition-colors cursor-help">
        <Icon className="w-4 h-4" />
      </span>
    </Tooltip>
  )
}
