/**
 * TouchButton Component
 * Простой touch-оптимизированный button с Material Design стандартами
 * 48px минимальный размер, haptic feedback, active states
 */

import { forwardRef } from 'react'
import { ButtonLoader } from './GridLoader'
import { cn } from '../../utils/classNames'

const TouchButton = forwardRef(
  (
    {
      children,
      onClick,
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      loading = false,
      disabled = false,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const handleClick = (e) => {
      if (disabled || loading) return

      // Haptic feedback на поддерживаемых устройствах
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }

      onClick?.(e)
    }

    const variants = {
      primary: cn(
        'bg-accent text-white',
        'hover:bg-accent/90',
        'active:bg-accent/80',
        'focus:ring-accent/50'
      ),
      secondary: cn(
        'bg-muted text-foreground border border-border',
        'hover:bg-muted/80',
        'active:bg-muted/60',
        'focus:ring-muted-foreground/30'
      ),
      ghost: cn(
        'bg-transparent text-foreground',
        'hover:bg-muted/50',
        'active:bg-muted',
        'focus:ring-muted-foreground/30'
      ),
      danger: cn(
        'bg-danger text-white',
        'hover:bg-danger/90',
        'active:bg-danger/80',
        'focus:ring-danger/50'
      ),
      success: cn(
        'bg-success text-white',
        'hover:bg-success/90',
        'active:bg-success/80',
        'focus:ring-success/50'
      ),
      outline: cn(
        'bg-transparent border-2 border-accent text-accent',
        'hover:bg-accent/5',
        'active:bg-accent/10',
        'focus:ring-accent/50'
      )
    }

    const sizes = {
      sm: 'min-h-[40px] min-w-[40px] px-3 py-2 text-sm gap-1.5',
      md: 'min-h-[48px] min-w-[48px] px-4 py-2.5 text-base gap-2',
      lg: 'min-h-[56px] min-w-[56px] px-6 py-3 text-lg gap-2.5',
      icon: 'min-h-[48px] min-w-[48px] p-0'
    }

    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      icon: 'w-6 h-6'
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center',
          'font-medium rounded-xl',
          'transition-all duration-150',

          // Touch optimizations
          'touch-manipulation',
          '-webkit-tap-highlight-color-transparent',
          'select-none',

          // Active state (scale down)
          'active:scale-[0.97]',

          // Focus state
          'focus:outline-none focus:ring-2 focus:ring-offset-2',

          // Disabled state
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',

          // Variant & Size
          variants[variant],
          sizes[size],

          // Width
          fullWidth && 'w-full',

          className
        )}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <ButtonLoader />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
          </>
        )}
      </button>
    )
  }
)

TouchButton.displayName = 'TouchButton'

export default TouchButton

/**
 * IconButton - специализированная версия для иконок
 */
export const IconButton = forwardRef(
  ({ icon: Icon, label, variant = 'ghost', size = 'md', badge, className = '', ...props }, ref) => {
    const sizes = {
      sm: 'h-10 w-10',
      md: 'h-12 w-12',
      lg: 'h-14 w-14'
    }

    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6'
    }

    return (
      <TouchButton
        ref={ref}
        variant={variant}
        aria-label={label}
        className={cn(sizes[size], 'rounded-full p-0', className)}
        {...props}
      >
        <div className="relative">
          <Icon className={iconSizes[size]} />
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                'absolute -top-1 -right-1',
                'min-w-[16px] h-[16px]',
                'flex items-center justify-center',
                'bg-danger text-white text-[10px] font-bold',
                'rounded-full px-1'
              )}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      </TouchButton>
    )
  }
)

IconButton.displayName = 'IconButton'
