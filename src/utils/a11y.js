/**
 * Accessibility utilities for FreshTrack
 * Based on A11Y Project checklist and WCAG 2.1 guidelines
 */

/**
 * Announce message to screen readers via ARIA live region
 * @param {string} message - The message to announce
 * @param {'polite' | 'assertive'} priority - Announcement priority
 */
export function announce(message, priority = 'polite') {
  const liveRegion = document.getElementById('aria-live-region')
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', priority)
    liveRegion.textContent = message
    
    // Clear after announcement to allow repeated announcements
    setTimeout(() => {
      liveRegion.textContent = ''
    }, 1000)
  }
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers high contrast
 * @returns {boolean}
 */
export function prefersHighContrast() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Trap focus within an element (for modals)
 * @param {HTMLElement} element - The element to trap focus within
 * @returns {() => void} - Cleanup function
 */
export function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus()
        e.preventDefault()
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus()
        e.preventDefault()
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown)
  firstFocusable?.focus()

  return () => {
    element.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Generate unique ID for form elements
 * @param {string} prefix - ID prefix
 * @returns {string}
 */
export function generateId(prefix = 'a11y') {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get appropriate aria-describedby value for input with error
 * @param {string} inputId - The input element ID
 * @param {string} error - Error message if any
 * @param {string} hint - Hint text if any
 * @returns {string | undefined}
 */
export function getAriaDescribedBy(inputId, error, hint) {
  const ids = []
  if (error) ids.push(`${inputId}-error`)
  if (hint) ids.push(`${inputId}-hint`)
  return ids.length > 0 ? ids.join(' ') : undefined
}

/**
 * Check color contrast ratio (simplified)
 * For full WCAG compliance, use a dedicated tool
 * @param {string} foreground - Hex color
 * @param {string} background - Hex color
 * @returns {number} - Contrast ratio
 */
export function getContrastRatio(foreground, background) {
  const getLuminance = (hex) => {
    const rgb = parseInt(hex.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast meets WCAG AA requirements
 * @param {number} ratio - Contrast ratio
 * @param {'normal' | 'large'} textSize - Text size category
 * @returns {boolean}
 */
export function meetsWCAGAA(ratio, textSize = 'normal') {
  return textSize === 'large' ? ratio >= 3 : ratio >= 4.5
}

/**
 * Format number for screen readers in Russian
 * @param {number} num - Number to format
 * @param {string} unit - Unit label
 * @returns {string} Formatted string
 */
export function formatNumberForSR(num, unit = '') {
  if (num === 0) return `ноль ${unit}`.trim()
  if (num === 1) return `один ${unit}`.trim()
  return `${num} ${unit}`.trim()
}

/**
 * Get status announcement for screen readers
 * @param {string} status - Status type
 * @param {number} daysLeft - Days until expiry
 * @returns {string} Announcement text
 */
export function getStatusAnnouncement(status, daysLeft) {
  switch (status) {
    case 'expired':
      return `Просрочено ${Math.abs(daysLeft)} дней назад`
    case 'critical':
      return `Критично: истекает через ${daysLeft} дней`
    case 'warning':
      return `Внимание: истекает через ${daysLeft} дней`
    case 'good':
      return `В норме: ${daysLeft} дней до истечения`
    default:
      return ''
  }
}

/**
 * Create accessible button attributes
 * @param {Object} options - Button options
 * @returns {Object} Accessibility attributes
 */
export function getButtonA11yProps({ disabled, loading, label }) {
  return {
    'aria-disabled': disabled || loading,
    'aria-busy': loading,
    'aria-label': label,
    tabIndex: disabled ? -1 : 0,
  }
}

/**
 * Log accessibility audit to console
 * Use in development to check for common issues
 */
export function runA11yAudit() {
  if (typeof document === 'undefined') return

  const issues = []

  // Check for images without alt text
  document.querySelectorAll('img:not([alt])').forEach(img => {
    issues.push({
      type: 'error',
      element: img,
      message: 'Image missing alt attribute',
      wcag: '1.1.1 Non-text Content'
    })
  })

  // Check for buttons without accessible name
  document.querySelectorAll('button').forEach(btn => {
    if (!btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')) {
      issues.push({
        type: 'error',
        element: btn,
        message: 'Button missing accessible name',
        wcag: '4.1.2 Name, Role, Value'
      })
    }
  })

  // Check for form inputs without labels
  document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').forEach(input => {
    const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`)
    const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
    
    if (!hasLabel && !hasAriaLabel) {
      issues.push({
        type: 'error',
        element: input,
        message: 'Form input missing label',
        wcag: '1.3.1 Info and Relationships'
      })
    }
  })

  // Check for links without accessible name
  document.querySelectorAll('a[href]').forEach(link => {
    if (!link.textContent?.trim() && !link.getAttribute('aria-label')) {
      issues.push({
        type: 'error',
        element: link,
        message: 'Link missing accessible name',
        wcag: '2.4.4 Link Purpose'
      })
    }
  })

  // Log results
  console.group('🔍 A11y Quick Audit')
  if (issues.length === 0) {
    console.log('✅ No common accessibility issues found')
  } else {
    console.error(`❌ Found ${issues.length} potential issues:`)
    issues.forEach((issue, i) => {
      console.group(`${i + 1}. ${issue.message}`)
      console.log('WCAG:', issue.wcag)
      console.log('Element:', issue.element)
      console.groupEnd()
    })
  }
  console.groupEnd()

  return issues
}

// Expose to window for development testing
if (typeof window !== 'undefined' && import.meta.env?.MODE === 'development') {
  window.runA11yAudit = runA11yAudit
}
