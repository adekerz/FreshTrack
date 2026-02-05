/**
 * EmptyState Component
 * Provides helpful guidance when there's no data to display
 * Mobile-optimized with clear CTAs
 */

import Button from './ui/Button'

/**
 * EmptyState - универсальный компонент для пустых состояний
 * @param {Component} icon - Lucide icon component
 * @param {string} title - Заголовок
 * @param {string} description - Описание
 * @param {Object} action - Основное действие { label, onClick, icon }
 * @param {Object} secondaryAction - Дополнительное действие { label, onClick }
 * @param {string} className - Дополнительные классы
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-12 sm:py-16 px-4
        text-center animate-fade-in
        ${className}
      `}
    >
      {/* Icon */}
      {Icon && (
        <div
          className="
            w-16 h-16 sm:w-20 sm:h-20
            bg-muted rounded-full
            flex items-center justify-center
            mb-4 sm:mb-6
          "
        >
          <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
        </div>
      )}

      {/* Title */}
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 sm:mb-8">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {action && (
            <Button
              onClick={action.onClick}
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
