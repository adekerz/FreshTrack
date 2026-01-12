/**
 * Loader — Унифицированный компонент загрузки FreshTrack
 *
 * Стиль: Fluffy Starfish (9-клеточная сетка с ripple-эффектом)
 * Цвет: Коралловый (акцентный цвет бренда)
 *
 * @see https://uiverse.io/alexruix/fluffy-starfish-52
 *
 * Использование:
 * - Глобальная загрузка страницы → size="large"
 * - Загрузка секции / таблицы → size="medium" (default)
 * - Inline (кнопки, ячейки) → size="small"
 *
 * Accessibility:
 * - role="status" для скринридеров
 * - aria-label="Загрузка" для понятного объявления
 * - Поддержка prefers-reduced-motion
 */

import { cn } from '../../utils/classNames'

/**
 * Размеры loader-а
 * small: 24px — для кнопок и inline элементов
 * medium: 36px — для секций и таблиц (default)
 * large: 48px — для полноэкранной загрузки
 */
const LOADER_SIZES = {
  small: 'loader--small',
  medium: 'loader--medium',
  large: 'loader--large'
}

/**
 * Основной компонент Loader
 * Не содержит бизнес-логики — только отображение
 */
export default function Loader({
  size = 'medium',
  className,
  'aria-label': ariaLabel = 'Загрузка'
}) {
  return (
    <div
      className={cn('loader', LOADER_SIZES[size], className)}
      role="status"
      aria-label={ariaLabel}
    >
      <div className="loader__cell loader__cell--d0" />
      <div className="loader__cell loader__cell--d1" />
      <div className="loader__cell loader__cell--d2" />
      <div className="loader__cell loader__cell--d1" />
      <div className="loader__cell loader__cell--d2" />
      <div className="loader__cell loader__cell--d3" />
      <div className="loader__cell loader__cell--d2" />
      <div className="loader__cell loader__cell--d3" />
      <div className="loader__cell loader__cell--d4" />
      {/* Screen reader text */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  )
}

// Backward compatibility alias
export { default as GridLoader } from './GridLoader'

/**
 * PageLoader — Обёртка для загрузки страницы
 * Центрирует loader и опционально показывает сообщение
 */
export function PageLoader({ message, className }) {
  return (
    <div className={cn('loader-page', className)} role="status" aria-live="polite">
      <Loader size="large" aria-label={message || 'Загрузка страницы'} />
      {message && <p className="loader-page__message">{message}</p>}
    </div>
  )
}

/**
 * SectionLoader — Для загрузки отдельных секций
 */
export function SectionLoader({ message, className }) {
  return (
    <div className={cn('loader-section', className)} role="status" aria-live="polite">
      <Loader size="medium" aria-label={message || 'Загрузка данных'} />
      {message && <p className="loader-section__message">{message}</p>}
    </div>
  )
}

/**
 * InlineLoader — Маленький inline loader
 * Для использования в строках текста или рядом с контентом
 */
export function InlineLoader({ className, 'aria-label': ariaLabel = 'Загрузка' }) {
  return (
    <span className={cn('loader-inline', className)}>
      <Loader size="small" aria-label={ariaLabel} />
    </span>
  )
}

/**
 * ButtonLoader — Спиннер для состояния loading в кнопках
 * Использует тот же визуальный стиль, но оптимизирован для кнопок
 */
export function ButtonLoader({ className }) {
  return (
    <span className={cn('loader-button', className)} role="status" aria-label="Выполняется">
      <span className="loader-button__spinner" />
      <span className="sr-only">Загрузка</span>
    </span>
  )
}

/**
 * FullscreenLoader — Полноэкранный loader с overlay
 * Для блокирующих операций
 */
export function FullscreenLoader({ message, className }) {
  return (
    <div
      className={cn('loader-fullscreen', className)}
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="loader-fullscreen__content">
        <Loader size="large" aria-label={message || 'Загрузка'} />
        {message && <p className="loader-fullscreen__message">{message}</p>}
      </div>
    </div>
  )
}

// Legacy export for backward compatibility
export const ButtonSpinner = ButtonLoader
