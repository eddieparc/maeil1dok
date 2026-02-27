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
