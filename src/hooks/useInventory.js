/**
 * Inventory Hooks - React Query integration
 * 
 * Hooks для управления инвентарем с автоматическим кэшированием,
 * оптимистичными обновлениями и синхронизацией
 */

import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { STALE_TIMES } from '../lib/queryClient'
import { apiFetch } from '../services/api'
import { getBatchStatus } from '../utils/dateUtils'
import { logDebug, logError, logWarn } from '../utils/logger'

// === QUERIES (чтение данных) ===

/**
 * Загружает все партии для отеля
 * @param {string} hotelId - ID отеля
 * @param {Object} params - Параметры запроса (limit, offset)
 */
export function useBatches(hotelId, params = { limit: 200 }) {
  return useQuery({
    queryKey: queryKeys.batches(hotelId, params),
    queryFn: async () => {
      const query = hotelId 
        ? `?hotel_id=${hotelId}&limit=${params.limit || 200}` 
        : `?limit=${params.limit || 200}`
      const response = await apiFetch(`/batches${query}`)
      const batchesRaw = Array.isArray(response) ? response : response.batches || []
      
      // Нормализация и обогащение данных
      return batchesRaw.map((b) => {
        const expiryDate = b.expiry_date || b.expiryDate
        const statusInfo = getBatchStatus(b)
        
        return {
          ...b,
          productId: b.product_id || b.productId,
          productName: b.product_name || b.productName,
          departmentId: b.department_id || b.departmentId,
          departmentName: b.department_name || b.departmentName,
          categoryId: b.category_id || b.categoryId,
          categoryName: b.category_name || b.categoryName,
          expiryDate,
          addedBy: b.added_by_name || b.added_by || b.addedBy,
          collectedAt: b.collected_at || b.collectedAt,
          collectedBy: b.collected_by || b.collectedBy,
          hotelId: b.hotel_id || b.hotelId,
          batchNumber: b.batch_number || b.batchNumber,
          daysLeft: statusInfo.daysLeft,
          status: statusInfo,
          expiryStatus: statusInfo.status,
          statusColor: statusInfo.color,
          statusText: statusInfo.statusText,
          isExpired: statusInfo.isExpired,
          isUrgent: statusInfo.isUrgent
        }
      })
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.batches
  })
}

/**
 * Загружает статистику партий
 * @param {string} hotelId - ID отеля
 */
export function useBatchesStats(hotelId) {
  return useQuery({
    queryKey: queryKeys.batchesStats(hotelId),
    queryFn: async () => {
      const query = hotelId ? `?hotel_id=${hotelId}` : ''
      const response = await apiFetch(`/batches/stats${query}`)
      return response.stats || response || {
        total: 0,
        expired: 0,
        critical: 0,
        warning: 0,
        good: 0,
        needsAttention: 0
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.batchesStats
  })
}

/**
 * Загружает отделы отеля
 * @param {string} hotelId - ID отеля
 */
export function useDepartments(hotelId) {
  return useQuery({
    queryKey: queryKeys.departments(hotelId),
    queryFn: async () => {
      const query = hotelId ? `?hotel_id=${hotelId}` : ''
      const response = await apiFetch(`/departments${query}`).catch(() => ({ departments: [] }))
      return Array.isArray(response) ? response : response.departments || []
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.departments
  })
}

/**
 * Загружает категории отеля
 * @param {string} hotelId - ID отеля
 */
export function useCategories(hotelId) {
  return useQuery({
    queryKey: queryKeys.categories(hotelId),
    queryFn: async () => {
      const query = hotelId ? `?hotel_id=${hotelId}` : ''
      const response = await apiFetch(`/categories${query}`).catch(() => ({ categories: [] }))
      return Array.isArray(response) ? response : response.categories || []
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.categories
  })
}

/**
 * Загружает товары отеля
 * @param {string} hotelId - ID отеля
 * @param {Object} params - Параметры запроса (limit, offset)
 */
export function useProducts(hotelId, params = { limit: 200 }) {
  return useQuery({
    queryKey: queryKeys.products(hotelId, params),
    queryFn: async () => {
      const query = hotelId 
        ? `?hotel_id=${hotelId}&limit=${params.limit || 200}` 
        : `?limit=${params.limit || 200}`
      const response = await apiFetch(`/products${query}`).catch(() => [])
      return Array.isArray(response) 
        ? response 
        : response.items || response.products || []
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.products
  })
}

/**
 * Комбинированный hook для загрузки всех данных инвентаря
 * Использует useQueries для параллельной загрузки
 * 
 * @param {string} hotelId - ID отеля
 * @returns {Object} - Объединенные данные + loading states
 */
export function useInventoryData(hotelId) {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.batches(hotelId, { limit: 200 }),
        queryFn: async () => {
          const query = hotelId ? `?hotel_id=${hotelId}&limit=200` : '?limit=200'
          const response = await apiFetch(`/batches${query}`)
          const batchesRaw = Array.isArray(response) ? response : response.batches || []
          
          return batchesRaw.map((b) => {
            const expiryDate = b.expiry_date || b.expiryDate
            const statusInfo = getBatchStatus(b)
            
            return {
              ...b,
              productId: b.product_id || b.productId,
              productName: b.product_name || b.productName,
              departmentId: b.department_id || b.departmentId,
              departmentName: b.department_name || b.departmentName,
              categoryId: b.category_id || b.categoryId,
              categoryName: b.category_name || b.categoryName,
              expiryDate,
              addedBy: b.added_by_name || b.added_by || b.addedBy,
              collectedAt: b.collected_at || b.collectedAt,
              collectedBy: b.collected_by || b.collectedBy,
              hotelId: b.hotel_id || b.hotelId,
              batchNumber: b.batch_number || b.batchNumber,
              daysLeft: statusInfo.daysLeft,
              status: statusInfo,
              expiryStatus: statusInfo.status,
              statusColor: statusInfo.color,
              statusText: statusInfo.statusText,
              isExpired: statusInfo.isExpired,
              isUrgent: statusInfo.isUrgent
            }
          })
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.batches
      },
      {
        queryKey: queryKeys.batchesStats(hotelId),
        queryFn: async () => {
          const query = hotelId ? `?hotel_id=${hotelId}` : ''
          const response = await apiFetch(`/batches/stats${query}`)
          return response.stats || response || {
            total: 0,
            expired: 0,
            critical: 0,
            warning: 0,
            good: 0,
            needsAttention: 0
          }
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.batchesStats
      },
      {
        queryKey: queryKeys.departments(hotelId),
        queryFn: async () => {
          const query = hotelId ? `?hotel_id=${hotelId}` : ''
          const response = await apiFetch(`/departments${query}`).catch(() => ({ departments: [] }))
          return Array.isArray(response) ? response : response.departments || []
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.departments
      },
      {
        queryKey: queryKeys.categories(hotelId),
        queryFn: async () => {
          const query = hotelId ? `?hotel_id=${hotelId}` : ''
          const response = await apiFetch(`/categories${query}`).catch(() => ({ categories: [] }))
          return Array.isArray(response) ? response : response.categories || []
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.categories
      },
      {
        queryKey: queryKeys.products(hotelId, { limit: 200 }),
        queryFn: async () => {
          const query = hotelId ? `?hotel_id=${hotelId}&limit=200` : '?limit=200'
          const response = await apiFetch(`/products${query}`).catch(() => [])
          return Array.isArray(response) 
            ? response 
            : response.items || response.products || []
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.products
      }
    ]
  })

  const [batchesQuery, statsQuery, departmentsQuery, categoriesQuery, productsQuery] = queries

  // Объединенный loading state
  const loading = queries.some(q => q.isLoading)
  const error = queries.find(q => q.error)?.error || null

  return {
    batches: batchesQuery.data || [],
    stats: statsQuery.data || {
      total: 0,
      expired: 0,
      critical: 0,
      warning: 0,
      good: 0,
      needsAttention: 0
    },
    departments: departmentsQuery.data || [],
    categories: categoriesQuery.data || [],
    products: productsQuery.data || [],
    loading,
    error,
    // Индивидуальные loading states (для более точного контроля)
    batchesLoading: batchesQuery.isLoading,
    statsLoading: statsQuery.isLoading,
    departmentsLoading: departmentsQuery.isLoading,
    categoriesLoading: categoriesQuery.isLoading,
    productsLoading: productsQuery.isLoading
  }
}

// === MUTATIONS (изменение данных) ===

/**
 * Добавление одной партии
 * @param {string} hotelId - ID отеля
 */
export function useAddBatch(hotelId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ productName, department, category, quantity, expiryDate }) => {
      const response = await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify({
          productName,
          department,
          category,
          quantity: quantity === null || quantity === undefined ? null : parseInt(quantity),
          expiryDate
        })
      })
      return response.batch || response
    },

    // Оптимистичное обновление
    onMutate: async (newBatchData) => {
      // Отменяем pending queries
      await queryClient.cancelQueries({ queryKey: queryKeys.batches(hotelId) })

      // Сохраняем предыдущее состояние для rollback
      const previousBatches = queryClient.getQueryData(queryKeys.batches(hotelId, { limit: 200 }))

      // Оптимистично добавляем партию
      if (previousBatches) {
        const optimisticBatch = {
          id: `temp-${Date.now()}`,
          productName: newBatchData.productName,
          departmentId: newBatchData.department,
          quantity: newBatchData.quantity,
          expiryDate: newBatchData.expiryDate,
          ...getBatchStatus({ expiryDate: newBatchData.expiryDate }),
          _optimistic: true
        }

        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          [...previousBatches, optimisticBatch]
        )
      }

      return { previousBatches }
    },

    // Rollback при ошибке
    onError: (err, newBatchData, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          context.previousBatches
        )
      }
      logError('Error adding batch:', err)
    },

    // Обновляем после успешного сохранения
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })
    }
  })
}

/**
 * Массовое добавление партий через шаблон (для FastIntakeModal)
 * @param {string} hotelId - ID отеля
 * @param {string} departmentId - ID отдела
 */
export function useAddBatchesBulk(hotelId, departmentId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ templateId, items }) => {
      const response = await apiFetch(`/delivery-templates/${templateId}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId || item.product_id,
            quantity: parseInt(item.quantity) || 1,
            expiryDate: item.expiryDate
          })),
          departmentId
        })
      })
      return response
    },

    // Оптимистичное обновление
    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.batches(hotelId) })

      const previousBatches = queryClient.getQueryData(queryKeys.batches(hotelId, { limit: 200 }))

      // Оптимистично добавляем партии
      if (previousBatches) {
        const optimisticBatches = items.map((item, index) => ({
          id: `temp-bulk-${Date.now()}-${index}`,
          productId: item.productId || item.product_id,
          productName: item.productName,
          departmentId,
          quantity: parseInt(item.quantity) || 1,
          expiryDate: item.expiryDate,
          ...getBatchStatus({ expiryDate: item.expiryDate }),
          _optimistic: true
        }))

        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          [...previousBatches, ...optimisticBatches]
        )
      }

      return { previousBatches }
    },

    onError: (err, variables, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          context.previousBatches
        )
      }
      logError('Error adding batches in bulk:', err)
    },

    // Фоновая синхронизация через 2 секунды
    onSuccess: () => {
      // Не блокируем UI - обновляем в фоне
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.products(hotelId) })
      }, 2000)
    }
  })
}

/**
 * Сбор партии (помечает как собранную)
 * @param {string} hotelId - ID отеля
 */
export function useCollectBatch(hotelId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ batchId, reason = 'manual', comment = '' }) => {
      return await apiFetch(`/batches/${batchId}/collect`, {
        method: 'POST',
        body: JSON.stringify({ reason, comment })
      })
    },

    onMutate: async ({ batchId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.batches(hotelId) })

      const previousBatches = queryClient.getQueryData(queryKeys.batches(hotelId, { limit: 200 }))

      // Оптимистично удаляем из списка
      if (previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          previousBatches.filter(b => b.id !== batchId)
        )
      }

      return { previousBatches }
    },

    onError: (err, variables, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          context.previousBatches
        )
      }
      logError('Error collecting batch:', err)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })
    }
  })
}

/**
 * Удаление партии
 * @param {string} hotelId - ID отеля
 */
export function useDeleteBatch(hotelId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (batchId) => {
      return await apiFetch(`/batches/${batchId}`, {
        method: 'DELETE'
      })
    },

    onMutate: async (batchId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.batches(hotelId) })

      const previousBatches = queryClient.getQueryData(queryKeys.batches(hotelId, { limit: 200 }))

      // Оптимистично удаляем
      if (previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          previousBatches.filter(b => b.id !== batchId)
        )
      }

      return { previousBatches }
    },

    onError: (err, batchId, context) => {
      if (context?.previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          context.previousBatches
        )
      }
      logError('Error deleting batch:', err)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })
    }
  })
}

/**
 * Добавление нового товара в каталог
 * @param {string} hotelId - ID отеля
 */
export function useAddProduct(hotelId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, categoryId, departmentId }) => {
      const response = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          categoryId: categoryId || null,
          departmentId: departmentId || null
        })
      })
      return response.product || response
    },

    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products(hotelId) })

      const previousProducts = queryClient.getQueryData(queryKeys.products(hotelId, { limit: 200 }))

      // Оптимистично добавляем товар
      if (previousProducts) {
        const optimisticProduct = {
          id: `temp-product-${Date.now()}`,
          name: newProduct.name,
          categoryId: newProduct.categoryId,
          departmentId: newProduct.departmentId,
          isCustom: true,
          _optimistic: true
        }

        queryClient.setQueryData(
          queryKeys.products(hotelId, { limit: 200 }),
          [...previousProducts, optimisticProduct]
        )
      }

      return { previousProducts }
    },

    onError: (err, newProduct, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(
          queryKeys.products(hotelId, { limit: 200 }),
          context.previousProducts
        )
      }
      logError('Error adding product:', err)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products(hotelId) })
    }
  })
}

/**
 * Удаление товара
 * @param {string} hotelId - ID отеля
 */
export function useDeleteProduct(hotelId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productId) => {
      return await apiFetch(`/products/${productId}`, {
        method: 'DELETE'
      })
    },

    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products(hotelId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.batches(hotelId) })

      const previousProducts = queryClient.getQueryData(queryKeys.products(hotelId, { limit: 200 }))
      const previousBatches = queryClient.getQueryData(queryKeys.batches(hotelId, { limit: 200 }))

      // Оптимистично удаляем товар и связанные партии
      if (previousProducts) {
        queryClient.setQueryData(
          queryKeys.products(hotelId, { limit: 200 }),
          previousProducts.filter(p => p.id !== productId)
        )
      }

      if (previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          previousBatches.filter(b => b.productId !== productId && b.product_id !== productId)
        )
      }

      return { previousProducts, previousBatches }
    },

    onError: (err, productId, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(
          queryKeys.products(hotelId, { limit: 200 }),
          context.previousProducts
        )
      }
      if (context?.previousBatches) {
        queryClient.setQueryData(
          queryKeys.batches(hotelId, { limit: 200 }),
          context.previousBatches
        )
      }
      logError('Error deleting product:', err)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products(hotelId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
    }
  })
}
