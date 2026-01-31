/**
 * useOfflineMutation Hook
 * 
 * Wrapper для useMutation с поддержкой offline режима
 * Автоматически сохраняет мутации в очередь при отсутствии интернета
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { offlineSyncManager, SyncOperationType } from '../lib/offlineSync'
import { useOnlineStatus } from '../components/ui/OfflineIndicator'
import { logInfo, logWarn } from '../utils/logger'

/**
 * Создает mutation с offline support
 * 
 * @param {Object} options - Опции для useMutation
 * @param {Function} options.mutationFn - Функция мутации
 * @param {Object} options.offlineConfig - Конфигурация offline режима
 * @param {string} options.offlineConfig.type - Тип операции (CREATE, UPDATE, DELETE и т.д.)
 * @param {Function} options.offlineConfig.getEndpoint - Функция для получения endpoint
 * @param {Function} options.offlineConfig.getMethod - Функция для получения HTTP метода
 * @param {Function} options.offlineConfig.optimisticUpdate - Optimistic update для UI
 * @returns {Object} - Результат useMutation с offline support
 */
export function useOfflineMutation(options) {
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  
  const {
    mutationFn,
    offlineConfig = {},
    onSuccess,
    onError,
    onMutate,
    ...restOptions
  } = options

  const {
    type = SyncOperationType.CREATE,
    getEndpoint,
    getMethod = () => 'POST',
    optimisticUpdate,
    queryKey
  } = offlineConfig

  return useMutation({
    mutationFn: async (variables) => {
      // Если онлайн - выполняем сразу
      if (isOnline) {
        return await mutationFn(variables)
      }

      // Если оффлайн - сохраняем в очередь
      logWarn('Offline mode: queuing operation', type)

      const endpoint = getEndpoint ? getEndpoint(variables) : null
      const method = getMethod(variables)

      if (!endpoint) {
        throw new Error('Endpoint is required for offline operations')
      }

      // Добавляем в очередь синхронизации
      const operationId = await offlineSyncManager.queueOperation({
        type,
        endpoint,
        method,
        data: variables,
        timestamp: new Date().toISOString()
      })

      logInfo('Operation queued:', operationId)

      // Возвращаем optimistic результат
      return {
        __offline: true,
        __operationId: operationId,
        ...variables
      }
    },

    onMutate: async (variables) => {
      // Вызываем пользовательский onMutate
      if (onMutate) {
        await onMutate(variables)
      }

      // Если оффлайн и есть optimistic update
      if (!isOnline && optimisticUpdate && queryKey) {
        // Отменяем текущие запросы
        await queryClient.cancelQueries({ queryKey })

        // Сохраняем предыдущее состояние
        const previousData = queryClient.getQueryData(queryKey)

        // Применяем optimistic update
        queryClient.setQueryData(queryKey, (old) => {
          return optimisticUpdate(old, variables)
        })

        return { previousData }
      }
    },

    onSuccess: (data, variables, context) => {
      // Если это был offline запрос - invalidate queries
      if (data?.__offline && queryKey) {
        queryClient.invalidateQueries({ queryKey })
      }

      // Вызываем пользовательский onSuccess
      if (onSuccess) {
        onSuccess(data, variables, context)
      }
    },

    onError: (error, variables, context) => {
      // Откатываем optimistic update при ошибке
      if (context?.previousData && queryKey) {
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Вызываем пользовательский onError
      if (onError) {
        onError(error, variables, context)
      }
    },

    ...restOptions
  })
}

/**
 * Хелпер для создания batch mutation с offline support
 */
export function useOfflineBatchMutation(options) {
  return useOfflineMutation({
    ...options,
    offlineConfig: {
      type: SyncOperationType.CREATE,
      getEndpoint: () => '/batches',
      getMethod: () => 'POST',
      queryKey: ['batches'],
      optimisticUpdate: (old, newBatch) => {
        if (!old) return [newBatch]
        return [newBatch, ...old]
      },
      ...options.offlineConfig
    }
  })
}

/**
 * Хелпер для collection mutation с offline support
 */
export function useOfflineCollectMutation(options) {
  return useOfflineMutation({
    ...options,
    offlineConfig: {
      type: SyncOperationType.COLLECT,
      getEndpoint: (data) => `/collections`,
      getMethod: () => 'POST',
      queryKey: ['batches'],
      optimisticUpdate: (old, collectionData) => {
        if (!old) return old
        // Обновляем количество в партиях
        return old.map(batch => {
          const collected = collectionData.items?.find(item => item.batchId === batch.id)
          if (collected) {
            return {
              ...batch,
              quantity: batch.quantity - collected.quantity
            }
          }
          return batch
        })
      },
      ...options.offlineConfig
    }
  })
}

/**
 * Хелпер для write-off mutation с offline support
 */
export function useOfflineWriteOffMutation(options) {
  return useOfflineMutation({
    ...options,
    offlineConfig: {
      type: SyncOperationType.WRITE_OFF,
      getEndpoint: () => '/write-offs',
      getMethod: () => 'POST',
      queryKey: ['batches'],
      optimisticUpdate: (old, writeOffData) => {
        if (!old) return old
        // Обновляем количество в партиях
        return old.map(batch => {
          const writtenOff = writeOffData.items?.find(item => item.batchId === batch.id)
          if (writtenOff) {
            return {
              ...batch,
              quantity: batch.quantity - writtenOff.quantity
            }
          }
          return batch
        })
      },
      ...options.offlineConfig
    }
  })
}

export default useOfflineMutation
