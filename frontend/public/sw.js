const SHELL_CACHE = 'pointfex-shell-v1'
const SHELL_ASSETS = ['/', '/index.html', '/Logo.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => undefined),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.url.includes('/api/')) return
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  )
})

