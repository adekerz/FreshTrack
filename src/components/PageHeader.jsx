/**
 * PageHeader Component
 * Unified page header with consistent styling
 * Supports icons, titles, subtitles, and action buttons
 * Mobile-optimized with proper spacing and typography
 */

import { fadeInWithDelay } from '../utils/animations'
import { typography, spacing } from '../utils/designSystem'

/**
 * PageHeader - унифицированный заголовок страницы
 * @param {string} title - Заголовок страницы
 * @param {string} subtitle - Подзаголовок (опционально)
 * @param {Component} icon - Lucide icon component (опционально)
 * @param {React.Node} actions - Действия/кнопки (опционально)
 * @param {string} className - Дополнительные классы
 * @param {boolean} sticky - Закрепить header при скролле
 * @param {boolean} gradient - Использовать градиент фон
 * @param {boolean} animate - Включить анимацию входа
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className = '',
  sticky = false,
  gradient = false,
  animate = true
}) {
  const bgClass = gradient
    ? 'bg-gradient-to-r from-accent to-accent-light text-white'
    : 'bg-background border-b border-border'

  const stickyClass = sticky
    ? 'sticky top-0 z-10 backdrop-blur-sm'
    : ''

  const iconBgClass = gradient
    ? 'bg-white/20'
    : 'bg-accent/10'

  const iconColorClass = gradient
    ? 'text-white'
    : 'text-accent'

  const titleColorClass = gradient
    ? 'text-white'
    : 'text-foreground'

  const subtitleColorClass = gradient
    ? 'text-white/80'
    : 'text-muted-foreground'

  return (
    <div
      className={`${bgClass} ${stickyClass} ${className}`}
    >
      <div className={`${spacing.pageX} ${spacing.pageY}`}>
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Left side: Icon + Title */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {Icon && (
              <div
                className={`
                  w-10 h-10 sm:w-12 sm:h-12
                  rounded-lg sm:rounded-xl
                  flex items-center justify-center
                  flex-shrink-0
                  ${iconBgClass}
                  ${animate ? fadeInWithDelay(0) : ''}
                `}
              >
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColorClass}`} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1
                className={`
                  ${typography.mobileH2}
                  ${titleColorClass}
                  truncate
                  ${animate ? fadeInWithDelay(1) : ''}
                `}
              >
                {title}
              </h1>

              {subtitle && (
                <p
                  className={`
                    text-xs sm:text-sm
                    ${subtitleColorClass}
                    truncate
                    mt-0.5
                    ${animate ? fadeInWithDelay(2) : ''}
                  `}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side: Actions */}
          {actions && (
            <div
              className={`
                flex-shrink-0
                ${animate ? fadeInWithDelay(3) : ''}
              `}
            >
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
