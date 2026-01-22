import { useMemo, useEffect, useCallback } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Hook to track and warn about unsaved changes
 *
 * Usage:
 * const { hasChanges, markAsSaved, resetChanges } = useUnsavedChanges(initialData, currentData)
 *
 * After successful save, parent should update initialData to match currentData (e.g. setInitialData(currentData)).
 * markAsSaved / resetChanges are no-op placeholders; the parent handles state updates.
 */
export function useUnsavedChanges(initialData, currentData, options = {}) {
  const {
    enabled = true,
    warningMessage = 'У вас есть несохраненные изменения. Покинуть страницу?'
  } = options

  const hasChanges = useMemo(() => {
    if (!enabled) return false
    return JSON.stringify(initialData) !== JSON.stringify(currentData)
  }, [initialData, currentData, enabled])

  // Warn on page unload (browser close/refresh)
  useEffect(() => {
    if (!enabled || !hasChanges) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = warningMessage
      return warningMessage
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges, enabled, warningMessage])

  // Block navigation in React Router
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      enabled &&
      hasChanges &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Confirm navigation when blocked
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmed = window.confirm(warningMessage)
      if (confirmed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker, warningMessage])

  return {
    hasChanges,
    markAsSaved: useCallback(() => {
      // Parent should update initialData to match currentData after save
    }, []),
    resetChanges: useCallback(() => {
      // Parent should reset currentData to initialData
    }, [])
  }
}

/**
 * Simple version without router blocking (for settings pages with tab navigation).
 * Only warns on beforeunload (tab close / refresh).
 */
export function useSimpleUnsavedChanges(initialData, currentData) {
  const hasChanges = useMemo(() => {
    return JSON.stringify(initialData) !== JSON.stringify(currentData)
  }, [initialData, currentData])

  useEffect(() => {
    if (!hasChanges) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  return hasChanges
}
