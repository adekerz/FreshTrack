/**
 * Audit Logs Hooks - React Query integration
 *
 * Hooks для управления аудит-логами с кэшированием
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { STALE_TIMES } from '../lib/queryClient'
import { apiFetch } from '../services/api'

/**
 * Загружает аудит-логи с пагинацией и фильтрами
 * @param {string} hotelId - ID отеля
 * @param {Object} filters - Фильтры и пагинация
 */
export function useAuditLogs(hotelId, filters = {}) {
  return useQuery({
    queryKey: queryKeys.auditLogs(hotelId, filters),
    queryFn: async () => {
      const params = new URLSearchParams()

      params.set('limit', String(filters.limit || 20))
      params.set('offset', String(filters.offset || 0))

      if (filters.action) params.set('action', filters.action)
      if (filters.entityType) params.set('entityType', filters.entityType)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.departmentId) params.set('departmentId', filters.departmentId)
      if (filters.severity) params.set('severity', filters.severity)
      if (filters.securityOnly) params.set('securityOnly', 'true')

      const data = await apiFetch(`/audit-logs?${params}`)
      return {
        logs: data.logs || [],
        pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 1 }
      }
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.audit,
    placeholderData: keepPreviousData
  })
}

/**
 * Загружает статистику аудита для графика активности
 * @param {string} hotelId - ID отеля
 * @param {number} days - Количество дней
 */
export function useAuditStats(hotelId, days = 7) {
  return useQuery({
    queryKey: queryKeys.auditStats(hotelId, days),
    queryFn: async () => {
      const data = await apiFetch(`/audit-logs/stats?days=${days}`)
      return data.stats || []
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.audit
  })
}

/**
 * Загружает список пользователей для фильтра аудита
 * @param {string} hotelId - ID отеля
 * @param {boolean} enabled - Включить запрос (для ленивой загрузки)
 */
export function useAuditUsers(hotelId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.auditUsers(hotelId),
    queryFn: async () => {
      const data = await apiFetch('/audit-logs/users')
      return data.users || []
    },
    enabled: !!hotelId && enabled,
    staleTime: STALE_TIMES.audit
  })
}
