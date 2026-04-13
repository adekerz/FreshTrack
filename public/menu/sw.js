const CACHE_NAME = 'rc-menu-v1'
const ASSETS = [
  '/menu/',
  '/menu/index.html',
  '/menu-favicon.png',
  '/menu-icon192.png',
  '/menu-icon.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Cache-first for same-origin and Google Fonts
  const url = new URL(event.request.url)
  const isCacheable =
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'

  if (!isCacheable) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
    })
  )
})
