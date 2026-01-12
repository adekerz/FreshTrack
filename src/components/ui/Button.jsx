/**
 * Button Component
 * Reusable button with variants, sizes, and states
 * Follows Fitts's Law - adequate touch targets
 */

import { forwardRef } from 'react'
import { ButtonLoader } from './GridLoader'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent/90 active:bg-accent/80 focus:ring-accent/50',
  secondary:
    'bg-card text-foreground border border-border hover:bg-muted active:bg-muted/80 focus:ring-muted-foreground/30',
  ghost: 'text-foreground hover:bg-muted active:bg-muted/80 focus:ring-muted-foreground/30',
  danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80 focus:ring-danger/50',
  success: 'bg-success text-white hover:bg-success/90 active:bg-success/80 focus:ring-success/50',
  outline:
    'border border-accent text-accent hover:bg-accent/5 active:bg-accent/10 focus:ring-accent/50'
}

const sizes = {
  sm: 'h-10 px-3 text-sm gap-1.5', // 40px - adequate for secondary actions
  md: 'h-12 px-4 text-sm gap-2', // 48px - Material Design minimum touch target
  lg: 'h-14 px-6 text-base gap-2', // 56px - comfortable touch
  icon: 'h-12 w-12 p-0', // 48px square
  'icon-sm': 'h-10 w-10 p-0', // 40px square
  'icon-lg': 'h-14 w-14 p-0' // 56px square
}

const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      fullWidth = false,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        className={`
        inline-flex items-center justify-center
        font-medium rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        touch-manipulation
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
        {...props}
      >
        {loading && <ButtonLoader />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
