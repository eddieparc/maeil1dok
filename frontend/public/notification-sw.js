importScripts('/notificationRuntime.js')

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}
  if (event.data) {
    try {
      payload = event.data.json()
    } catch (_error) {
      payload = { body: event.data.text() }
    }
  }

  const title = payload.title || '매일일독'
  const options = {
    body: payload.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.tag || 'maeil1dok-notification',
    data: {
      url: payload.url || '/notifications',
      notificationId: payload.notification_id || null,
      type: payload.type || 'system',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = self.resolveNotificationTargetUrl(event.notification.data?.url, self.location.origin)

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    const existingClient = clientList.find(client => client.url.startsWith(self.location.origin))
    if (existingClient) {
      await existingClient.focus()
      existingClient.navigate(targetUrl)
      return
    }
    await self.clients.openWindow(targetUrl)
  })())
})
