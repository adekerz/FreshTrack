/**
 * FormField Component
 * Unified form field with label, error message, and helper text
 * Mobile-optimized with 16px font size to prevent iOS zoom
 * A11y: label связывается с полем через htmlFor/id
 */

import { forwardRef, useId, cloneElement, isValidElement } from 'react'

/**
 * FormField Component
 * @param {string} label - Field label
 * @param {string} error - Error message
 * @param {string} helperText - Helper text below input
 * @param {boolean} required - Required field indicator
 * @param {string} id - Id поля (для связи с label); если не передан — генерируется useId()
 * @param {React.Node} children - Input component (получит id для связи с label)
 */
export const FormField = forwardRef(
  ({ label, error, helperText, required, id: idProp, children, className = '' }, ref) => {
    const generatedId = useId()
    const fieldId = idProp || generatedId
    const inputId = isValidElement(children) && children.props?.id != null ? children.props.id : fieldId
    const errorId = error ? `${fieldId}-error` : undefined
    const childProps = { id: children?.props?.id ?? fieldId }
    if (error) {
      childProps['aria-invalid'] = true
      childProps['aria-describedby'] = errorId
    }
    const childWithId =
      isValidElement(children) && children.type !== 'div' && children.type !== 'span'
        ? cloneElement(children, childProps)
        : children

    return (
      <div className={`space-y-1.5 ${className}`} ref={ref}>
        {label && (
          <label htmlFor={inputId} className="block text-xs sm:text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        {childWithId}

        {error && (
          <p id={errorId} className="text-xs sm:text-sm text-danger flex items-start gap-1" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{error}</span>
          </p>
        )}

        {helperText && !error && (
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'

/**
 * Input Component
 * Mobile-optimized input with 16px font size to prevent iOS zoom
 */
export const Input = forwardRef(
  (
    {
      type = 'text',
      error,
      fullWidth = true,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`
          px-3 py-2
          text-sm sm:text-base
          min-h-[44px]
          bg-card text-foreground
          border border-border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted
          transition-colors
          ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

/**
 * Textarea Component
 * Mobile-optimized textarea with 16px font size
 */
export const Textarea = forwardRef(
  (
    {
      error,
      rows = 3,
      fullWidth = true,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`
          px-3 py-2
          text-sm sm:text-base
          min-h-[88px]
          bg-card text-foreground
          border border-border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted
          transition-colors
          resize-vertical
          ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

/**
 * Select Component
 * Mobile-optimized select with 16px font size
 */
export const Select = forwardRef(
  (
    {
      error,
      fullWidth = true,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <select
        ref={ref}
        className={`
          px-3 py-2
          text-sm sm:text-base
          min-h-[44px]
          bg-card text-foreground
          border border-border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted
          transition-colors
          cursor-pointer
          ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'

export default FormField
