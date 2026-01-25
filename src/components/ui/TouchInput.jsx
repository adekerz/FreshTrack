import { forwardRef, useId } from 'react'
import { cn } from '../../utils/classNames'

/**
 * Touch-optimized input:
 * - Min 44px height, better focus/error states
 * - inputMode for mobile keyboards
 */
const TouchInput = forwardRef(
  (
    {
      label,
      error,
      helperText,
      type = 'text',
      inputMode,
      className = '',
      containerClassName = '',
      id: idProp,
      ...props
    },
    ref
  ) => {
    const genId = useId()
    const elId = idProp || `touch-input${genId.replace(/:/g, '-')}`

    const getInputMode = () => {
      if (inputMode) return inputMode
      if (type === 'email') return 'email'
      if (type === 'tel') return 'tel'
      if (type === 'number') return 'numeric'
      if (type === 'url') return 'url'
      return 'text'
    }

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={elId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={elId}
          type={type}
          inputMode={getInputMode()}
          className={cn(
            'w-full min-h-[44px] px-4 py-3 text-base sm:text-sm',
            'border rounded-lg bg-card text-foreground placeholder-muted-foreground',
            'transition-colors touch-manipulation',
            'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-danger focus:ring-danger/20 focus:border-danger'
              : 'border-border',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${elId}-error` : helperText ? `${elId}-helper` : undefined}
          {...props}
        />
        {(error || helperText) && (
          <p
            id={error ? `${elId}-error` : `${elId}-helper`}
            className={cn(
              'text-sm',
              error ? 'text-danger' : 'text-muted-foreground'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

TouchInput.displayName = 'TouchInput'

export default TouchInput
