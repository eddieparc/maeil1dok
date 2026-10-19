import type { ReadingSettings } from '~/stores/readingSettings'

export const READING_SETTINGS_STORAGE_KEY = 'readingSettings'
const PENDING_KEY = `${READING_SETTINGS_STORAGE_KEY}:pending`

export function savePendingReadingSettings(
  settings: ReadingSettings,
  pending: Partial<ReadingSettings>,
  userId: number | null,
): void {
  const keys = Object.keys(pending)
  if (userId === null || keys.length === 0) {
    localStorage.removeItem(PENDING_KEY)
    return
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify({
    userId, keys, snapshot: JSON.stringify(settings),
  }))
}

export function recoverPendingReadingSettings(
  settings: ReadingSettings,
  userId: number | null,
  validKeys: Array<keyof ReadingSettings>,
): Partial<ReadingSettings> {
  if (typeof localStorage === 'undefined' || userId === null) return {}
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    if (!raw || typeof raw !== 'object' ||
        !('userId' in raw) || raw.userId !== userId ||
        !('snapshot' in raw) || typeof raw.snapshot !== 'string' ||
        raw.snapshot !== localStorage.getItem(READING_SETTINGS_STORAGE_KEY) ||
        !('keys' in raw) || !Array.isArray(raw.keys) || raw.keys.length > validKeys.length) return {}
    const pending: Partial<ReadingSettings> = {}
    for (const key of validKeys) {
      if (raw.keys.includes(key)) Object.assign(pending, { [key]: settings[key] })
    }
    return pending
  } catch (error) {
    console.warn('Failed to recover pending reading settings:', error)
    return {}
  }
}
