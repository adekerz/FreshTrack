import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../services/api'
import { STALE_TIMES } from '../lib/queryClient'

export function useDepartmentsQuery(hotelId) {
  return useQuery({
    queryKey: ['departments', hotelId],
    queryFn: async () => {
      if (!hotelId) return []
      // hotel_id передаётся через X-Hotel-Id header (apiFetch)
      const response = await apiFetch(`/departments`)
      return Array.isArray(response) ? response : response.departments || []
    },
    enabled: !!hotelId,
    staleTime: STALE_TIMES.departments || 5 * 60 * 1000, // 5 minutes default
  })
}
