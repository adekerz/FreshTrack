/**
 * ModuleGuard Component
 *
 * Условно рендерит дочерние компоненты на основе доступности модуля.
 * Если модуль недоступен — показывает fallback UI.
 *
 * @example
 * <ModuleGuard module="inventory">
 *   <InventoryWidget />
 * </ModuleGuard>
 *
 * <ModuleGuard module="logbook_scanner" fallback={<UpgradeBanner />}>
 *   <LogbookScanner />
 * </ModuleGuard>
 */

import { useModules } from '../context/ModuleContext'

/**
 * @param {Object} props
 * @param {string|string[]} props.module - Код модуля или массив кодов
 * @param {React.ReactNode} props.children - Контент при доступном модуле
 * @param {React.ReactNode} [props.fallback] - Контент при недоступном модуле
 * @param {boolean} [props.showFallback=false] - Показывать ли fallback по умолчанию
 */
export function ModuleGuard({
  module,
  children,
  fallback = null,
  showFallback = false,
}) {
  const { hasModule, hasAnyModule, loading } = useModules()

  // Пока загружаем модули — ничего не показываем
  if (loading) {
    return null
  }

  // Проверяем доступ
  const hasAccess = Array.isArray(module)
    ? hasAnyModule(module)
    : hasModule(module)

  if (hasAccess) {
    return children
  }

  // Если нет доступа — показываем fallback или ничего
  if (showFallback || fallback) {
    return fallback || <ModuleUnavailableFallback moduleName={module} />
  }

  return null
}

/**
 * Стандартный fallback для недоступного модуля
 */
function ModuleUnavailableFallback({ moduleName }) {
  return (
    <div
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary, #888)',
        borderRadius: '12px',
        border: '1px dashed var(--border-color, #e0e0e0)',
        background: 'var(--bg-secondary, #f8f8f8)',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
      <p style={{ margin: 0, fontWeight: 500 }}>
        Module{' '}
        <strong>
          {Array.isArray(moduleName) ? moduleName.join(', ') : moduleName}
        </strong>{' '}
        is not available
      </p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
        Contact your administrator to enable this module for your department
      </p>
    </div>
  )
}

export default ModuleGuard
