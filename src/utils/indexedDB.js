/**
 * useIndexedDB Hook
 * Обёртка для работы с IndexedDB для offline хранения
 * Используется для кеширования данных и pending sync
 */

const DB_NAME = 'freshtrack-db'
const DB_VERSION = 1

// Stores configuration
const STORES = {
  items: { keyPath: 'id', indexes: ['expirationDate', 'categoryId', 'departmentId'] },
  categories: { keyPath: 'id' },
  pendingSync: { keyPath: 'id', autoIncrement: true },
  settings: { keyPath: 'key' },
}

/**
 * Открывает соединение с IndexedDB
 */
export async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Создаём stores
      Object.entries(STORES).forEach(([name, config]) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, {
            keyPath: config.keyPath,
            autoIncrement: config.autoIncrement,
          })

          // Создаём индексы
          if (config.indexes) {
            config.indexes.forEach((indexName) => {
              store.createIndex(indexName, indexName, { unique: false })
            })
          }
        }
      })
    }
  })
}

/**
 * Получить все записи из store
 */
export async function getAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Получить запись по ключу
 */
export async function getById(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Добавить или обновить запись
 */
export async function put(storeName, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put({
      ...data,
      _lastUpdated: Date.now(),
      _synced: false,
    })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Удалить запись
 */
export async function remove(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Сохранить массив данных (bulk insert/update)
 */
export async function putMany(storeName, items) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)

    items.forEach((item) => {
      store.put({
        ...item,
        _lastUpdated: Date.now(),
        _synced: true,
      })
    })

    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Очистить store
 */
export async function clearStore(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Получить записи по индексу
 */
export async function getByIndex(storeName, indexName, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

/**
 * Получить товары с истекающим сроком (по индексу)
 */
export async function getExpiringItems(daysThreshold = 7) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('items', 'readonly')
    const store = transaction.objectStore('items')
    const index = store.index('expirationDate')
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() + daysThreshold)
    
    const range = IDBKeyRange.upperBound(cutoffDate.toISOString())
    const request = index.getAll(range)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

// ========== PENDING SYNC ==========

/**
 * Добавить изменение в очередь синхронизации
 */
export async function addPendingChange(change) {
  return put('pendingSync', {
    ...change,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  })
}

/**
 * Получить все pending изменения
 */
export async function getPendingChanges() {
  return getAll('pendingSync')
}

/**
 * Удалить синхронизированное изменение
 */
export async function removePendingChange(id) {
  return remove('pendingSync', id)
}

/**
 * Синхронизировать pending изменения с сервером
 */
export async function syncPendingChanges(syncFunction) {
  const pending = await getPendingChanges()
  const results = []

  for (const change of pending) {
    try {
      await syncFunction(change)
      await removePendingChange(change.id)
      results.push({ id: change.id, success: true })
    } catch (error) {
      // Увеличиваем счётчик попыток
      await put('pendingSync', {
        ...change,
        retryCount: (change.retryCount || 0) + 1,
        lastError: error.message,
      })
      results.push({ id: change.id, success: false, error: error.message })
    }
  }

  return results
}

export default {
  openDB,
  getAll,
  getById,
  put,
  remove,
  putMany,
  clearStore,
  getByIndex,
  getExpiringItems,
  addPendingChange,
  getPendingChanges,
  removePendingChange,
  syncPendingChanges,
}
