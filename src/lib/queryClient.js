/**
 * React Query Client Configuration
 * 
 * Централизованная конфигурация для кэширования и синхронизации серверного состояния
 */

import { QueryClient } from '@tanstack/react-query'
import { logError } from '../utils/logger'

/**
 * Создает и настраивает QueryClient с оптимальными параметрами
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Время до истечения свежести данных (данные считаются fresh)
      staleTime: 30 * 1000, // 30 секунд (batches обновляются часто)
      
      // Время хранения неиспользуемых данных в кэше
      gcTime: 10 * 60 * 1000, // 10 минут (было cacheTime в v4)
      
      // Retry стратегия
      retry: (failureCount, error) => {
        // Не повторяем при 401/403 (проблемы с аутентификацией)
        if (error?.status === 401 || error?.status === 403) return false
        // Не более 2 попыток для обычных запросов
        return failureCount < 2
      },
      
      // Экспоненциальный backoff для retry
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch стратегия
      refetchOnWindowFocus: false, // Отключаем автоматический refetch при фокусе (слишком агрессивно)
      refetchOnReconnect: true, // Обновляем при восстановлении соединения (offline support)
      refetchOnMount: false, // Не refetch при каждом монтировании (используем staleTime)
      
      // Network mode - работаем даже offline (используем кэш)
      networkMode: 'offlineFirst',
      
      // Структурное разделение данных (избегаем лишних ре-рендеров)
      structuralSharing: true,
      
      // Обработка ошибок по умолчанию
      onError: (error) => {
        logError('React Query error:', error)
      }
    },
    
    mutations: {
      // Retry для мутаций (более осторожный подход)
      retry: (failureCount, error) => {
        // Не повторяем мутации при клиентских ошибках (4xx)
        if (error?.status >= 400 && error?.status < 500) return false
        // Только 1 повтор для серверных ошибок (5xx)
        return failureCount < 1
      },
      
      // Обработка ошибок мутаций
      onError: (error) => {
        logError('Mutation error:', error)
      }
    }
  }
})

/**
 * Специфичные staleTime для разных типов данных
 */
export const STALE_TIMES = {
  // Данные инвентаря - обновляются часто
  batches: 30 * 1000, // 30 секунд
  batchesStats: 30 * 1000, // 30 секунд
  
  // Справочники - изменяются редко
  departments: 5 * 60 * 1000, // 5 минут
  categories: 5 * 60 * 1000, // 5 минут
  products: 2 * 60 * 1000, // 2 минуты
  
  // Шаблоны поставок
  deliveryTemplates: 2 * 60 * 1000, // 2 минуты
  
  // Настройки
  settings: 10 * 60 * 1000, // 10 минут
  
  // Аудит (редко изменяется после загрузки)
  audit: 5 * 60 * 1000 // 5 минут
}

/**
 * Helper для инвалидации связанных queries
 */
export const invalidateInventoryQueries = (queryClient, hotelId) => {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['batches', hotelId] }),
    queryClient.invalidateQueries({ queryKey: ['batches', 'stats', hotelId] }),
    queryClient.invalidateQueries({ queryKey: ['products', hotelId] }),
    queryClient.invalidateQueries({ queryKey: ['departments', hotelId] }),
    queryClient.invalidateQueries({ queryKey: ['categories', hotelId] })
  ])
}
