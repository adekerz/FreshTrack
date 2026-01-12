/**
 * Input Component
 * Text input with floating label, icons, and validation
 * Min height 48px for touch accessibility
 */

import { forwardRef, useState } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  type = 'text',
  className = '',
  containerClassName = '',
  disabled = false,
  required = false,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const hasValue = props.value !== undefined ? props.value !== '' : false
  const isFloating = focused || hasValue

  const inputType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className={`relative ${containerClassName}`}>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon className="w-5 h-5" />
          </div>
        )}
        
        <input
          ref={ref}
          type={inputType}
          disabled={disabled}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          className={`
            peer w-full min-h-[48px] px-4 pt-5 pb-2
            bg-card border rounded-lg
            text-foreground placeholder-transparent
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-muted disabled:cursor-not-allowed
            ${Icon ? 'pl-11' : ''}
            ${type === 'password' ? 'pr-11' : ''}
            ${error 
              ? 'border-danger focus:border-danger focus:ring-danger/30' 
              : 'border-border focus:border-accent focus:ring-accent/30'
            }
            ${className}
          `}
          placeholder={label}
          {...props}
        />

        {label && (
          <label
            className={`
              absolute transition-all duration-200 pointer-events-none
              ${Icon ? 'left-11' : 'left-4'}
              ${isFloating 
                ? 'top-2 text-xs' 
                : 'top-1/2 -translate-y-1/2 text-sm'
              }
              ${error ? 'text-danger' : focused ? 'text-accent' : 'text-muted-foreground'}
            `}
          >
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}

        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-danger text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
