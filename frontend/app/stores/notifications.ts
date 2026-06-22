import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import {
  isDevicePushSupported,
  readBrowserPushState,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
} from '~/utils/devicePushRuntime'

export interface NotificationItem {
  id: number
  type: 'reading_reminder' | 'hasena_reminder' | 'friend_activity' | 'system'
  title: string
  body: string
  target_url: string
  data: Record<string, string | number | boolean>
  actor_name: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationSettings {
  notifications_enabled: boolean
  reading_reminders_enabled: boolean
  hasena_reminders_enabled: boolean
  friend_activity_enabled: boolean
  reading_reminder_time: string
  hasena_reminder_time: string
  timezone: string
}

export type DevicePushPermission = NotificationPermission | 'unsupported' | 'unavailable'

export interface DevicePushState {
  supported: boolean
  permission: DevicePushPermission
  subscribed: boolean
  isSyncing: boolean
  error: string | null
}

export interface NotificationInboxResponse {
  success: boolean
  message?: string
  unread_count: number
  notifications: NotificationItem[]
  settings: NotificationSettings
}

interface NotificationSettingsResponse {
  success: boolean
  message?: string
  settings: NotificationSettings
}

type NotificationSettingsPatch = Partial<NotificationSettings>

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as NotificationItem[],
    settings: null as NotificationSettings | null,
    unreadCount: 0,
    isLoading: false,
    isSaving: false,
    error: null as string | null,
    devicePush: {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      isSyncing: false,
      error: null,
    } as DevicePushState,
  }),

  getters: {
    unreadNotifications: (state) => state.notifications.filter(item => !item.is_read),
  },

  actions: {
    async fetchInbox(unreadOnly = false) {
      this.isLoading = true
      this.error = null
      try {
        const response: { data: NotificationInboxResponse } = await useApi().get('/api/v1/todos/notifications/', {
          params: unreadOnly ? { unread_only: 'true' } : undefined,
        })
        if (!response.data.success) {
          throw new Error(response.data.message ?? '알림을 불러올 수 없습니다.')
        }
        this.notifications = response.data.notifications ?? []
        this.unreadCount = response.data.unread_count ?? 0
        this.settings = response.data.settings ?? this.settings
      } catch (error) {
        this.error = getErrorMessage(error, '알림을 불러올 수 없습니다.')
      } finally {
        this.isLoading = false
      }
    },

    async fetchSettings() {
      this.isLoading = true
      this.error = null
      try {
        const response: { data: NotificationSettingsResponse } = await useApi().get('/api/v1/todos/notifications/settings/')
        if (!response.data.success) {
          throw new Error(response.data.message ?? '알림 설정을 불러올 수 없습니다.')
        }
        this.settings = response.data.settings
      } catch (error) {
        this.error = getErrorMessage(error, '알림 설정을 불러올 수 없습니다.')
      } finally {
        this.isLoading = false
      }
    },

    async markAsRead(notificationId: number) {
      const target = this.notifications.find(item => item.id === notificationId)
      if (!target || target.is_read) return

      const previousUnreadCount = this.unreadCount
      target.is_read = true
      target.read_at = new Date().toISOString()
      this.unreadCount = Math.max(0, this.unreadCount - 1)

      try {
        await useApi().patch(`/api/v1/todos/notifications/${notificationId}/read/`, {})
      } catch (error) {
        target.is_read = false
        target.read_at = null
        this.unreadCount = previousUnreadCount
        this.error = getErrorMessage(error, '알림 읽음 처리에 실패했습니다.')
      }
    },

    async markAllAsRead() {
      const previousNotifications = this.notifications.map(item => ({ ...item }))
      const previousUnreadCount = this.unreadCount
      const now = new Date().toISOString()
      this.notifications = this.notifications.map(item => ({
        ...item,
        is_read: true,
        read_at: item.read_at ?? now,
      }))
      this.unreadCount = 0

      try {
        await useApi().post('/api/v1/todos/notifications/mark-all-read/')
      } catch (error) {
        this.notifications = previousNotifications
        this.unreadCount = previousUnreadCount
        this.error = getErrorMessage(error, '모두 읽음 처리에 실패했습니다.')
      }
    },

    async updateSettings(patch: NotificationSettingsPatch) {
      this.isSaving = true
      this.error = null
      try {
        const response: NotificationSettingsResponse = await useApi().patch('/api/v1/todos/notifications/settings/', patch)
        if (!response.success) {
          throw new Error(response.message ?? '알림 설정 저장에 실패했습니다.')
        }
        this.settings = response.settings
        return { success: true }
      } catch (error) {
        const message = getErrorMessage(error, '알림 설정 저장에 실패했습니다.')
        this.error = message
        return { success: false, error: message }
      } finally {
        this.isSaving = false
      }
    },

    async syncDevicePushState() {
      if (!isDevicePushSupported()) {
        this.devicePush = {
          supported: false,
          permission: 'unsupported',
          subscribed: false,
          isSyncing: false,
          error: null,
        }
        return
      }

      this.devicePush.isSyncing = true
      this.devicePush.error = null
      try {
        Object.assign(this.devicePush, await readBrowserPushState())
      } catch (error) {
        this.devicePush.error = getErrorMessage(error, '기기 알림 상태를 확인할 수 없습니다.')
      } finally {
        this.devicePush.isSyncing = false
      }
    },

    async enableDevicePush() {
      if (!isDevicePushSupported()) {
        this.devicePush.supported = false
        this.devicePush.permission = 'unsupported'
        return { success: false, error: '이 브라우저는 OS 푸시 알림을 지원하지 않습니다.' }
      }

      this.devicePush.isSyncing = true
      this.devicePush.error = null
      try {
        await subscribeCurrentDevice()
        Object.assign(this.devicePush, await readBrowserPushState())
        return { success: true }
      } catch (error) {
        const message = getErrorMessage(error, '기기 푸시 알림을 켤 수 없습니다.')
        if (message.includes('서버 설정')) {
          this.devicePush.permission = 'unavailable'
        } else if (typeof Notification !== 'undefined') {
          this.devicePush.permission = Notification.permission
        }
        this.devicePush.error = message
        return { success: false, error: message }
      } finally {
        this.devicePush.isSyncing = false
      }
    },

    async disableDevicePush() {
      if (!isDevicePushSupported()) {
        this.devicePush.subscribed = false
        return { success: true }
      }

      this.devicePush.isSyncing = true
      this.devicePush.error = null
      try {
        await unsubscribeCurrentDevice()
        Object.assign(this.devicePush, await readBrowserPushState())
        return { success: true }
      } catch (error) {
        const message = getErrorMessage(error, '기기 푸시 알림을 끌 수 없습니다.')
        this.devicePush.error = message
        return { success: false, error: message }
      } finally {
        this.devicePush.isSyncing = false
      }
    },

  },
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
