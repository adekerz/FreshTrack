/**
 * Collection History Hooks - React Query integration
 *
 * Hooks для управления историей сборов с кэшированием
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { STALE_TIMES } from '../lib/queryClient'
import { apiFetch } from '../services/api'

/**
 * Загружает статистику сборов
 * @param {string} hotelId - ID отеля
 * @param {string} period - Период ('month', 'week', etc.)
 */
export function useCollectionStats(hotelId, period = 'month') {
  return useQuery({
    queryKey: queryKeys.collectionStats(hotelId, period),
    queryFn: async () => {
      const data = await apiFetch(`/fifo-collect/stats?period=${period}`)
      if (data.success && data.totals) {
        return {
          today: 0,
          week: 0,
          month: data.totals.quantity || 0,
          total: data.totals.transactions || 0
        }
      }
      return { today: 0, week: 0, month: 0, total: 0 }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.collectionStats
  })
}

/**
 * Загружает историю сборов с пагинацией и фильтрами
 * @param {string} hotelId - ID отеля
 * @param {Object} filters - Фильтры и пагинация
 */
export function useCollectionHistory(hotelId, filters = {}) {
  return useQuery({
    queryKey: queryKeys.collectionHistory(hotelId, filters),
    queryFn: async () => {
      const params = new URLSearchParams()

      params.set('limit', String(filters.limit || 20))
      params.set('offset', String(filters.offset || 0))

      if (filters.departmentId) params.set('departmentId', filters.departmentId)
      if (filters.reason) params.set('reason', filters.reason)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const data = await apiFetch(`/fifo-collect/history?${params}`)
      const historyItems = data.history || []

      const history = historyItems.map(item => ({
        id: item.id,
        productName: item.product_name || item.productName || 'Неизвестный товар',
        departmentId: item.department_id || item.departmentId,
        quantity: item.quantity_collected || item.quantityCollected,
        expiryDate: item.expiry_date || item.expiryDate,
        reason: item.collection_reason || item.reason || 'consumption',
        comment: item.notes || item.comment,
        collectedAt: item.collected_at || item.collectedAt,
        collectedByName: item.user_name || item.userName || 'Система'
      }))

      return {
        history,
        count: data.count || historyItems.length
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.collectionHistory,
    placeholderData: keepPreviousData
  })
}
