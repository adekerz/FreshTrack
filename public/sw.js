/**
 * FreshTrack Service Worker
 * PWA implementation with offline support and caching strategies
 */

const CACHE_NAME = 'freshtrack-v2'
const STATIC_CACHE = 'freshtrack-static-v2'
const API_CACHE = 'freshtrack-api-v1'

// Ресурсы для предварительного кеширования
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
]

// API endpoints для кеширования
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/batches/,
  /\/api\/settings/,
]

// Install event - precache critical resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.log('[SW] Precache failed:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => 
            name !== STATIC_CACHE && 
            name !== API_CACHE && 
            name !== CACHE_NAME
          )
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - smart caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }
  
  // API requests - Network First with fallback to cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE))
    return
  }
  
  // Static assets - Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(event.request, STATIC_CACHE))
    return
  }
  
  // HTML pages - Network First
  event.respondWith(networkFirstWithCache(event.request, CACHE_NAME))
})

/**
 * Network First strategy with cache fallback
 */
async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html')
    }
    
    throw error
  }
}

/**
 * Cache First strategy with network fallback
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    // Update cache in background
    fetchAndCache(request, cacheName)
    return cachedResponse
  }
  
  return fetchAndCache(request, cacheName)
}

/**
 * Fetch and update cache
 */
async function fetchAndCache(request, cacheName) {
  const networkResponse = await fetch(request)
  
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, networkResponse.clone())
  }
  
  return networkResponse
}

/**
 * Check if request is for static asset
 */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot|ico)$/i.test(pathname)
}

// Background Sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges())
  }
})

/**
 * Sync pending changes when back online
 */
async function syncPendingChanges() {
  // This will be called when the browser comes back online
  // Implementation depends on how you store pending changes
  console.log('[SW] Syncing pending changes...')
  
  // Notify all clients about sync
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// Push notifications handler
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ],
    tag: data.tag || 'default',
    renotify: true,
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'FreshTrack', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  if (event.action === 'close') return
  
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
