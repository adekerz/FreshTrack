/**
 * FreshTrack Service Worker (injectManifest)
 * Precache — из Vite build (self.__WB_MANIFEST подставляется плагином).
 * Runtime: API network-first, navigate fallback на index.html, sync/push.
 */

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Динамический precache от vite-plugin-pwa (хеши из build)
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

self.skipWaiting()
clientsClaim()

// --- Runtime cache (не из build) ---
const API_CACHE = 'freshtrack-api-v1'

const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/settings/,
]

function isApiRequest(pathname) {
  return API_CACHE_PATTERNS.some((re) => re.test(pathname))
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.port === '5173' || url.pathname.includes('/src/') || url.pathname.includes('/@') || url.pathname.includes('node_modules')) {
    return
  }
  if (event.request.method !== 'GET') return
  if (url.origin !== location.origin) return

  if (url.pathname.startsWith('/api') && isApiRequest(url.pathname)) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE))
    return
  }

  // Навигация (SPA): network first, fallback на precached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    )
  }
})

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') return caches.match('/index.html')
    throw new Error('Offline')
  }
}

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges())
  }
})

async function syncPendingChanges() {
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' })
  })
}

// Push
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body: data.body || 'Новое уведомление',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/', ...data },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' },
    ],
    tag: data.tag || 'default',
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(data.title || 'FreshTrack', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'close') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
