/**
 * GridLoader - Анимация загрузки в стиле FreshTrack
 * 9-клеточная сетка с ripple-эффектом в коралловых тонах
 */

import { cn } from '../../utils/classNames'

export default function GridLoader({ 
  size = 'md',
  message,
  fullScreen = false,
  className 
}) {
  // Размеры ячеек для разных вариантов
  const sizes = {
    sm: 'loader-sm',
    md: 'loader-md',
    lg: 'loader-lg'
  }

  const loader = (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className={cn('loader', sizes[size])}>
        <div className="cell d-0" />
        <div className="cell d-1" />
        <div className="cell d-2" />
        <div className="cell d-1" />
        <div className="cell d-2" />
        <div className="cell d-3" />
        <div className="cell d-2" />
        <div className="cell d-3" />
        <div className="cell d-4" />
      </div>
      {message && (
        <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {loader}
      </div>
    )
  }

  return loader
}

/**
 * PageLoader - Лоадер для загрузки страницы
 */
export function PageLoader({ message }) {
  return (
    <div className="flex-1 flex items-center justify-center py-16 sm:py-24">
      <GridLoader size="lg" message={message} />
    </div>
  )
}

/**
 * InlineLoader - Маленький инлайновый лоадер
 */
export function InlineLoader({ className }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <GridLoader size="sm" />
    </div>
  )
}
