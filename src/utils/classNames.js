import { clsx } from 'clsx'

/**
 * Merge class names conditionally
 * @param  {...any} inputs - Class names or conditional objects
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return clsx(inputs)
}

/**
 * Get status color class
 * @param {string} color - Color name (success, warning, danger)
 * @returns {object} - Tailwind classes for background and text
 */
export function getStatusClasses(color) {
  const classes = {
    success: {
      bg: 'bg-success/10',
      text: 'text-success',
      border: 'border-success'
    },
    warning: {
      bg: 'bg-warning/10',
      text: 'text-warning',
      border: 'border-warning'
    },
    danger: {
      bg: 'bg-danger/10',
      text: 'text-danger',
      border: 'border-danger'
    }
  }
  return classes[color] || classes.success
}
