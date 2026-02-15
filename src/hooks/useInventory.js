/**
 * Inventory Hooks - React Query integration
 *
 * Hooks для управления инвентарем с автоматическим кэшированием,
 * server-side pagination и синхронизацией
 */

import { useQuery, useQueries, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { STALE_TIMES, invalidateInventoryQueries } from '../lib/queryClient'
import { apiFetch } from '../services/api'
import { getBatchStatus } from '../utils/dateUtils'
// logger imports removed - unused

// === HELPERS ===

/**
 * Нормализация batch из snake_case в camelCase + enrichment
 */
function normalizeBatch(b) {
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
}

/**
 * Построение query string из params
 */
function buildBatchQuery(hotelId, params) {
  const sp = new URLSearchParams()
  if (hotelId) sp.set('hotel_id', hotelId)
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== undefined) sp.set(k, String(v))
  })
  return sp.toString()
}

// === QUERIES (чтение данных) ===

/**
 * Загружает партии для отеля с server-side pagination
 * @param {string} hotelId - ID отеля
 * @param {Object} params - { page, limit, departmentId, categoryId, search, sortBy, sortOrder, ... }
 * @returns {{ data: batch[], pagination: { total, page, limit, totalPages, hasMore } }}
 */
export function useBatches(hotelId, params = { page: 1, limit: 20 }) {
  return useQuery({
    queryKey: queryKeys.batches(hotelId, params),
    queryFn: async () => {
      const qs = buildBatchQuery(hotelId, {
        page: params.page || 1,
        limit: params.limit || 20,
        ...params
      })
      const response = await apiFetch(`/batches?${qs}`)
      const batchesRaw = Array.isArray(response) ? response : response.batches || []
      const enriched = batchesRaw.map(normalizeBatch)

      return {
        data: enriched,
        pagination: {
          total: response.total || enriched.length,
          page: response.page || params.page || 1,
          limit: response.limit || params.limit || 20,
          totalPages: response.totalPages || 1,
          hasMore: response.hasMore || false
        }
      }
    },
    enabled: !!hotelId,
    refetchOnWindowFocus: true,     // Обновляем при фокусе (важно для инвентаря)
    refetchOnMount: true,           // Обновляем при монтировании
    placeholderData: keepPreviousData
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
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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
 * Загружает товары отеля с server-side pagination
 * @param {string} hotelId - ID отеля
 * @param {Object} params - { page, limit, categoryId, search, ... }
 * @returns {{ data: product[], pagination: { total, page, limit, totalPages, hasMore } }}
 */
export function useProducts(hotelId, params = { page: 1, limit: 50 }) {
  return useQuery({
    queryKey: queryKeys.products(hotelId, params),
    queryFn: async () => {
      const sp = new URLSearchParams()
      if (hotelId) sp.set('hotel_id', hotelId)
      sp.set('page', String(params.page || 1))
      sp.set('limit', String(params.limit || 50))
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '' && k !== 'page' && k !== 'limit') sp.set(k, String(v))
      })
      const response = await apiFetch(`/products?${sp}`).catch(() => ({ items: [] }))

      const items = Array.isArray(response)
        ? response
        : response.items || response.products || []

      return {
        data: items,
        pagination: {
          total: response.total || items.length,
          page: response.page || params.page || 1,
          limit: response.limit || params.limit || 50,
          totalPages: response.totalPages || 1,
          hasMore: response.hasMore || false
        }
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.products,
    placeholderData: keepPreviousData
  })
}

// === Inventory limits for ProductContext ===
const CONTEXT_BATCHES_LIMIT = 50
const CONTEXT_PRODUCTS_LIMIT = 100

/**
 * Комбинированный hook для загрузки данных инвентаря (для ProductContext)
 * Использует useQueries для параллельной загрузки
 *
 * Batches: limit=50 (для alerts на Dashboard)
 * Products: limit=100 (для каталога / AddBatchModal)
 * Departments, Categories: без лимита (справочники)
 * Stats: отдельный endpoint
 *
 * @param {string} hotelId - ID отеля
 * @returns {Object} - Объединенные данные + loading states
 */
export function useInventoryData(hotelId) {
  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.batches(hotelId, { limit: CONTEXT_BATCHES_LIMIT }),
        queryFn: async () => {
          const query = hotelId
            ? `?hotel_id=${hotelId}&limit=${CONTEXT_BATCHES_LIMIT}`
            : `?limit=${CONTEXT_BATCHES_LIMIT}`
          const response = await apiFetch(`/batches${query}`)
          const batchesRaw = Array.isArray(response) ? response : response.batches || []
          return batchesRaw.map(normalizeBatch)
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.batches,
        refetchOnWindowFocus: true,
        refetchOnMount: true
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
        staleTime: STALE_TIMES.batchesStats,
        refetchOnWindowFocus: true,
        refetchOnMount: true
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
        queryKey: queryKeys.products(hotelId, { limit: CONTEXT_PRODUCTS_LIMIT }),
        queryFn: async () => {
          const query = hotelId
            ? `?hotel_id=${hotelId}&limit=${CONTEXT_PRODUCTS_LIMIT}`
            : `?limit=${CONTEXT_PRODUCTS_LIMIT}`
          const response = await apiFetch(`/products${query}`).catch(() => ({ items: [] }))
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
// Mutations use invalidation instead of optimistic updates.
// With paginated queries the exact cache key is unknown,
// and server roundtrip is fast (~200ms) so the UX difference is negligible.

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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', hotelId] })
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
    mutationFn: async ({ templateId, items, comment }) => {
      const response = await apiFetch(`/delivery-templates/${templateId}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId || item.product_id,
            quantity: parseInt(item.quantity) || 1,
            expiryDate: item.expiryDate
          })),
          departmentId,
          comment: comment || null
        })
      })
      return response
    },

    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['batches', hotelId] })
        queryClient.invalidateQueries({ queryKey: queryKeys.batchesStats(hotelId) })
        queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', hotelId] })
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

    onSettled: () => {
      if (hotelId) {
        invalidateInventoryQueries(queryClient, hotelId)
      } else {
        queryClient.invalidateQueries({ queryKey: ['batches'] })
        queryClient.invalidateQueries({ queryKey: ['batches', 'stats'] })
      }
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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
      queryClient.invalidateQueries({ queryKey: ['batches', hotelId] })
    }
  })
}
