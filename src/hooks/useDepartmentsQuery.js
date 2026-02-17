
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../services/api'
import { STALE_TIMES } from '../lib/queryClient'

export function useDepartmentsQuery(hotelId) {
    return useQuery({
        queryKey: ['departments', hotelId],
        queryFn: async () => {
            if (!hotelId) return []
            const response = await apiFetch(`/departments?hotel_id=${hotelId}`)
            return Array.isArray(response) ? response : response.departments || []
        },
        enabled: !!hotelId,
        staleTime: STALE_TIMES.departments || 5 * 60 * 1000 // 5 minutes default
    })
}
