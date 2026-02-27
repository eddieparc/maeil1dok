'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@/types'
import { requestNotificationPermission } from '@/lib/firebase/messaging'

interface NotificationSettings {
  daily_reminder_enabled: boolean
  daily_reminder_time: string
  hasena_notification_enabled: boolean
  friend_activity_enabled: boolean
  push_enabled: boolean
}

interface NotificationsSectionProps {
  user: User
}

function Toggle({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function NotificationsSection({ user: _user }: NotificationsSectionProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load permission state and settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/notifications/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings(data)
        }
      } catch {
        // Settings will stay null; UI handles this gracefully
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const patchSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        throw new Error('저장에 실패했습니다')
      }
      const data = await response.json()
      setSettings(data)
    } catch {
      setError('설정 저장에 실패했습니다. 다시 시도해주세요.')
      // Revert: refetch current settings
      try {
        const response = await fetch('/api/notifications/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings(data)
        }
      } catch {
        // silent
      }
    } finally {
      setSaving(false)
    }
  }, [])

  const handleRequestPermission = async () => {
    setError('')
    setSaving(true)
    try {
      const token = await requestNotificationPermission()

      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission)
      }

      if (token) {
        // Save token to server
        await fetch('/api/notifications/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            deviceInfo: { browser: navigator.userAgent },
          }),
        })

        // Fetch settings (creates defaults if needed)
        const response = await fetch('/api/notifications/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings(data)
        }
      }
    } catch {
      setError('알림 권한 요청 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: keyof NotificationSettings, currentValue: boolean) => {
    if (!settings) return

    // Optimistic update
    const newValue = !currentValue
    setSettings({ ...settings, [field]: newValue })
    patchSettings({ [field]: newValue })
  }

  const handleTimeChange = (value: string) => {
    if (!settings) return

    // Optimistic update
    setSettings({ ...settings, daily_reminder_time: value })

    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      patchSettings({ daily_reminder_time: value })
    }, 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-gray-900">알림 설정</h2>
        <p className="mt-1 text-sm text-gray-500">푸시 알림을 통해 성경 읽기 리마인더를 받을 수 있습니다.</p>
      </div>

      {/* Error message */}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {/* Push Permission */}
      <div className="mt-5">
        {permission === 'default' && (
          <button
            type="button"
            onClick={handleRequestPermission}
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '권한 요청 중...' : '알림 허용하기'}
          </button>
        )}

        {permission === 'granted' && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
            <svg
              className="h-5 w-5 shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-sm font-medium text-green-700">알림이 허용되었습니다</span>
          </div>
        )}

        {permission === 'denied' && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3">
            <svg
              className="h-5 w-5 shrink-0 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-sm text-amber-700">브라우저 설정에서 알림을 허용해주세요</span>
          </div>
        )}
      </div>

      {/* Notification Settings Toggles — only when granted */}
      {permission === 'granted' && (
        <div className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-6 w-11 animate-pulse rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          ) : settings ? (
            <div className="space-y-1">
              {/* Daily reminder */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">매일 읽기 리마인더</p>
                  <p className="text-xs text-gray-500">매일 정해진 시간에 알림을 받습니다</p>
                </div>
                <Toggle
                  checked={settings.daily_reminder_enabled}
                  onToggle={() => handleToggle('daily_reminder_enabled', settings.daily_reminder_enabled)}
                  disabled={saving}
                />
              </div>

              {/* Time picker — shown only when daily reminder enabled */}
              {settings.daily_reminder_enabled && (
                <div className="mb-2 ml-1 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <label htmlFor="reminder-time" className="text-sm text-gray-600">
                    알림 시간
                  </label>
                  <input
                    id="reminder-time"
                    type="time"
                    value={settings.daily_reminder_time || '06:00'}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none transition-colors focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="border-t border-gray-100" />

              {/* Hasena notification */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">하세나 새 영상 알림</p>
                  <p className="text-xs text-gray-500">새로운 하세나 영상이 등록되면 알려드립니다</p>
                </div>
                <Toggle
                  checked={settings.hasena_notification_enabled}
                  onToggle={() => handleToggle('hasena_notification_enabled', settings.hasena_notification_enabled)}
                  disabled={saving}
                />
              </div>

              <div className="border-t border-gray-100" />

              {/* Friend activity */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">친구 활동 알림</p>
                  <p className="text-xs text-gray-500">친구의 읽기 활동 소식을 받습니다</p>
                </div>
                <Toggle
                  checked={settings.friend_activity_enabled}
                  onToggle={() => handleToggle('friend_activity_enabled', settings.friend_activity_enabled)}
                  disabled={saving}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">설정을 불러오는데 실패했습니다.</p>
          )}
        </div>
      )}
    </section>
  )
}
