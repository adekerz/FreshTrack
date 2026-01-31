# Offline Sync - Быстрый старт

## Что это дает?

✅ Работа приложения без интернета  
✅ Автоматическая синхронизация при восстановлении связи  
✅ Optimistic UI updates (мгновенный feedback)  
✅ Очередь операций с retry логикой  
✅ Визуальные индикаторы статуса  

## Как использовать?

### Шаг 1: Замените useMutation на useOfflineMutation

**Было:**
```javascript
import { useMutation } from '@tanstack/react-query'

const mutation = useMutation({
  mutationFn: (data) => apiFetch('/batches', {
    method: 'POST',
    body: JSON.stringify(data)
  })
})
```

**Стало:**
```javascript
import { useOfflineBatchMutation } from '../hooks/useOfflineMutation'

const mutation = useOfflineBatchMutation({
  mutationFn: (data) => apiFetch('/batches', {
    method: 'POST',
    body: JSON.stringify(data)
  })
})
```

### Шаг 2: Обработайте offline режим в onSuccess

```javascript
const mutation = useOfflineBatchMutation({
  mutationFn: (data) => apiFetch('/batches', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  onSuccess: (data) => {
    if (data.__offline) {
      // Offline - данные в очереди
      toast.info('Будет добавлено при восстановлении связи')
    } else {
      // Online - успешно добавлено
      toast.success('Партия добавлена')
    }
  }
})
```

### Шаг 3: Готово!

Теперь ваша форма работает offline:
- При отсутствии интернета операции сохраняются в IndexedDB
- При восстановлении связи автоматически синхронизируются
- Пользователь видит индикатор статуса вверху экрана

## Готовые хелперы

### Добавление партии
```javascript
import { useOfflineBatchMutation } from '../hooks/useOfflineMutation'
```

### Сбор продукции
```javascript
import { useOfflineCollectMutation } from '../hooks/useOfflineMutation'
```

### Списание
```javascript
import { useOfflineWriteOffMutation } from '../hooks/useOfflineMutation'
```

### Кастомная операция
```javascript
import { useOfflineMutation, SyncOperationType } from '../hooks/useOfflineMutation'

const mutation = useOfflineMutation({
  mutationFn: (data) => apiFetch('/endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  offlineConfig: {
    type: SyncOperationType.CREATE,
    getEndpoint: () => '/endpoint',
    queryKey: ['myData']
  }
})
```

## Мониторинг

### Показать количество pending операций

```javascript
import { useOfflineSync } from '../lib/offlineSync'

function MyComponent() {
  const { pendingCount } = useOfflineSync()
  
  return <span>Ожидает: {pendingCount}</span>
}
```

### Кнопка ручной синхронизации

```javascript
import { useOfflineSync } from '../lib/offlineSync'

function SyncButton() {
  const { sync, isSyncing, pendingCount } = useOfflineSync()
  
  return (
    <button onClick={sync} disabled={isSyncing}>
      {isSyncing ? 'Синхронизация...' : `Синхронизировать (${pendingCount})`}
    </button>
  )
}
```

## Тестирование

### В Chrome DevTools

1. Откройте DevTools (F12)
2. Network tab → Throttling → **Offline**
3. Попробуйте добавить партию
4. Увидите желтый баннер "Нет подключения"
5. Переключите обратно на **Online**
6. Увидите зеленый баннер "Синхронизация..."
7. Данные автоматически отправятся на сервер

### Программно

```javascript
// Отключить интернет
window.dispatchEvent(new Event('offline'))

// Включить интернет
window.dispatchEvent(new Event('online'))
```

## Что происходит под капотом?

```
1. Пользователь нажимает "Добавить партию"
2. Проверяется navigator.onLine
   
   ЕСЛИ ONLINE:
   → Отправка на сервер
   → Обновление UI
   → onSuccess с обычным результатом
   
   ЕСЛИ OFFLINE:
   → Сохранение в IndexedDB
   → Optimistic update UI
   → onSuccess с { __offline: true }
   → Показ желтого баннера
   
3. При восстановлении связи:
   → Событие 'online'
   → Автозапуск синхронизации (через 1 сек)
   → Отправка всех pending операций
   → Показ зеленого баннера
   → Invalidation queries
   → Обновление UI с реальными данными
```

## FAQ

**Q: Нужно ли что-то менять на backend?**  
A: Нет, backend работает как обычно.

**Q: Что если пользователь закроет приложение offline?**  
A: Операции сохранены в IndexedDB и синхронизируются при следующем запуске.

**Q: Что если операция не удалась 3 раза?**  
A: Она помечается как `failed`. Можно очистить через `clearFailed()`.

**Q: Можно ли отключить offline режим?**  
A: Да, просто используйте обычный `useMutation` вместо `useOfflineMutation`.

**Q: Работает ли с загрузкой файлов?**  
A: Нет, только JSON данные. Файлы требуют отдельной реализации.

## Следующие шаги

📖 [Полная документация](./OFFLINE_SYNC.md)  
💡 [Примеры использования](./OFFLINE_EXAMPLE.md)  
🔧 [API Reference](./OFFLINE_API.md)  

## Поддержка

Если возникли проблемы:
1. Проверьте консоль браузера
2. Проверьте IndexedDB в DevTools
3. Проверьте `navigator.onLine` статус
4. Откройте issue на GitHub
