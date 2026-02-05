/**
 * Card Component
 * Container with variants for different use cases
 * Follows Law of Common Region - group related content
 * Enhanced with smooth hover effects and micro-interactions
 */

import { forwardRef } from 'react'
import { cardHover } from '../../utils/animations'

const variants = {
  default: 'bg-card border border-border',
  elevated: `bg-card shadow-soft ${cardHover.subtle}`,
  interactive: `bg-card border border-border ${cardHover.interactive}`,
  ghost: 'bg-transparent',
  accent: 'bg-accent/5 border border-accent/20',
}

const Card = forwardRef(({
  children,
  variant = 'default',
  className = '',
  padding = true,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={`
        rounded-xl
        ${variants[variant]}
        ${padding ? 'p-4 md:p-6' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

// Card Header subcomponent
export const CardHeader = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
)

// Card Title subcomponent
export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-foreground ${className}`}>
    {children}
  </h3>
)

// Card Description subcomponent
export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-muted-foreground mt-1 ${className}`}>
    {children}
  </p>
)

// Card Content subcomponent
export const CardContent = ({ children, className = '' }) => (
  <div className={className}>
    {children}
  </div>
)

// Card Footer subcomponent
export const CardFooter = ({ children, className = '' }) => (
  <div className={`mt-4 pt-4 border-t border-border ${className}`}>
    {children}
  </div>
)

export default Card
