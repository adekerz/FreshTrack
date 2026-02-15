import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBatches, useAddBatch, useDeleteBatch, useInventoryData } from './useInventory'
import * as apiService from '../services/api'

// Mock dependencies
vi.mock('../services/api', () => ({
    apiFetch: vi.fn(),
    default: {}
}))

// Wrapper for React Query
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    const Wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    Wrapper.displayName = 'TestWrapper'
    return Wrapper
}

describe('useInventory Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useBatches', () => {
        const mockBatchesData = {
            batches: [
                {
                    id: '1',
                    product_name: 'Test Product',
                    expiry_date: '2025-12-31',
                    quantity: 10,
                    status: 'ok',
                    hotel_id: 'hotel-123'
                }
            ],
            total: 1,
            page: 1,
            limit: 20
        }

        it('successfully fetches and normalizes batches', async () => {
            apiService.apiFetch.mockResolvedValueOnce(mockBatchesData)

            const { result } = renderHook(() => useBatches('hotel-123'), {
                wrapper: createWrapper()
            })

            // Initial loading state
            expect(result.current.isLoading).toBe(true)

            // Wait for success
            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // Check data normalization
            const batch = result.current.data.data[0]
            expect(batch.productName).toBe('Test Product') // snake_case -> camelCase
            expect(batch.expiryDate).toBe('2025-12-31')
            expect(result.current.data.pagination.total).toBe(1)

            // Verify API call
            expect(apiService.apiFetch).toHaveBeenCalledWith(expect.stringContaining('/batches?'))
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch')
            apiService.apiFetch.mockRejectedValueOnce(error)

            const { result } = renderHook(() => useBatches('hotel-123'), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.error).toBeDefined()
        })
    })

    describe('useInventoryData', () => {
        it('returns combined loading state initially', () => {
            // Mock never resolving promises to simulate loading
            apiService.apiFetch.mockImplementation(() => new Promise(() => { }))

            const { result } = renderHook(() => useInventoryData('hotel-123'), {
                wrapper: createWrapper()
            })

            expect(result.current.loading).toBe(true)
        })

        it('fetches all data successfully', async () => {
            // Mock all 5 queries in order: batches, stats, departments, categories, products
            apiService.apiFetch
                .mockResolvedValueOnce({ batches: [] }) // batches
                .mockResolvedValueOnce({ stats: { total: 10, expired: 2 } }) // stats
                .mockResolvedValueOnce({ departments: [{ id: 'd1', name: 'Kitchen' }] }) // departments
                .mockResolvedValueOnce({ categories: [{ id: 'c1', name: 'Dairy' }] }) // categories
                .mockResolvedValueOnce({ items: [] }) // products

            const { result } = renderHook(() => useInventoryData('hotel-123'), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.loading).toBe(false))

            expect(result.current.stats.total).toBe(10)
            expect(result.current.stats.expired).toBe(2)
            expect(result.current.departments).toHaveLength(1)
            expect(result.current.departments[0].name).toBe('Kitchen')
            expect(result.current.batches).toEqual([])
        })
    })

    describe('useAddBatch', () => {
        it('calls api to create batch', async () => {
            const newBatchInput = {
                productName: 'New Item',
                quantity: 5,
                expiryDate: '2025-01-01',
                department: 'Kitchen',
                category: 'Food'
            }

            const createdBatch = { id: 'new-1', ...newBatchInput }
            apiService.apiFetch.mockResolvedValueOnce({ batch: createdBatch })

            const { result } = renderHook(() => useAddBatch('hotel-123'), {
                wrapper: createWrapper()
            })

            await result.current.mutateAsync(newBatchInput)

            expect(apiService.apiFetch).toHaveBeenCalledWith('/batches', expect.objectContaining({
                method: 'POST',
                body: expect.any(String)
            }))

            const callArgs = JSON.parse(apiService.apiFetch.mock.calls[0][1].body)
            expect(callArgs).toEqual({
                productName: 'New Item',
                quantity: 5,
                expiryDate: '2025-01-01',
                department: 'Kitchen',
                category: 'Food'
            })
        })

        it('invalidates queries after success', async () => {
            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } }
            })
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

            const wrapper = ({ children }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            )

            apiService.apiFetch.mockResolvedValueOnce({ batch: { id: 'new-1' } })

            const { result } = renderHook(() => useAddBatch('hotel-123'), { wrapper })

            await result.current.mutateAsync({ productName: 'Test' })

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalled()
            })

            // Check for specific invalidations
            // Note: exact match on queryKey array calls might be tricky depending on how vitest handles array equality in calls
            // so we check if called with object containing specific queryKey parts
            expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({
                queryKey: ['batches', 'hotel-123']
            }))
        })
    })

    describe('useDeleteBatch', () => {
        it('calls api to delete batch', async () => {
            apiService.apiFetch.mockResolvedValueOnce({ success: true })

            const { result } = renderHook(() => useDeleteBatch('hotel-123'), {
                wrapper: createWrapper()
            })

            await result.current.mutateAsync('batch-123')

            expect(apiService.apiFetch).toHaveBeenCalledWith('/batches/batch-123', expect.objectContaining({
                method: 'DELETE'
            }))
        })
    })
})
