/**
 * FAB (Floating Action Button) Component
 * Material Design FAB для основного действия
 * Позиционируется над bottom navigation
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../../utils/classNames'
import TouchButton from './TouchButton'

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
    primary: 'bg-accent-button text-white shadow-lg hover:bg-accent-button/90 active:bg-accent-button/80',
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
    <TouchButton
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      aria-label={label}
      variant={variant === 'primary' ? 'primary' : variant === 'danger' ? 'danger' : 'secondary'}
      size="icon"
      icon={size === 'extended' ? undefined : Icon}
      className={cn(
        'fixed z-30',
        'flex items-center justify-center gap-2',
        'rounded-full',
        variants[variant],
        size === 'extended' ? `${sizes.extended} rounded-full` : sizes[size],
        positions[position],
        'safe-bottom',
        className
      )}
      style={{
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {size === 'extended' && !loading && (
        <>
          <Icon className={iconSizes.extended} strokeWidth={2.5} />
          <span className="font-medium text-sm">{label}</span>
        </>
      )}
    </TouchButton>
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
            <TouchButton
              variant="secondary"
              size="icon"
              onClick={() => handleAction(action)}
              className="h-12 w-12 rounded-full bg-card shadow-lg"
              aria-label={action.label}
              icon={action.icon}
            />
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <TouchButton
        variant="primary"
        size="icon"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={label}
        className={cn(
          'relative z-30 h-14 w-14 rounded-full shadow-lg',
          isOpen && '[&>svg]:rotate-45'
        )}
        icon={MainIcon}
      />
    </div>
  )
}
