# React Query Migration Guide

## ✅ Completed - Phase 1 & 2

### Infrastructure
- ✅ Installed `@tanstack/react-query` v5
- ✅ Installed `@tanstack/react-query-devtools`
- ✅ Created `src/lib/queryClient.js` with optimized configuration
- ✅ Created `src/lib/queryKeys.js` with typed query keys
- ✅ Created `src/hooks/useInventory.js` with all hooks

### Architecture Changes
- ✅ Migrated ProductContext to use React Query (backward compatible)
- ✅ Updated FastIntakeModal to use optimistic updates
- ✅ Added QueryClientProvider to main.jsx
- ✅ Added React Query DevTools (development only)

## Key Improvements

### Before Migration
```javascript
// FastIntakeModal - old approach
const handleSave = async () => {
  setApplying(true)
  try {
    const result = await apiFetch('/delivery-templates/apply', ...)
    if (result.success) {
      refresh() // ❌ 5 parallel API requests
      // ❌ Modal might close during refresh
      // ❌ No optimistic updates
    }
  } finally {
    setApplying(false)
  }
}
```

### After Migration
```javascript
// FastIntakeModal - new approach
const { mutate: applyTemplate, isPending } = useAddBatchesBulk(hotelId, deptId)

const handleSave = () => {
  applyTemplate(items, {
    onSuccess: () => {
      // ✅ Instant UI update (optimistic)
      // ✅ Background sync after 2 seconds
      // ✅ Modal stays open
      // ✅ No manual refresh needed
    }
  })
}
```

## Usage Examples

### 1. Reading Data (Queries)

```javascript
import { useInventoryData } from '../hooks/useInventory'

function MyComponent() {
  const { batches, stats, departments, categories, products, loading } = 
    useInventoryData(hotelId)
  
  if (loading) return <Loader />
  
  return <div>{batches.length} batches</div>
}
```

### 2. Mutations (Updates)

```javascript
import { useAddBatch } from '../hooks/useInventory'

function AddBatchForm() {
  const { mutate: addBatch, isPending } = useAddBatch(hotelId)
  
  const handleSubmit = (data) => {
    addBatch(data, {
      onSuccess: () => {
        // Auto-invalidation + optimistic update
        toast.success('Batch added!')
      },
      onError: (error) => {
        toast.error(error.message)
      }
    })
  }
}
```

### 3. Using ProductContext (Backward Compatible)

```javascript
// Old code still works!
import { useProducts } from '../context/ProductContext'

function OldComponent() {
  const { batches, departments, addBatch, refresh } = useProducts()
  
  // Works exactly as before
  await addBatch(productId, deptId, expiryDate, quantity)
}
```

## React Query DevTools

Access in development:
1. Open app in browser
2. Look for floating React Query icon (bottom-right)
3. Click to see:
   - Active queries
   - Cache state
   - Network requests
   - Mutation history

## Configuration

### Query Client Settings
Located in `src/lib/queryClient.js`:
- **staleTime**: 30s for batches, 5min for references
- **gcTime**: 10 minutes cache retention
- **retry**: 2 attempts for queries, 1 for mutations
- **refetchOnWindowFocus**: disabled (too aggressive)

### Query Keys Structure
Located in `src/lib/queryKeys.js`:
```javascript
queryKeys.batches(hotelId)                    // ['batches', hotelId]
queryKeys.batches(hotelId, { departmentId })  // ['batches', hotelId, { departmentId }]
queryKeys.batchesStats(hotelId)               // ['batches', 'stats', hotelId]
```

## Benefits

### Performance
- ✅ Automatic caching - instant navigation
- ✅ Background refetching - always fresh data
- ✅ Optimistic updates - instant UI
- ✅ Request deduplication - no redundant calls

### Developer Experience
- ✅ Less boilerplate (no manual loading states)
- ✅ Automatic error handling
- ✅ Built-in retry logic
- ✅ DevTools for debugging

### User Experience
- ✅ Faster perceived performance
- ✅ Modals don't close during updates
- ✅ No flash of loading states
- ✅ Smoother interactions

## Migration Status

### ✅ Phase 1 (MVP) - DONE
- [x] Install React Query
- [x] Create infrastructure (queryClient, queryKeys)
- [x] Migrate reading data (useInventoryData)
- [x] Update ProductContext wrapper
- [x] Add DevTools

### ✅ Phase 2 - DONE
- [x] Migrate FastIntakeModal
- [x] Implement optimistic updates for bulk add
- [x] Test modal persistence
- [x] Verify background sync

### ✅ Phase 3 - DONE
- [x] Migrate ProductModal (addBatch, deleteBatch, deleteProduct)
- [x] Migrate AddBatchModal (addBatch with optimistic updates)
- [x] Migrate AddCustomProductModal (addProduct with optimistic updates)
- [x] Remove all manual refresh() calls
- [x] All mutations now use React Query with optimistic updates

### ✅ Phase 4 - DONE
- [x] Implement offline support with persistence
- [x] Add cache management UI in Settings
- [x] Integrate with existing OfflineIndicator
- [x] Configure localStorage persistence (24h TTL)
- [x] Add cache size monitoring and cleanup
- [x] Document offline support strategy

### 📋 Future Enhancements (Optional)
- [ ] Migrate NotificationsContext
- [ ] Add prefetching on hover/route changes
- [ ] Implement infinite scroll with useInfiniteQuery
- [ ] Add request cancellation for navigation

## Troubleshooting

### Issue: Stale data after mutation
**Solution**: Check that mutation is calling `invalidateQueries` correctly
```javascript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.batches(hotelId) })
}
```

### Issue: Too many network requests
**Solution**: Increase staleTime for that query type
```javascript
// In queryClient.js
export const STALE_TIMES = {
  batches: 60 * 1000, // 1 minute instead of 30s
}
```

### Issue: Modal closes on update
**Solution**: Ensure you're using React Query mutation, not manual refresh()
```javascript
// ❌ Wrong
refresh() // Triggers full re-render

// ✅ Correct
mutate(data) // Optimistic update, background sync
```

## Next Steps

1. **Monitor Performance**: Use DevTools to check cache hits/misses
2. **Optimize Queries**: Adjust staleTime based on data freshness needs
3. **Add Prefetching**: Prefetch data on hover/navigation for instant UX
4. **Test Edge Cases**: Offline, slow network, concurrent updates

## Resources

- [React Query Docs](https://tanstack.com/query/v5)
- [Query Keys Best Practices](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys)
- [Optimistic Updates Guide](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates)
