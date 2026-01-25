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
import TouchButton from './TouchButton'

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

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-4rem)]',
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
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${reducedMotion ? '' : 'animate-fade-in'}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={!title ? ariaLabel : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal: mobile slide-up bottom sheet, desktop centered */}
      <div
        ref={modalRef}
        className={`
          relative w-full flex flex-col
          max-h-[90vh] sm:max-h-[85vh]
          rounded-t-2xl sm:rounded-2xl
          ${sizeClasses[size] ?? sizeClasses.md}
          bg-card shadow-soft-lg
          ${reducedMotion ? '' : 'animate-scale-in'}
          transition-colors duration-300 overflow-hidden
          ${className}
        `}
      >
        {/* Header — sticky on mobile */}
        {(title || showCloseButton) && (
          <div className="relative sticky top-0 z-10 flex items-start justify-between p-4 sm:p-6 border-b border-border flex-shrink-0 bg-card">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-xl font-semibold text-foreground truncate pr-10">
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
              <TouchButton
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 -m-2 p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close dialog"
                type="button"
                icon={X}
              />
            )}
          </div>
        )}

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>

        {/* Footer — sticky on mobile */}
        {footer && (
          <div className="sticky bottom-0 flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-border flex-shrink-0 bg-card">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
