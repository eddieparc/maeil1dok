// Firebase Cloud Messaging Service Worker
// NOTE: This is NOT a PWA service worker — it ONLY handles FCM background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase config will be injected via postMessage from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const app = firebase.initializeApp(event.data.config)
    const messaging = firebase.messaging(app)

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification?.title || '매일일독'
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icons/icon-192x192.png',
        data: payload.data,
      }
      self.registration.showNotification(notificationTitle, notificationOptions)
    })
  }
})
