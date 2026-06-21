/* eslint-disable no-undef */
/**
 * Web Push handlers, imported into the Workbox-generated service worker via
 * `workbox.importScripts` (see vite.config.ts). Runs in the SW global scope.
 *
 * Payload shape (sent by the backend WebPushSender): { title, body, url }.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'todly'
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(url)
          return undefined
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
