/**
 * FAB (Floating Action Button) Component
 * Material Design FAB для основного действия
 * Позиционируется над bottom navigation
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../../utils/classNames'

export default function FAB({
  onClick,
  icon: Icon = Plus,
  label = 'Добавить',
  variant = 'primary',
  size = 'md',
  position = 'bottom-right',
  className = '',
  disabled = false,
  loading = false,
}) {
  const variants = {
    primary: 'bg-accent text-white shadow-lg hover:bg-accent/90 active:bg-accent/80',
    secondary: 'bg-card text-foreground shadow-lg border border-border hover:bg-muted',
    danger: 'bg-danger text-white shadow-lg hover:bg-danger/90 active:bg-danger/80',
  }

  const sizes = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-16 w-16',
    extended: 'h-14 px-6 rounded-full', // Extended FAB с текстом
  }

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
    extended: 'w-5 h-5',
  }

  const positions = {
    'bottom-right': 'right-4 bottom-20', // Над bottom nav (56px + padding)
    'bottom-left': 'left-4 bottom-20',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-20',
    'top-right': 'right-4 top-20',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      className={cn(
        'fixed z-30',
        'flex items-center justify-center gap-2',
        'rounded-full',
        'transition-all duration-200',
        'touch-manipulation',
        'active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        size === 'extended' ? sizes.extended : `${sizes[size]} rounded-full`,
        positions[position],
        'safe-bottom', // Safe area для notch устройств
        className
      )}
      style={{
        // Дополнительный отступ для safe area на iOS
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {loading ? (
        <div className="animate-spin">
          <div className={cn(
            'border-2 border-current border-t-transparent rounded-full',
            iconSizes[size]
          )} />
        </div>
      ) : (
        <>
          <Icon className={iconSizes[size]} strokeWidth={2.5} />
          {size === 'extended' && (
            <span className="font-medium text-sm">{label}</span>
          )}
        </>
      )}
    </button>
  )
}

/**
 * SpeedDial - группа FAB с выплывающими действиями
 */
export function SpeedDial({
  actions,
  icon: MainIcon = Plus,
  label = 'Действия',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOpen = () => {
    setIsOpen(!isOpen)
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const handleAction = (action) => {
    setIsOpen(false)
    action.onClick?.()
  }

  return (
    <div className={cn('fixed right-4 bottom-20 z-30', className)}>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed dial actions */}
      <div className={cn(
        'absolute bottom-16 right-0 flex flex-col-reverse gap-3',
        'transition-all duration-200',
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}>
        {actions.map((action, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="bg-card shadow-md px-3 py-1.5 rounded-lg text-sm font-medium text-foreground">
              {action.label}
            </span>
            <button
              onClick={() => handleAction(action)}
              className={cn(
                'h-12 w-12 rounded-full',
                'bg-card shadow-lg',
                'flex items-center justify-center',
                'text-foreground',
                'transition-all duration-200',
                'touch-manipulation active:scale-95',
                'hover:bg-muted'
              )}
              aria-label={action.label}
            >
              <action.icon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={label}
        className={cn(
          'relative z-30',
          'h-14 w-14 rounded-full',
          'bg-accent text-white shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-200',
          'touch-manipulation active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2'
        )}
      >
        <MainIcon
          className={cn(
            'w-6 h-6 transition-transform duration-200',
            isOpen && 'rotate-45'
          )}
          strokeWidth={2.5}
        />
      </button>
    </div>
  )
}
