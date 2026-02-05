/**
 * AnimatedList Component
 * Renders list items with staggered entrance animations
 * Optimized for performance with CSS-only animations
 */

import { fadeInWithDelay, prefersReducedMotion } from '../utils/animations'

/**
 * AnimatedList - список с staggered анимацией
 * @param {React.Node} children - Элементы списка
 * @param {string} className - Дополнительные классы для контейнера
 * @param {number} staggerDelay - Задержка между элементами (мс)
 * @param {boolean} animate - Включить анимацию
 */
export default function AnimatedList({
  children,
  className = '',
  staggerDelay = 50,
  animate = true
}) {
  // Skip animation if user prefers reduced motion or if disabled
  const shouldAnimate = animate && !prefersReducedMotion()

  // Convert children to array
  const childArray = Array.isArray(children) ? children : [children]

  return (
    <div className={className}>
      {childArray.map((child, index) => {
        if (!child) return null

        const animationClass = shouldAnimate
          ? fadeInWithDelay(index, staggerDelay * 10)
          : ''

        return (
          <div key={child.key || index} className={animationClass}>
            {child}
          </div>
        )
      })}
    </div>
  )
}

/**
 * AnimatedGrid - сетка с staggered анимацией
 * @param {React.Node} children - Элементы сетки
 * @param {string} columns - Количество колонок (Tailwind classes)
 * @param {string} gap - Промежутки между элементами
 * @param {number} staggerDelay - Задержка между элементами (мс)
 * @param {boolean} animate - Включить анимацию
 */
export function AnimatedGrid({
  children,
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  gap = 'gap-4',
  staggerDelay = 50,
  animate = true
}) {
  const shouldAnimate = animate && !prefersReducedMotion()
  const childArray = Array.isArray(children) ? children : [children]

  return (
    <div className={`grid ${columns} ${gap}`}>
      {childArray.map((child, index) => {
        if (!child) return null

        const animationClass = shouldAnimate
          ? fadeInWithDelay(index, staggerDelay * 10)
          : ''

        return (
          <div key={child.key || index} className={animationClass}>
            {child}
          </div>
        )
      })}
    </div>
  )
}

/**
 * AnimatedStack - вертикальный stack с staggered анимацией
 * @param {React.Node} children - Элементы stack
 * @param {string} gap - Промежутки между элементами
 * @param {number} staggerDelay - Задержка между элементами (мс)
 * @param {boolean} animate - Включить анимацию
 */
export function AnimatedStack({
  children,
  gap = 'space-y-4',
  staggerDelay = 50,
  animate = true,
  className = ''
}) {
  const shouldAnimate = animate && !prefersReducedMotion()
  const childArray = Array.isArray(children) ? children : [children]

  return (
    <div className={`${gap} ${className}`.trim()}>
      {childArray.map((child, index) => {
        if (!child) return null

        const animationClass = shouldAnimate
          ? fadeInWithDelay(index, staggerDelay * 10)
          : ''

        return (
          <div key={child.key || index} className={animationClass}>
            {child}
          </div>
        )
      })}
    </div>
  )
}
