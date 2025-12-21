/**
 * Button Component
 * Reusable button with variants, sizes, and states
 * Follows Fitts's Law - adequate touch targets
 */

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent/90 active:bg-accent/80 focus:ring-accent/50',
  secondary: 'bg-white dark:bg-dark-surface text-charcoal dark:text-cream border border-sand dark:border-dark-border hover:bg-sand/50 dark:hover:bg-white/10 active:bg-sand dark:active:bg-white/20 focus:ring-warmgray/30',
  ghost: 'text-charcoal dark:text-cream hover:bg-sand/50 dark:hover:bg-white/10 active:bg-sand dark:active:bg-white/20 focus:ring-warmgray/30',
  danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80 focus:ring-danger/50',
  success: 'bg-success text-white hover:bg-success/90 active:bg-success/80 focus:ring-success/50',
  outline: 'border border-accent text-accent hover:bg-accent/5 active:bg-accent/10 focus:ring-accent/50',
}

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0',
  'icon-sm': 'h-8 w-8 p-0',
  'icon-lg': 'h-12 w-12 p-0',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        font-medium rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
