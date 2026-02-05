/**
 * AnimatedPage Component
 * Wraps page content with entrance animations
 * Respects user's motion preferences for accessibility
 */

import { useEffect, useRef } from 'react'
import { pageTransition, prefersReducedMotion } from '../utils/animations'

/**
 * AnimatedPage - оборачивает контент страницы с анимацией входа
 * @param {React.Node} children - Контент страницы
 * @param {string} className - Дополнительные классы
 * @param {boolean} animate - Включить анимацию (по умолчанию true)
 */
export default function AnimatedPage({
  children,
  className = '',
  animate = true
}) {
  const ref = useRef(null)

  useEffect(() => {
    // Skip animation if user prefers reduced motion
    if (!animate || prefersReducedMotion()) {
      return
    }

    // Add entrance animation
    const element = ref.current
    if (element) {
      element.classList.add(pageTransition.enter)
    }
  }, [animate])

  return (
    <div
      ref={ref}
      className={`${className}`}
    >
      {children}
    </div>
  )
}
