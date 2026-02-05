/**
 * HelpIcon Component
 * Context-sensitive help icon with tooltip
 * Can be used inline with labels or as clickable button
 */

import { HelpCircle } from 'lucide-react'
import Tooltip from './Tooltip'

/**
 * HelpIcon - иконка помощи с tooltip
 * @param {string} content - Текст подсказки
 * @param {Function} onClick - Callback для клика (открывает модальное окно помощи)
 * @param {string} placement - Позиция tooltip
 * @param {string} className - Дополнительные классы
 * @param {string} size - Размер иконки ('sm'|'md'|'lg')
 */
export default function HelpIcon({
  content,
  onClick,
  placement = 'right',
  className = '',
  size = 'sm'
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  // Clickable help icon (opens help modal)
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`
          inline-flex items-center justify-center
          text-muted-foreground hover:text-accent
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2
          rounded-full
          ${className}
        `}
        aria-label="Помощь"
        type="button"
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>
    )
  }

  // Tooltip help icon (shows inline help)
  if (content) {
    return (
      <Tooltip content={content} placement={placement}>
        <span
          className={`
            inline-flex items-center justify-center
            text-muted-foreground hover:text-foreground
            transition-colors duration-150
            cursor-help
            ${className}
          `}
          aria-label="Дополнительная информация"
        >
          <HelpCircle className={sizeClasses[size]} />
        </span>
      </Tooltip>
    )
  }

  // Simple help icon without interaction
  return (
    <span
      className={`
        inline-flex items-center justify-center
        text-muted-foreground
        ${className}
      `}
      aria-label="Помощь"
    >
      <HelpCircle className={sizeClasses[size]} />
    </span>
  )
}
