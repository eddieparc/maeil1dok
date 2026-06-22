import { useApi } from '~/composables/useApi'
import type { DevicePushPermission } from '~/stores/notifications'

interface PushConfigResponse {
  success: boolean
  enabled: boolean
  vapid_public_key: string
  message?: string
}

interface PushSubscriptionResponse {
  success: boolean
  message?: string
  error?: string
}

interface BrowserPushState {
  supported: boolean
  permission: DevicePushPermission
  subscribed: boolean
}

export function isDevicePushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function readBrowserPushState(): Promise<BrowserPushState> {
  if (!isDevicePushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
    }
  }

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  }
}

export async function subscribeCurrentDevice(): Promise<void> {
  const config = await fetchPushConfig()
  if (!config.enabled || !config.vapid_public_key) {
    throw new Error('푸시 알림 서버 설정이 아직 준비되지 않았습니다.')
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    throw new Error('브라우저 알림 권한이 허용되지 않았습니다.')
  }

  await navigator.serviceWorker.register('/notification-sw.js', { scope: '/' })
  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
  })
  await registerSubscriptionWithServer(subscription)
}

export async function unsubscribeCurrentDevice(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await useApi().post('/api/v1/todos/notifications/push/subscriptions/remove/', {
    endpoint: subscription.endpoint,
  })
  await subscription.unsubscribe()
}

async function fetchPushConfig() {
  const response: { data: PushConfigResponse } = await useApi().get('/api/v1/todos/notifications/push/config/')
  if (!response.data.success) {
    throw new Error(response.data.message ?? '푸시 알림 설정을 불러올 수 없습니다.')
  }
  return response.data
}

async function registerSubscriptionWithServer(subscription: PushSubscription): Promise<void> {
  const payload = normalizeSubscriptionPayload(subscription)
  const response: PushSubscriptionResponse = await useApi().post(
    '/api/v1/todos/notifications/push/subscriptions/',
    payload,
  )
  if (!response.success) {
    throw new Error(response.error ?? response.message ?? '기기 푸시 알림을 저장할 수 없습니다.')
  }
}

function normalizeSubscriptionPayload(subscription: PushSubscription) {
  const payload = subscription.toJSON()
  const endpoint = payload.endpoint
  const keys = payload.keys
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('브라우저 푸시 구독 정보가 올바르지 않습니다.')
  }
  return {
    endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }
  return outputArray
}
