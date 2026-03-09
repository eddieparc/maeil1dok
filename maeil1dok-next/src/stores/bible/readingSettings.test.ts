import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoreApi } from 'zustand'
import {
  createReadingSettingsStore,
  DEFAULT_SETTINGS,
  readingSettingsSelectors,
  type ReadingSettingsState,
} from './readingSettings'

type PersistedReadingSettingsStore = StoreApi<ReadingSettingsState> & {
  persist: {
    rehydrate: () => Promise<void>
  }
}

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

describe('ReadingSettings Store', () => {
  let store: PersistedReadingSettingsStore
  let localStorageMock: Storage

  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorageMock = createLocalStorageMock()

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      matchMedia: vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    vi.stubGlobal('localStorage', localStorageMock)

    store = createReadingSettingsStore() as PersistedReadingSettingsStore
    await store.persist.rehydrate()
  })

  it('기본값이 올바르게 초기화된다', () => {
    const { settings } = store.getState()

    expect(settings.fontSize).toBe(16)
    expect(settings.lineHeight).toBe(1.6)
    expect(settings.theme).toBe('light')
  })

  it('updateSetting으로 fontSize를 변경한다', () => {
    store.getState().updateSetting('fontSize', 20)

    expect(store.getState().settings.fontSize).toBe(20)
  })

  it('updateSetting으로 theme를 변경한다', () => {
    store.getState().updateSetting('theme', 'dark')

    expect(store.getState().settings.theme).toBe('dark')
  })

  it('adjustFontSize는 delta만큼 증감한다', () => {
    store.getState().adjustFontSize(2)

    expect(store.getState().settings.fontSize).toBe(18)
  })

  it('adjustFontSize는 최소값(14)으로 클램핑한다', () => {
    store.getState().adjustFontSize(-10)

    expect(store.getState().settings.fontSize).toBe(14)
  })

  it('resetToDefaults는 기본값으로 되돌린다', () => {
    store.getState().updateSettings({
      theme: 'dark',
      fontSize: 22,
      lineHeight: 2.1,
      verseJoining: true,
    })

    store.getState().resetToDefaults()

    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('persist merge에서 legacy lineHeight 문자열을 숫자로 마이그레이션한다', async () => {
    localStorageMock.setItem(
      'reading-settings',
      JSON.stringify({
        state: {
          settings: {
            lineHeight: 'compact',
            theme: 'dark',
          },
        },
        version: 0,
      })
    )

    const rehydrated = createReadingSettingsStore() as PersistedReadingSettingsStore
    await rehydrated.persist.rehydrate()

    expect(rehydrated.getState().settings.lineHeight).toBe(1.5)
    expect(rehydrated.getState().settings.theme).toBe('dark')
  })

  it('effectiveTheme selector는 system 테마를 light/dark로 해석한다', () => {
    const matchMedia = vi.fn(() => ({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      matchMedia,
    })

    store.getState().updateSetting('theme', 'system')

    expect(readingSettingsSelectors.effectiveTheme(store.getState())).toBe('dark')
  })
})
