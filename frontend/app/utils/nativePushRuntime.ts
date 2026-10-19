import { useApi } from '~/composables/useApi'
import { requestNativePushState } from './nativePushBridge'

export async function readNativePushState() {
  const api = useApi()
  const state = await requestNativePushState('push:status')
  if (state.managed) {
    return { supported: true, permission: state.permission, subscribed: state.subscribed === true }
  }
  if (state.permission !== 'granted' || !state.token) {
    return { supported: true, permission: state.permission, subscribed: false }
  }
  const result = await api.POST('/api/v1/todos/notifications/push/native/status/', {
    token: state.token,
    installation_id: state.installationId,
  })
  if (!result.success) throw new Error('기기 알림 등록 상태를 확인하지 못했습니다.')
  return { supported: true, permission: state.permission, subscribed: result.enabled }
}

export async function enableNativePush() {
  const api = useApi()
  const state = await requestNativePushState('push:enable')
  if (state.permission !== 'granted' || !state.token) {
    throw new Error('휴대폰 설정에서 매일일독 알림을 허용해 주세요.')
  }
  if (state.managed) return
  const result = await api.POST('/api/v1/todos/notifications/push/native/', {
    token: state.token,
    platform: state.platform,
    installation_id: state.installationId,
  })
  if (!result.success) throw new Error('기기 알림을 등록하지 못했습니다.')
}

export async function disableNativePush() {
  const api = useApi()
  const state = await requestNativePushState('push:disable')
  if (state.managed) return
  if (!state.token) return
  const result = await api.POST('/api/v1/todos/notifications/push/native/remove/', {
    token: state.token,
    installation_id: state.installationId,
  })
  if (!result.success) throw new Error('기기 알림을 해제하지 못했습니다.')
}

/** Refresh an authorized installation, without undoing an explicit device opt-out. */
export async function syncNativePushRegistration(isCurrentUser: () => boolean) {
  const api = useApi()
  const state = await requestNativePushState('push:status')
  if (state.managed) return
  if (!isCurrentUser() || !state.token) return
  if (state.permission !== 'granted') {
    const removal = await api.POST('/api/v1/todos/notifications/push/native/remove/', {
      token: state.token,
      installation_id: state.installationId,
    })
    if (!removal.success) throw new Error('기기 알림을 해제하지 못했습니다.')
    return
  }
  const result = await api.POST('/api/v1/todos/notifications/push/native/status/', {
    token: state.token,
    installation_id: state.installationId,
  })
  if (!result.success) throw new Error('기기 알림 등록 상태를 확인하지 못했습니다.')
  if (!isCurrentUser() || (result.registered && !result.enabled)) return
  const registration = await api.POST('/api/v1/todos/notifications/push/native/', {
    token: state.token,
    platform: state.platform,
    installation_id: state.installationId,
    explicit: false,
  })
  if (!registration.success) throw new Error('기기 알림을 등록하지 못했습니다.')
}
