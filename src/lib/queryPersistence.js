/**
 * React Query Persistence Configuration
 * 
 * Сохраняет queries в localStorage для offline поддержки
 * Данные восстанавливаются при следующей загрузке приложения
 */

import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { logDebug, logWarn } from '../utils/logger'

/**
 * Создает persister для сохранения в localStorage
 */
export function createPersister() {
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: 'FRESHTRACK_QUERY_CACHE',
    serialize: (data) => {
      try {
        return JSON.stringify(data)
      } catch (error) {
        logWarn('Failed to serialize cache:', error)
        return '{}'
      }
    },
    deserialize: (data) => {
      try {
        return JSON.parse(data)
      } catch (error) {
        logWarn('Failed to deserialize cache:', error)
        return {}
      }
    }
  })
}

/**
 * Настраивает persistence для queryClient
 * @param {QueryClient} queryClient - React Query client instance
 */
export function setupPersistence(queryClient) {
  const persister = createPersister()

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours - данные устаревают через сутки
    
    // Фильтруем что сохранять
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const queryKey = query.queryKey
        
        // Не сохраняем временные queries
        if (queryKey[0] === 'temp') return false
        
        // Не сохраняем queries в состоянии ошибки
        if (query.state.status === 'error') return false
        
        // Сохраняем только успешные queries
        return query.state.status === 'success'
      }
    },
    
    // Настройки восстановления
    hydrateOptions: {
      // Queries будут помечены как stale при восстановлении
      defaultOptions: {
        queries: {
          staleTime: 0 // Сразу пометить как stale для фоновой перезагрузки
        }
      }
    }
  })

  logDebug('✅ Query persistence enabled (localStorage)')
  
  // Очистка старых данных при превышении лимита
  try {
    const cacheSize = localStorage.getItem('FRESHTRACK_QUERY_CACHE')?.length || 0
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    if (cacheSize > maxSize) {
      logWarn(`Cache size (${(cacheSize / 1024 / 1024).toFixed(2)}MB) exceeds limit, clearing...`)
      localStorage.removeItem('FRESHTRACK_QUERY_CACHE')
    }
  } catch (error) {
    logWarn('Failed to check cache size:', error)
  }
}

/**
 * Очищает весь persisted кэш
 */
export function clearPersistedCache() {
  try {
    localStorage.removeItem('FRESHTRACK_QUERY_CACHE')
    logDebug('Persisted cache cleared')
    return true
  } catch (error) {
    logWarn('Failed to clear persisted cache:', error)
    return false
  }
}

/**
 * Получает размер persisted кэша
 * @returns {number} Размер в байтах
 */
export function getPersistedCacheSize() {
  try {
    const cache = localStorage.getItem('FRESHTRACK_QUERY_CACHE')
    return cache ? cache.length : 0
  } catch (error) {
    return 0
  }
}

/**
 * Получает информацию о persisted кэше
 * @returns {Object} Статистика кэша
 */
export function getPersistedCacheInfo() {
  try {
    const cache = localStorage.getItem('FRESHTRACK_QUERY_CACHE')
    if (!cache) return { exists: false, size: 0, queries: 0 }
    
    const data = JSON.parse(cache)
    const queries = data.clientState?.queries?.length || 0
    
    return {
      exists: true,
      size: cache.length,
      sizeFormatted: `${(cache.length / 1024).toFixed(2)} KB`,
      queries,
      timestamp: data.timestamp || null
    }
  } catch (error) {
    return { exists: false, size: 0, queries: 0, error: error.message }
  }
}
