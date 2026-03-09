import { persist } from 'zustand/middleware'
import { createStoreFactory, type StateCreator } from '@/lib/zustand/factory'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily =
  | 'ridi-batang'
  | 'noto-serif'
  | 'kopub-batang'
  | 'pretendard'
  | 'noto-sans'
  | 'system'
export type FontWeight = 'normal' | 'medium' | 'bold'
export type LineHeight = number
export type TextAlign = 'left' | 'justify'

export interface ReadingSettings {
  theme: ThemeMode
  fontFamily: FontFamily
  fontSize: number
  fontWeight: FontWeight
  lineHeight: LineHeight
  textAlign: TextAlign
  verseJoining: boolean
  showVerseNumbers: boolean
  tongdokAutoComplete: boolean
  showDescription: boolean
  showCrossRef: boolean
  highlightNames: boolean
  showFootnotes: boolean
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'light',
  fontFamily: 'kopub-batang',
  fontSize: 16,
  fontWeight: 'medium',
  lineHeight: 1.6,
  textAlign: 'left',
  verseJoining: false,
  showVerseNumbers: true,
  tongdokAutoComplete: false,
  showDescription: true,
  showCrossRef: true,
  highlightNames: true,
  showFootnotes: false,
}

export const FONT_FAMILIES: Record<
  FontFamily,
  { name: string; css: string; type: 'serif' | 'sans-serif' | 'system' }
> = {
  'kopub-batang': {
    name: 'KoPub 바탕',
    css: '"KoPub Batang", serif',
    type: 'serif',
  },
  'ridi-batang': { name: 'RIDI 바탕', css: '"RIDIBatang", serif', type: 'serif' },
  'noto-serif': { name: 'Noto Serif KR', css: '"Noto Serif KR", serif', type: 'serif' },
  pretendard: {
    name: 'Pretendard',
    css: '"Pretendard", sans-serif',
    type: 'sans-serif',
  },
  'noto-sans': {
    name: 'Noto Sans KR',
    css: '"Noto Sans KR", sans-serif',
    type: 'sans-serif',
  },
  system: {
    name: '시스템 기본',
    css: '-apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif',
    type: 'system',
  },
}

export const FONT_FAMILY_ORDER: FontFamily[] = [
  'kopub-batang',
  'ridi-batang',
  'noto-serif',
  'pretendard',
  'noto-sans',
  'system',
]

export const FONT_SIZE_MIN = 14
export const FONT_SIZE_MAX = 24
export const LINE_HEIGHT_MIN = 1.4
export const LINE_HEIGHT_MAX = 2.4
export const LINE_HEIGHT_STEP = 0.1
export const LEGACY_LINE_HEIGHTS: Record<string, number> = {
  compact: 1.5,
  normal: 1.8,
  wide: 2.2,
}
export const FONT_WEIGHTS: Record<FontWeight, number> = {
  normal: 400,
  medium: 500,
  bold: 600,
}

const STORAGE_KEY = 'reading-settings'

interface ReadingSettingsState {
  settings: ReadingSettings
  isLoading: boolean
  isSyncing: boolean
  lastSyncedAt: Date | null
  initialized: boolean
  updateSetting: <K extends keyof ReadingSettings>(
    key: K,
    value: ReadingSettings[K]
  ) => void
  updateSettings: (updates: Partial<ReadingSettings>) => void
  resetToDefaults: () => void
  adjustFontSize: (delta: number) => void
  migrateOldSettings: () => void
}

const readingSettingKeys: Array<keyof ReadingSettings> = [
  'theme',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'verseJoining',
  'showVerseNumbers',
  'tongdokAutoComplete',
  'showDescription',
  'showCrossRef',
  'highlightNames',
  'showFootnotes',
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolveLineHeight(value: unknown): number {
  if (typeof value === 'number') {
    return clamp(value, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX)
  }

  if (typeof value === 'string') {
    return LEGACY_LINE_HEIGHTS[value] ?? DEFAULT_SETTINGS.lineHeight
  }

  return DEFAULT_SETTINGS.lineHeight
}

function sanitizeSettings(candidate: unknown): Partial<ReadingSettings> {
  if (!isRecord(candidate)) return {}

  const sanitized: Partial<ReadingSettings> = {}

  for (const key of readingSettingKeys) {
    const value = candidate[key]
    if (value === undefined) continue

    switch (key) {
      case 'theme':
        if (value === 'light' || value === 'dark' || value === 'system') {
          sanitized.theme = value
        }
        break
      case 'fontFamily':
        if (typeof value === 'string' && value in FONT_FAMILIES) {
          sanitized.fontFamily = value as FontFamily
        }
        break
      case 'fontSize':
        if (typeof value === 'number') {
          sanitized.fontSize = clamp(value, FONT_SIZE_MIN, FONT_SIZE_MAX)
        }
        break
      case 'fontWeight':
        if (value === 'normal' || value === 'medium' || value === 'bold') {
          sanitized.fontWeight = value
        }
        break
      case 'lineHeight':
        sanitized.lineHeight = resolveLineHeight(value)
        break
      case 'textAlign':
        if (value === 'left' || value === 'justify') {
          sanitized.textAlign = value
        }
        break
      default:
        if (typeof value === 'boolean') {
          sanitized[key] = value
        }
        break
    }
  }

  return sanitized
}

export const readingSettingsSelectors = {
  fontFamilyCSS: (state: ReadingSettingsState): string =>
    FONT_FAMILIES[state.settings.fontFamily].css,

  fontWeightValue: (state: ReadingSettingsState): number =>
    FONT_WEIGHTS[state.settings.fontWeight],

  effectiveTheme: (state: ReadingSettingsState): 'light' | 'dark' => {
    const { theme } = state.settings
    if (theme !== 'system') return theme
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  },

  cssVariables: (state: ReadingSettingsState): Record<string, string> => ({
    '--reading-font-family': FONT_FAMILIES[state.settings.fontFamily].css,
    '--reading-font-size': `${state.settings.fontSize}px`,
    '--reading-font-weight': String(FONT_WEIGHTS[state.settings.fontWeight]),
    '--reading-line-height': String(state.settings.lineHeight),
    '--reading-text-align': state.settings.textAlign,
  }),
}

export const createReadingSettingsStore = createStoreFactory<ReadingSettingsState>(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_SETTINGS },
      isLoading: false,
      isSyncing: false,
      lastSyncedAt: null,
      initialized: false,

      updateSetting: (key, value) => {
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: key === 'lineHeight' ? resolveLineHeight(value) : value,
          },
        }))
      },

      updateSettings: (updates) => {
        const sanitized = sanitizeSettings(updates)
        set((state) => ({
          settings: {
            ...state.settings,
            ...sanitized,
          },
        }))
      },

      resetToDefaults: () => {
        set({ settings: { ...DEFAULT_SETTINGS } })
      },

      adjustFontSize: (delta) => {
        set((state) => ({
          settings: {
            ...state.settings,
            fontSize: clamp(
              state.settings.fontSize + delta,
              FONT_SIZE_MIN,
              FONT_SIZE_MAX
            ),
          },
        }))
      },

      migrateOldSettings: () => {
        if (typeof window === 'undefined') {
          set({ initialized: true })
          return
        }

        const legacyKeys = ['readingSettings', 'bible-reading-settings']
        const merged: Partial<ReadingSettings> = {}

        for (const key of legacyKeys) {
          const raw = window.localStorage.getItem(key)
          if (!raw) continue

          try {
            const parsed = JSON.parse(raw) as unknown
            Object.assign(merged, sanitizeSettings(parsed))
            window.localStorage.removeItem(key)
          } catch {
            window.localStorage.removeItem(key)
          }
        }

        if (Object.keys(merged).length > 0) {
          get().updateSettings(merged)
        }

        set({ initialized: true })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ settings: state.settings }),
      merge: (persistedState, currentState) => {
        const persisted = isRecord(persistedState)
          ? sanitizeSettings((persistedState as { settings?: unknown }).settings)
          : {}

        return {
          ...currentState,
          settings: {
            ...DEFAULT_SETTINGS,
            ...persisted,
          },
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.migrateOldSettings()
      },
    }
  ) as StateCreator<ReadingSettingsState>
)

export type { ReadingSettingsState }
