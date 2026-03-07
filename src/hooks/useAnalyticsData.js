import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../services/api'

/**
 * Daily snapshots for trend charts.
 * Returns [] if analytics_snapshots table is empty (no cron has run yet).
 */
export function useAnalyticsTimeseries(hotelId, days = 90) {
  return useQuery({
    queryKey: ['analytics', 'timeseries', hotelId, days],
    queryFn: async () => {
      const res = await apiFetch(`/analytics/timeseries?days=${days}`)
      return res.data ?? []
    },
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Current live stats + delta vs previous period.
 * delta is null if no snapshots exist yet.
 */
export function useAnalyticsSummary(hotelId, period = 'week') {
  return useQuery({
    queryKey: ['analytics', 'summary', hotelId, period],
    queryFn: async () => {
      const res = await apiFetch(`/analytics/summary?period=${period}`)
      return res.data ?? null
    },
    enabled: !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}
