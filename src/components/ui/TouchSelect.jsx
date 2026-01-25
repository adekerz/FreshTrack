import { useId } from 'react'
import { cn } from '../../utils/classNames'

/**
 * Mobile-friendly select:
 * - Min 44px height, native on mobile
 * - Custom arrow, focus/error states
 */
export default function TouchSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Выберите...',
  error,
  className = '',
  containerClassName = '',
  id: idProp,
  disabled,
  ...props
}) {
  const genId = useId()
  const elId = idProp || `touch-select${genId.replace(/:/g, '-')}`

  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label htmlFor={elId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={elId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full min-h-[44px] pl-4 pr-10 py-3 text-base sm:text-sm',
          'border rounded-lg bg-card text-foreground',
          'appearance-none cursor-pointer touch-manipulation',
          'bg-no-repeat bg-[right_1rem_center]',
          'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-danger focus:ring-danger/20 focus:border-danger' : 'border-border',
          className
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='currentColor' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${elId}-error` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => {
          const item = typeof opt === 'object' && opt !== null && 'value' in opt
            ? opt
            : { value: opt, label: String(opt) }
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          )
        })}
      </select>
      {error && (
        <p id={`${elId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
