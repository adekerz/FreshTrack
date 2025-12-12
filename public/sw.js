const CACHE_NAME = 'freshtrack-v1'
const STATIC_CACHE = 'freshtrack-static-v1'
const DYNAMIC_CACHE = 'freshtrack-dynamic-v1'

// Статические ресурсы для кэширования
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached')
        return self.skipWaiting()
      })
      .catch((err) => {
        console.error('[SW] Failed to cache static assets:', err)
      })
  )
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        console.log('[SW] Old caches deleted')
        return self.clients.claim()
      })
  )
})

// Стратегия: Network First с fallback на кэш для API
// Стратегия: Cache First для статических ресурсов
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Пропускаем не-GET запросы
  if (request.method !== 'GET') {
    return
  }
  
  // Пропускаем запросы к другим доменам
  if (url.origin !== location.origin) {
    return
  }
  
  // API запросы - Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }
  
  // Статические ресурсы - Cache First
  event.respondWith(cacheFirst(request))
})

// Network First стратегия
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Возвращаем ошибку для API запросов
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'Нет подключения к сети' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Cache First стратегия
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    // Обновляем кэш в фоне
    fetchAndCache(request)
    return cachedResponse
  }
  
  return fetchAndCache(request)
}

// Загрузка и кэширование
async function fetchAndCache(request) {
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Fetch failed:', request.url)
    
    // Для навигационных запросов возвращаем index.html
    if (request.mode === 'navigate') {
      return caches.match('/index.html')
    }
    
    throw error
  }
}

// Push уведомления
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')
  
  const data = event.data ? event.data.json() : {}
  
  const title = data.title || 'FreshTrack'
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked')
  
  event.notification.close()
  
  if (event.action === 'close') {
    return
  }
  
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если есть открытое окно, фокусируемся на нём
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  
  if (event.tag === 'sync-batches') {
    event.waitUntil(syncBatches())
  }
})

async function syncBatches() {
  try {
    // Здесь можно синхронизировать офлайн изменения
    console.log('[SW] Syncing batches...')
  } catch (error) {
    console.error('[SW] Sync failed:', error)
  }
}
