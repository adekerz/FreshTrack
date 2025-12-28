/**
 * Modal Component
 * Accessible modal dialog with animations
 * Focus trap, escape to close, backdrop click
 * WCAG 2.1 compliant
 */

import { useEffect, useRef, useCallback, useId } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { trapFocus, announce, prefersReducedMotion } from '../../utils/a11y'

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  footer,
  ariaLabel,
}) {
  const modalRef = useRef(null)
  const previousActiveElement = useRef(null)
  const uniqueId = useId()
  const titleId = `modal-title-${uniqueId}`
  const descId = `modal-desc-${uniqueId}`
  const reducedMotion = prefersReducedMotion()

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-4rem)]',
  }

  // Handle escape key
  const handleKeyDown = useCallback((e) => {
    if (closeOnEscape && e.key === 'Escape') {
      onClose()
    }
  }, [closeOnEscape, onClose])

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose()
    }
  }

  // Focus trap and restore
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'

      // Announce modal opening to screen readers
      if (title) {
        announce(`Dialog opened: ${title}`)
      }

      // Set up focus trap
      let cleanupFocusTrap
      const timer = setTimeout(() => {
        if (modalRef.current) {
          cleanupFocusTrap = trapFocus(modalRef.current)
        }
      }, 100)

      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
        clearTimeout(timer)
        cleanupFocusTrap?.()
        previousActiveElement.current?.focus()
      }
    }
  }, [isOpen, handleKeyDown, title])

  if (!isOpen) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${reducedMotion ? '' : 'animate-fade-in'}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={!title ? ariaLabel : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizes[size]}
          bg-card rounded-2xl shadow-soft-lg
          ${reducedMotion ? '' : 'animate-scale-in'}
          max-h-[calc(100vh-2rem)] flex flex-col
          transition-colors duration-300
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-4 md:p-6 border-b border-border flex-shrink-0">
            <div>
              {title && (
                <h2 id={titleId} className="text-xl font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -m-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close dialog"
                type="button"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 md:p-6 border-t border-border flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
