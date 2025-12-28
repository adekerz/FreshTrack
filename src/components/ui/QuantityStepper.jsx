/**
 * QuantityStepper Component
 * Touch-friendly quantity input with +/- buttons
 * Material Design 48px minimum touch targets
 */

import { Minus, Plus } from 'lucide-react'
import { cn } from '../../utils/classNames'

export default function QuantityStepper({
  value = 0,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled = false,
  size = 'md',
  className = '',
  label,
  error,
}) {
  const handleDecrease = () => {
    const newValue = Math.max(min, value - step)
    onChange?.(newValue)
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step)
    onChange?.(newValue)
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10)
  }

  const handleInputChange = (e) => {
    const inputValue = e.target.value
    if (inputValue === '') {
      onChange?.(min)
      return
    }
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed))
      onChange?.(clamped)
    }
  }

  const sizes = {
    sm: {
      button: 'h-10 w-10',
      input: 'h-10 w-16 text-base',
      icon: 'w-4 h-4',
    },
    md: {
      button: 'h-12 w-12',
      input: 'h-12 w-20 text-lg',
      icon: 'w-5 h-5',
    },
    lg: {
      button: 'h-14 w-14',
      input: 'h-14 w-24 text-xl',
      icon: 'w-6 h-6',
    },
  }

  const sizeConfig = sizes[size]

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDecrease}
          disabled={disabled || value <= min}
          aria-label="Уменьшить количество"
          className={cn(
            sizeConfig.button,
            'flex items-center justify-center rounded-xl',
            'bg-muted text-foreground',
            'transition-all duration-150',
            'active:scale-95 touch-manipulation',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
            'hover:bg-muted/80 focus:ring-2 focus:ring-accent/50 focus:outline-none'
          )}
        >
          <Minus className={sizeConfig.icon} strokeWidth={2.5} />
        </button>

        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          min={min}
          max={max}
          aria-label="Количество"
          className={cn(
            sizeConfig.input,
            'text-center font-medium tabular-nums',
            'border border-border rounded-xl',
            'bg-card text-foreground',
            'focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200',
            error && 'border-danger focus:border-danger focus:ring-danger/30'
          )}
        />

        <button
          type="button"
          onClick={handleIncrease}
          disabled={disabled || value >= max}
          aria-label="Увеличить количество"
          className={cn(
            sizeConfig.button,
            'flex items-center justify-center rounded-xl',
            'bg-muted text-foreground',
            'transition-all duration-150',
            'active:scale-95 touch-manipulation',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
            'hover:bg-muted/80 focus:ring-2 focus:ring-accent/50 focus:outline-none'
          )}
        >
          <Plus className={sizeConfig.icon} strokeWidth={2.5} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
