/**
 * TouchButton Component
 * Touch-optimized button (Apple HIG min 44×44px):
 * - Minimum 44×44px touch target, active feedback, loading state
 */

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/classNames'

const sizeMap = { sm: 'small', md: 'default', default: 'default', lg: 'large', icon: 'icon' }

const TouchButton = forwardRef(
  (
    {
      children,
      onClick,
      variant = 'primary',
      size = 'default',
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
    const s = sizeMap[size] ?? size

    const handleClick = (e) => {
      if (disabled || loading) return
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
      onClick?.(e)
    }

    const variants = {
      primary: 'bg-accent-button text-white hover:bg-accent-button/90 focus:ring-accent/20',
      secondary: 'bg-muted text-foreground hover:bg-muted/80 focus:ring-muted',
      danger: 'bg-danger text-white hover:bg-danger/90 focus:ring-danger/20',
      ghost: 'bg-transparent hover:bg-muted focus:ring-muted',
      success: 'bg-success text-white hover:bg-success/90 focus:ring-success/20',
      outline: 'bg-transparent border-2 border-accent text-accent hover:bg-accent/5 focus:ring-accent/20',
    }

    const sizes = {
      small: 'min-h-[36px] min-w-[36px] px-3 py-1.5 text-sm gap-1.5',
      default: 'min-h-[44px] min-w-[44px] px-4 py-2.5 text-base gap-2',
      large: 'min-h-[52px] min-w-[52px] px-6 py-3 text-lg gap-2.5',
      icon: 'min-h-[44px] min-w-[44px] p-0',
    }

    const iconSizes = { small: 'w-4 h-4', default: 'w-5 h-5', large: 'w-6 h-6', icon: 'w-5 h-5' }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-150 touch-manipulation select-none',
          '[&::-webkit-tap-highlight-color]:transparent',
          'active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variants[variant] ?? variants.primary,
          sizes[s] ?? sizes.default,
          fullWidth && 'w-full',
          className
        )}
        aria-busy={loading}
        {...props}
      >
        {loading && <Loader2 className={cn('animate-spin flex-shrink-0', iconSizes[s] ?? 'w-5 h-5')} />}
        {!loading && Icon && iconPosition === 'left' && <Icon className={iconSizes[s] ?? 'w-5 h-5'} />}
        {!loading && children}
        {!loading && Icon && iconPosition === 'right' && <Icon className={iconSizes[s] ?? 'w-5 h-5'} />}
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
