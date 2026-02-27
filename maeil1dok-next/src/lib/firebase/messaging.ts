'use client'

import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging'
import { firebaseApp } from './config'

let messaging: Messaging | null = null

function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!messaging) {
    messaging = getMessaging(firebaseApp)
  }
  return messaging
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const instance = getMessagingInstance()
    if (!instance) return null

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    const token = await getToken(instance, { vapidKey })

    // Send Firebase config to service worker for background message handling
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        },
      })
    }

    return token
  } catch (error) {
    console.error('Error getting FCM token:', error)
    return null
  }
}

export function onForegroundMessage(
  callback: (payload: unknown) => void
): () => void {
  const instance = getMessagingInstance()
  if (!instance) return () => {}
  return onMessage(instance, callback)
}
