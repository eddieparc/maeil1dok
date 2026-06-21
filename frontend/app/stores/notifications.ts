import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'

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
  },
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
