# Offline Sync — документация

> Обновлено: 3 февраля 2026

## Обзор

FreshTrack поддерживает работу в offline режиме с автоматической синхронизацией при восстановлении связи.

**Быстрый старт:** замените `useMutation` на `useOfflineMutation` (или готовые `useOfflineBatchMutation` и т.п.). В `onSuccess` проверяйте `data.__offline` — если true, показывайте сообщение «Будет синхронизировано при восстановлении связи». Данные кэшируются через React Query Persistence (localStorage, 24 ч, лимит 5MB); очередь мутаций хранится в IndexedDB и отправляется при `navigator.onLine`.

## Архитектура

### Компоненты

1. **offlineSync.js** - Менеджер синхронизации
2. **indexedDB.js** - Хранилище pending операций
3. **useOfflineMutation.js** - Hook для mutations с offline support
4. **OfflineIndicator.jsx** - UI индикатор статуса

### Принцип работы

```
[User Action] → [Check Online Status]
                      ↓
         ┌────────────┴────────────┐
         ↓                         ↓
    [Online]                  [Offline]
         ↓                         ↓
  [Execute API]           [Queue Operation]
         ↓                         ↓
  [Update UI]              [Optimistic Update]
                                   ↓
                          [Save to IndexedDB]
                                   ↓
                          [Wait for Connection]
                                   ↓
                          [Auto Sync on Reconnect]
```

## Использование

### 1. Базовое использование useOfflineMutation

```javascript
import { useOfflineMutation } from '../hooks/useOfflineMutation'

function MyComponent() {
  const mutation = useOfflineMutation({
    mutationFn: async (data) => {
      return await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    offlineConfig: {
      type: SyncOperationType.CREATE,
      getEndpoint: () => '/batches',
      getMethod: () => 'POST',
      queryKey: ['batches'],
      optimisticUpdate: (old, newBatch) => {
        return [newBatch, ...old]
      }
    },
    onSuccess: () => {
      toast.success('Партия добавлена')
    }
  })

  return (
    <button onClick={() => mutation.mutate(data)}>
      Добавить партию
    </button>
  )
}
```

### 2. Использование готовых хелперов

#### Добавление партии

```javascript
import { useOfflineBatchMutation } from '../hooks/useOfflineMutation'

const addBatchMutation = useOfflineBatchMutation({
  mutationFn: async (data) => {
    return await apiFetch('/batches', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  onSuccess: () => {
    toast.success('Партия добавлена')
  }
})
```

#### Сбор продукции

```javascript
import { useOfflineCollectMutation } from '../hooks/useOfflineMutation'

const collectMutation = useOfflineCollectMutation({
  mutationFn: async (data) => {
    return await apiFetch('/collections', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  onSuccess: () => {
    toast.success('Сбор выполнен')
  }
})
```

#### Списание

```javascript
import { useOfflineWriteOffMutation } from '../hooks/useOfflineMutation'

const writeOffMutation = useOfflineWriteOffMutation({
  mutationFn: async (data) => {
    return await apiFetch('/write-offs', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  onSuccess: () => {
    toast.success('Списание выполнено')
  }
})
```

### 3. Ручное управление синхронизацией

```javascript
import { useOfflineSync } from '../lib/offlineSync'

function SyncButton() {
  const { pendingCount, isSyncing, sync } = useOfflineSync()

  return (
    <button onClick={sync} disabled={isSyncing}>
      {isSyncing ? 'Синхронизация...' : `Синхронизировать (${pendingCount})`}
    </button>
  )
}
```

## Конфигурация

### offlineConfig параметры

```typescript
interface OfflineConfig {
  // Тип операции
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'COLLECT' | 'WRITE_OFF'
  
  // Функция для получения endpoint
  getEndpoint: (variables) => string
  
  // Функция для получения HTTP метода
  getMethod?: (variables) => 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  
  // Query key для invalidation
  queryKey?: string[]
  
  // Optimistic update функция
  optimisticUpdate?: (oldData, newData) => any
}
```

### Настройки синхронизации

```javascript
// В offlineSync.js
class OfflineSyncManager {
  constructor() {
    this.maxRetries = 3           // Максимум попыток
    this.retryDelay = 2000         // Задержка между попытками (мс)
  }
}
```

## Автоматическая синхронизация

Синхронизация запускается автоматически:

1. **При восстановлении интернета** - через 1 секунду после события `online`
2. **Периодически** - каждые 30 секунд, если есть pending операции
3. **Вручную** - через `useOfflineSync().sync()`

## Обработка ошибок

### Retry логика

- Операция повторяется до 3 раз
- Экспоненциальная задержка между попытками
- После 3 неудачных попыток - помечается как `failed`

### Failed операции

```javascript
import { offlineSyncManager } from '../lib/offlineSync'

// Очистить все failed операции
await offlineSyncManager.clearFailedOperations()
```

## UI Индикаторы

### OfflineIndicator

Автоматически показывает:
- ⚠️ **Offline** - желтый баннер с количеством pending операций
- ✅ **Reconnected** - зеленый баннер с индикатором синхронизации
- 🔄 **Syncing** - анимация во время синхронизации

### Интеграция

```javascript
import { OfflineIndicator } from './components/ui'

function Layout() {
  return (
    <>
      <OfflineIndicator />
      {/* остальной контент */}
    </>
  )
}
```

## Мониторинг

### События синхронизации

```javascript
import { offlineSyncManager } from '../lib/offlineSync'

offlineSyncManager.subscribe((event) => {
  switch (event.type) {
    case 'sync_started':
      console.log('Синхронизация началась')
      break
    case 'sync_completed':
      console.log(`Синхронизировано: ${event.synced}, ошибок: ${event.failed}`)
      break
    case 'operation_queued':
      console.log('Операция добавлена в очередь:', event.operation)
      break
    case 'operation_synced':
      console.log('Операция синхронизирована:', event.operation)
      break
    case 'operation_failed':
      console.log('Операция не удалась:', event.operation, event.error)
      break
  }
})
```

## Тестирование

### Эмуляция offline режима

1. **Chrome DevTools:**
   - Network tab → Throttling → Offline
   
2. **Программно:**
```javascript
// Отключить интернет
window.dispatchEvent(new Event('offline'))

// Включить интернет
window.dispatchEvent(new Event('online'))
```

### Проверка pending операций

```javascript
import { getPendingChanges } from '../utils/indexedDB'

const pending = await getPendingChanges()
console.log('Pending операций:', pending.length)
```

## Best Practices

1. **Всегда используйте useOfflineMutation** для критичных операций (добавление, сбор, списание)
2. **Предоставляйте optimisticUpdate** для мгновенного UI feedback
3. **Указывайте queryKey** для автоматической invalidation после sync
4. **Тестируйте offline сценарии** перед деплоем
5. **Мониторьте failed операции** в production

## Ограничения

1. **Не поддерживается:**
   - Загрузка файлов в offline
   - Сложные транзакции с зависимостями
   - Real-time операции (SSE/WebSocket)

2. **Лимиты:**
   - IndexedDB: ~50MB на домен (зависит от браузера)
   - Максимум 3 retry попытки
   - Timeout синхронизации: 30 секунд на операцию

## Troubleshooting

### Операции не синхронизируются

1. Проверьте IndexedDB в DevTools (Application → IndexedDB → freshtrack-db)
2. Проверьте консоль на ошибки
3. Проверьте `navigator.onLine` статус
4. Очистите failed операции: `offlineSyncManager.clearFailedOperations()`

### Дублирование данных

- Убедитесь что операции имеют уникальные ID
- Проверьте что backend обрабатывает idempotency
- Используйте optimistic updates правильно

### Медленная синхронизация

- Проверьте количество pending операций
- Увеличьте `retryDelay` если сервер медленный
- Оптимизируйте размер данных в операциях

## Roadmap

- [ ] Batch синхронизация (несколько операций за раз)
- [ ] Приоритизация операций
- [ ] Conflict resolution для одновременных изменений
- [ ] Background sync через Service Worker
- [ ] Compression для больших операций
