/**
 * useModuleAccess Hook
 *
 * Упрощённый хук для проверки доступа к модулям.
 * Использует ModuleContext.
 *
 * @example
 * const { hasAccess, loading } = useModuleAccess('inventory')
 * const { hasAccess: hasAny } = useModuleAccess(['inventory', 'logbook_scanner'])
 */

import { useMemo } from 'react'
import { useModules } from '../context/ModuleContext'

export function useModuleAccess(moduleCodeOrCodes) {
  const { hasModule, hasAnyModule, loading, modules } = useModules()

  const hasAccess = useMemo(() => {
    if (Array.isArray(moduleCodeOrCodes)) {
      return hasAnyModule(moduleCodeOrCodes)
    }
    return hasModule(moduleCodeOrCodes)
  }, [moduleCodeOrCodes, hasModule, hasAnyModule])

  return {
    hasAccess,
    loading,
    modules,
  }
}

export default useModuleAccess
