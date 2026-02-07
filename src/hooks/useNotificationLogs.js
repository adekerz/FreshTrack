/**
 * Notification Logs Hooks - React Query integration
 *
 * Hooks для управления историей уведомлений с кэшированием
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { STALE_TIMES } from '../lib/queryClient'
import { apiFetch } from '../services/api'

/**
 * Загружает логи уведомлений с пагинацией и фильтрами
 * @param {string} hotelId - ID отеля
 * @param {Object} filters - Фильтры (page, limit, type, startDate, endDate)
 */
export function useNotificationLogs(hotelId, filters = {}) {
  return useQuery({
    queryKey: queryKeys.notificationLogs(hotelId, filters),
    queryFn: async () => {
      const params = new URLSearchParams()

      params.set('page', String(filters.page || 1))
      params.set('limit', String(filters.limit || 20))

      if (filters.type) params.set('type', filters.type)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const data = await apiFetch(`/notifications/logs?${params}`)
      return {
        logs: data.logs || [],
        pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.notificationLogs,
    placeholderData: keepPreviousData
  })
}
