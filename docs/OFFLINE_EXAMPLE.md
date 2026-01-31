# Offline Sync - Примеры использования

## Пример 1: Добавление партии с offline support

```javascript
// AddBatchModal.jsx
import { useState } from 'react'
import { useOfflineBatchMutation } from '../hooks/useOfflineMutation'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/LanguageContext'
import { apiFetch } from '../services/api'

export default function AddBatchModal({ onClose }) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    expiryDate: '',
    productionDate: ''
  })

  // Используем offline mutation
  const addBatchMutation = useOfflineBatchMutation({
    mutationFn: async (data) => {
      return await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      if (data.__offline) {
        // Offline режим - показываем специальное сообщение
        addToast(
          t('toast.batchQueuedOffline') || 'Партия будет добавлена при восстановлении связи',
          'info'
        )
      } else {
        // Online режим - обычное сообщение
        addToast(
          t('toast.batchAdded') || 'Партия добавлена',
          'success'
        )
      }
      onClose()
    },
    onError: (error) => {
      addToast(
        error.message || t('toast.error'),
        'error'
      )
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    addBatchMutation.mutate(formData)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* форма */}
      <button 
        type="submit" 
        disabled={addBatchMutation.isPending}
      >
        {addBatchMutation.isPending ? 'Добавление...' : 'Добавить'}
      </button>
    </form>
  )
}
```

## Пример 2: Сбор продукции

```javascript
// CollectModal.jsx
import { useOfflineCollectMutation } from '../hooks/useOfflineMutation'

export default function CollectModal({ batches, onClose }) {
  const collectMutation = useOfflineCollectMutation({
    mutationFn: async (data) => {
      return await apiFetch('/collections', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: (data) => {
      if (data.__offline) {
        toast.info('Сбор будет выполнен при восстановлении связи')
      } else {
        toast.success('Сбор выполнен успешно')
      }
      onClose()
    }
  })

  const handleCollect = () => {
    collectMutation.mutate({
      items: batches.map(b => ({
        batchId: b.id,
        quantity: b.collectQuantity
      })),
      notes: 'Плановый сбор'
    })
  }

  return (
    <div>
      <button onClick={handleCollect}>
        Собрать
      </button>
    </div>
  )
}
```

## Пример 3: Кастомная mutation с optimistic update

```javascript
import { useOfflineMutation, SyncOperationType } from '../hooks/useOfflineMutation'

function UpdateProductModal({ product, onClose }) {
  const updateMutation = useOfflineMutation({
    mutationFn: async (data) => {
      return await apiFetch(`/products/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    offlineConfig: {
      type: SyncOperationType.UPDATE,
      getEndpoint: (data) => `/products/${data.id}`,
      getMethod: () => 'PUT',
      queryKey: ['products'],
      // Optimistic update - сразу обновляем UI
      optimisticUpdate: (oldProducts, updatedProduct) => {
        return oldProducts.map(p => 
          p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
        )
      }
    },
    onSuccess: (data) => {
      if (data.__offline) {
        toast.info('Изменения будут сохранены при восстановлении связи')
      } else {
        toast.success('Продукт обновлен')
      }
      onClose()
    }
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      updateMutation.mutate({
        id: product.id,
        name: formData.name,
        category: formData.category
      })
    }}>
      {/* форма */}
    </form>
  )
}
```

## Пример 4: Удаление с подтверждением

```javascript
import { useOfflineMutation, SyncOperationType } from '../hooks/useOfflineMutation'

function DeleteBatchButton({ batch }) {
  const deleteMutation = useOfflineMutation({
    mutationFn: async (batchId) => {
      return await apiFetch(`/batches/${batchId}`, {
        method: 'DELETE'
      })
    },
    offlineConfig: {
      type: SyncOperationType.DELETE,
      getEndpoint: (batchId) => `/batches/${batchId}`,
      getMethod: () => 'DELETE',
      queryKey: ['batches'],
      // Optimistic update - сразу убираем из списка
      optimisticUpdate: (oldBatches, deletedId) => {
        return oldBatches.filter(b => b.id !== deletedId)
      }
    },
    onSuccess: (data, batchId) => {
      if (data.__offline) {
        toast.info('Партия будет удалена при восстановлении связи')
      } else {
        toast.success('Партия удалена')
      }
    },
    onError: (error, batchId, context) => {
      // При ошибке optimistic update откатится автоматически
      toast.error('Ошибка удаления: ' + error.message)
    }
  })

  const handleDelete = () => {
    if (confirm('Удалить партию?')) {
      deleteMutation.mutate(batch.id)
    }
  }

  return (
    <button 
      onClick={handleDelete}
      disabled={deleteMutation.isPending}
    >
      {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
    </button>
  )
}
```

## Пример 5: Мониторинг синхронизации

```javascript
// SyncStatusWidget.jsx
import { useOfflineSync } from '../lib/offlineSync'
import { useOnlineStatus } from '../components/ui/OfflineIndicator'

export default function SyncStatusWidget() {
  const isOnline = useOnlineStatus()
  const { pendingCount, isSyncing, sync, clearFailed } = useOfflineSync()

  return (
    <div className="sync-status">
      <div className="status-indicator">
        {isOnline ? (
          <span className="text-green-500">● Онлайн</span>
        ) : (
          <span className="text-amber-500">● Оффлайн</span>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="pending-operations">
          <span>Ожидает синхронизации: {pendingCount}</span>
          
          {isOnline && !isSyncing && (
            <button onClick={sync}>
              Синхронизировать сейчас
            </button>
          )}

          {isSyncing && (
            <span className="animate-spin">⟳ Синхронизация...</span>
          )}

          <button 
            onClick={clearFailed}
            className="text-danger"
          >
            Очистить ошибки
          </button>
        </div>
      )}
    </div>
  )
}
```

## Пример 6: Подписка на события синхронизации

```javascript
// useSync Notifications.js
import { useEffect } from 'react'
import { offlineSyncManager } from '../lib/offlineSync'
import { useToast } from '../context/ToastContext'

export function useSyncNotifications() {
  const { addToast } = useToast()

  useEffect(() => {
    const unsubscribe = offlineSyncManager.subscribe((event) => {
      switch (event.type) {
        case 'sync_completed':
          if (event.synced > 0) {
            addToast(
              `Синхронизировано операций: ${event.synced}`,
              'success'
            )
          }
          if (event.failed > 0) {
            addToast(
              `Ошибок синхронизации: ${event.failed}`,
              'error'
            )
          }
          break

        case 'operation_failed':
          addToast(
            `Не удалось синхронизировать: ${event.error}`,
            'error'
          )
          break

        case 'sync_error':
          addToast(
            'Ошибка синхронизации. Попробуйте позже.',
            'error'
          )
          break
      }
    })

    return unsubscribe
  }, [addToast])
}

// Использование в Layout.jsx
import { useSyncNotifications } from '../hooks/useSyncNotifications'

function Layout() {
  useSyncNotifications() // Автоматические уведомления о синхронизации

  return (
    <div>
      {/* контент */}
    </div>
  )
}
```

## Пример 7: Тестирование offline режима

```javascript
// __tests__/offline.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { offlineSyncManager } from '../lib/offlineSync'
import AddBatchModal from '../components/AddBatchModal'

describe('Offline Sync', () => {
  beforeEach(() => {
    // Эмулируем offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })
  })

  it('должен сохранить операцию в очередь при offline', async () => {
    render(<AddBatchModal />)

    // Заполняем форму
    fireEvent.change(screen.getByLabelText('Количество'), {
      target: { value: '10' }
    })

    // Отправляем
    fireEvent.click(screen.getByText('Добавить'))

    // Проверяем что операция в очереди
    await waitFor(async () => {
      const count = await offlineSyncManager.getPendingCount()
      expect(count).toBe(1)
    })

    // Проверяем сообщение
    expect(screen.getByText(/будет добавлена при восстановлении связи/i)).toBeInTheDocument()
  })

  it('должен синхронизировать при восстановлении связи', async () => {
    // Добавляем операцию в offline
    await offlineSyncManager.queueOperation({
      type: 'CREATE',
      endpoint: '/batches',
      method: 'POST',
      data: { quantity: 10 }
    })

    // Восстанавливаем связь
    Object.defineProperty(navigator, 'onLine', {
      value: true
    })
    window.dispatchEvent(new Event('online'))

    // Ждем синхронизации
    await waitFor(async () => {
      const count = await offlineSyncManager.getPendingCount()
      expect(count).toBe(0)
    }, { timeout: 5000 })
  })
})
```

## Пример 8: Интеграция с React Query

```javascript
// useInventory.js с offline support
import { useQuery } from '@tanstack/react-query'
import { useOfflineBatchMutation } from './useOfflineMutation'
import { apiFetch } from '../services/api'

export function useInventory() {
  // Query для получения данных
  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => apiFetch('/batches'),
    // Работает даже offline (использует кэш)
    networkMode: 'offlineFirst'
  })

  // Mutation с offline support
  const addBatch = useOfflineBatchMutation({
    mutationFn: (data) => apiFetch('/batches', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  })

  const updateBatch = useOfflineMutation({
    mutationFn: (data) => apiFetch(`/batches/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    offlineConfig: {
      type: 'UPDATE',
      getEndpoint: (data) => `/batches/${data.id}`,
      queryKey: ['batches'],
      optimisticUpdate: (old, updated) => 
        old.map(b => b.id === updated.id ? { ...b, ...updated } : b)
    }
  })

  return {
    batches,
    isLoading,
    addBatch: addBatch.mutate,
    updateBatch: updateBatch.mutate,
    isAdding: addBatch.isPending,
    isUpdating: updateBatch.isPending
  }
}
```

## Советы по использованию

1. **Всегда проверяйте `data.__offline`** в `onSuccess` для разных сообщений
2. **Используйте optimistic updates** для мгновенного feedback
3. **Тестируйте offline сценарии** в Chrome DevTools
4. **Мониторьте pending операции** через `useOfflineSync()`
5. **Обрабатывайте ошибки синхронизации** через события
