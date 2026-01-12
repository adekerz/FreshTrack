/**
 * Shared UI Components
 * 
 * Базовые UI компоненты, используемые по всему приложению.
 * Re-export из текущего расположения для обратной совместимости.
 */

// Временно реэкспортируем из старого места
// После полной миграции - переместить файлы сюда
export { default as Skeleton } from '../../../components/Skeleton'
export { default as Toast } from '../../../components/Toast'
export { default as ErrorBoundary } from '../../../components/ErrorBoundary'
export { default as ThemeSwitcher } from '../../../components/ThemeSwitcher'
export { default as LanguageSwitcher } from '../../../components/LanguageSwitcher'

// UI компоненты из папки ui/
export * from '../../../components/ui'
