'use client'

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@/types'

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

function Toggle({ checked, onToggle, disabled }: { checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--primary-color)]' : 'bg-[var(--color-slate-300)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-bg-primary)] shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

const DEFAULT_SETTINGS: NotificationSettings = {
  daily_reminder_enabled: false,
  daily_reminder_time: '06:00',
  hasena_notification_enabled: true,
  friend_activity_enabled: true,
  push_enabled: false,
}

export default function NotificationsSection({ user: _user }: NotificationsSectionProps) {
  const [initialSettings, setInitialSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [draftSettings, setDraftSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/notifications/settings')
        if (!response.ok) throw new Error('failed')

        const data = (await response.json()) as Partial<NotificationSettings>
        const normalized: NotificationSettings = {
          daily_reminder_enabled: Boolean(data.daily_reminder_enabled),
          daily_reminder_time: data.daily_reminder_time || '06:00',
          hasena_notification_enabled: Boolean(data.hasena_notification_enabled),
          friend_activity_enabled: Boolean(data.friend_activity_enabled),
          push_enabled: Boolean(data.push_enabled),
        }

        setInitialSettings(normalized)
        setDraftSettings(normalized)
      } catch {
        setError('알림 설정을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  useEffect(() => {
    if (!success) return
    const timeoutId = window.setTimeout(() => setSuccess(''), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [success])

  const isDirty = useMemo(
    () => JSON.stringify(initialSettings) !== JSON.stringify(draftSettings),
    [initialSettings, draftSettings]
  )

  const toggleField = (field: keyof NotificationSettings) => {
    if (field === 'daily_reminder_time') return
    setDraftSettings((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  const handleCancel = () => {
    setDraftSettings(initialSettings)
    setError('')
    setSuccess('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftSettings),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error ?? '알림 설정 저장에 실패했습니다.')
        return
      }

      const normalized: NotificationSettings = {
        daily_reminder_enabled: Boolean(data.daily_reminder_enabled),
        daily_reminder_time: data.daily_reminder_time || '06:00',
        hasena_notification_enabled: Boolean(data.hasena_notification_enabled),
        friend_activity_enabled: Boolean(data.friend_activity_enabled),
        push_enabled: Boolean(data.push_enabled),
      }

      setInitialSettings(normalized)
      setDraftSettings(normalized)
      setSuccess('알림 설정이 저장되었습니다.')
    } catch {
      setError('알림 설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-[0.05em] text-[var(--color-slate-500)]">알림</h2>

      <div className="overflow-hidden rounded-xl border border-[var(--color-slate-200)] bg-[var(--color-bg-card)]">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-lg bg-[var(--color-slate-100)]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-slate-100)] p-4">
              <div>
                <p className="text-[0.9375rem] font-medium text-[var(--color-slate-800)]">푸시 알림</p>
                <p className="text-[0.8125rem] text-[var(--color-slate-500)]">앱 푸시 알림 수신 여부</p>
              </div>
              <Toggle checked={draftSettings.push_enabled} onToggle={() => toggleField('push_enabled')} disabled={saving} />
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-slate-100)] p-4">
              <div>
                <p className="text-[0.9375rem] font-medium text-[var(--color-slate-800)]">매일 읽기 리마인더</p>
                <p className="text-[0.8125rem] text-[var(--color-slate-500)]">매일 정해진 시간에 알림</p>
              </div>
              <Toggle
                checked={draftSettings.daily_reminder_enabled}
                onToggle={() => toggleField('daily_reminder_enabled')}
                disabled={saving}
              />
            </div>

            {draftSettings.daily_reminder_enabled && (
              <div className="border-b border-[var(--color-slate-100)] bg-[var(--color-slate-50)] px-4 py-3">
                <label htmlFor="daily-reminder-time" className="text-[0.8125rem] text-[var(--color-slate-600)]">
                  알림 시간
                </label>
                <input
                  id="daily-reminder-time"
                  type="time"
                  value={draftSettings.daily_reminder_time || '06:00'}
                  disabled={saving}
                  onChange={(event) =>
                    setDraftSettings((current) => ({
                      ...current,
                      daily_reminder_time: event.target.value,
                    }))
                  }
                  className="mt-1 block rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-slate-100)] p-4">
              <div>
                <p className="text-[0.9375rem] font-medium text-[var(--color-slate-800)]">하세나 새 영상 알림</p>
                <p className="text-[0.8125rem] text-[var(--color-slate-500)]">새 영상 업로드 시 알림</p>
              </div>
              <Toggle
                checked={draftSettings.hasena_notification_enabled}
                onToggle={() => toggleField('hasena_notification_enabled')}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[0.9375rem] font-medium text-[var(--color-slate-800)]">친구 활동 알림</p>
                <p className="text-[0.8125rem] text-[var(--color-slate-500)]">친구의 읽기 활동 소식</p>
              </div>
              <Toggle
                checked={draftSettings.friend_activity_enabled}
                onToggle={() => toggleField('friend_activity_enabled')}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-slate-100)] px-4 py-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || !isDirty}
                className="rounded-md border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-slate-700)] transition hover:bg-[var(--color-slate-100)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="rounded-md border border-[var(--primary-color)] bg-[var(--primary-color)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
    </section>
  )
}
