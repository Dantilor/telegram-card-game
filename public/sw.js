/* Minimal installability SW for WEB only.
 * Network-only: never caches API, auth, payments, or HTML shells with private state.
 * Registered only from the WEB build (isWebShell).
 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never intercept private or mutable endpoints.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/telegram/') ||
    url.pathname.startsWith('/legal/') ||
    url.pathname === '/health'
  ) {
    return
  }
  // Passthrough network — avoids stale hashed chunks and private HTML state.
  event.respondWith(fetch(req))
})
