export interface NativePushState {
  readonly requestId: string
  readonly permission: 'granted' | 'denied' | 'default'
  readonly token: string | null
  readonly platform: 'ios' | 'android'
  readonly installationId: string
  readonly error?: string
  readonly managed?: boolean
  readonly subscribed?: boolean
}

export function isNativePushDevice(): boolean {
  return typeof window !== 'undefined'
    && window.isReactNativeWebView === true
    && typeof window.ReactNativeWebView?.postMessage === 'function'
}

function isNativePushState(value: unknown): value is NativePushState {
  if (typeof value !== 'object' || value === null) return false
  return 'requestId' in value && typeof value.requestId === 'string'
    && 'permission' in value
    && (value.permission === 'granted' || value.permission === 'denied' || value.permission === 'default')
    && 'token' in value && (value.token === null || typeof value.token === 'string')
    && 'platform' in value && (value.platform === 'ios' || value.platform === 'android')
    && 'installationId' in value && typeof value.installationId === 'string'
    && (!('error' in value) || typeof value.error === 'string')
    && (!('managed' in value) || typeof value.managed === 'boolean')
    && (!('managed' in value) || value.managed !== true
      || ('subscribed' in value && typeof value.subscribed === 'boolean'))
}

export function requestNativePushState(
  type: 'push:status' | 'push:enable' | 'push:disable' | 'push:logout',
): Promise<NativePushState> {
  const bridge = window.ReactNativeWebView
  if (!bridge) return Promise.reject(new Error('앱에서 기기 알림을 설정해 주세요.'))
  const requestId = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('nativePushState', receive)
    }
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent) || !isNativePushState(event.detail)) return
      const state = event.detail
      if (state.requestId !== requestId) return
      cleanup()
      if (state.error) reject(new Error(state.error))
      else resolve(state)
    }
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('앱의 알림 상태를 확인하지 못했습니다. 앱을 업데이트한 뒤 다시 시도해 주세요.'))
    }, 8000)
    window.addEventListener('nativePushState', receive)
    try {
      bridge.postMessage(JSON.stringify({ type, requestId, managed: window.nativePushManaged === true }))
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
