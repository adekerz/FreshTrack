import { useState, useEffect, useRef } from 'react'
import { X, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../utils/classNames'
import TouchButton from '../ui/TouchButton'

/**
 * Mobile-optimized sidebar with:
 * - Hamburger menu toggle
 * - Slide-in animation
 * - Backdrop overlay
 * - Auto-close on navigation
 * - Swipe-to-close gesture
 */
export default function MobileSidebar({ children, isOpen, onClose, onOpen }) {
  const location = useLocation()
  const panelRef = useRef(null)

  // Auto-close on route change
  useEffect(() => {
    if (isOpen) onClose()
  }, [location.pathname, isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Swipe to close (on drawer panel)
  useEffect(() => {
    if (!isOpen || !panelRef.current) return

    let touchStartX = 0
    let touchEndX = 0
    const el = panelRef.current

    const handleTouchStart = (e) => {
      touchStartX = e.touches?.[0]?.screenX ?? e.changedTouches?.[0]?.screenX ?? 0
    }

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches?.[0]?.screenX ?? e.touches?.[0]?.screenX ?? 0
      if (touchStartX - touchEndX > 80) onClose()
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isOpen, onClose])

  return (
    <>
      {/* Hamburger button - visible on mobile only, hidden when drawer open */}
      {!isOpen && (
        <TouchButton
          type="button"
          variant="primary"
          size="icon"
          onClick={onOpen}
          className={cn(
            'fixed left-4 top-4 z-30 rounded-xl bg-charcoal text-cream shadow-lg hover:bg-charcoal/90',
            'sm:hidden'
          )}
          aria-label="Open menu"
          aria-expanded={isOpen}
          icon={Menu}
        />
      )}

      {/* Backdrop overlay */}
      {isOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 bg-black/50 dark:bg-black/60 z-40 sm:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw]',
          'bg-charcoal text-cream flex flex-col',
          'transform transition-transform duration-300 ease-out',
          'sm:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button - mobile only */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <span className="font-serif text-lg tracking-wide text-cream">Menu</span>
          <TouchButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-cream/80 hover:text-cream hover:bg-white/10"
            aria-label="Close menu"
            icon={X}
          />
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  )
}
