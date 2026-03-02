'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Type definitions ─────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily =
  | 'ridi-batang'
  | 'noto-serif'
  | 'kopub-batang'
  | 'pretendard'
  | 'noto-sans'
  | 'system'
export type FontWeight = 'normal' | 'medium' | 'bold'
export type TextAlign = 'left' | 'justify'

export interface ReadingSettings {
  theme: ThemeMode
  fontFamily: FontFamily
  fontSize: number
  fontWeight: FontWeight
  lineHeight: number
  textAlign: TextAlign
  verseJoining: boolean
  showVerseNumbers: boolean
  tongdokAutoComplete: boolean
  showDescription: boolean
  showCrossRef: boolean
  highlightNames: boolean
  showFootnotes: boolean
}

export interface ReadingSettingsContextValue {
  settings: ReadingSettings
  updateSetting: <K extends keyof ReadingSettings>(
    key: K,
    value: ReadingSettings[K],
  ) => void
  updateSettings: (updates: Partial<ReadingSettings>) => void
  resetSettings: () => void
  effectiveTheme: 'light' | 'dark'
  isLoading: boolean
  isSyncing: boolean
}

// ── Constants ────────────────────────────────────────────────────────
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

export const STORAGE_KEY = 'bible-reading-settings'
const OLD_VIEW_OPTIONS_KEY = 'bibleViewOptions'
const OLD_FONT_SIZE_KEY = 'bibleFontSize'
const OLD_READING_SETTINGS_KEY = 'readingSettings'

export const LEGACY_LINE_HEIGHTS: Record<string, number> = {
  compact: 1.5,
  normal: 1.8,
  wide: 2.2,
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
  'ridi-batang': {
    name: 'RIDI 바탕',
    css: '"RIDIBatang", serif',
    type: 'serif',
  },
  'noto-serif': {
    name: 'Noto Serif KR',
    css: '"Noto Serif KR", serif',
    type: 'serif',
  },
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

export const LINE_HEIGHT_MIN = 1.4
export const LINE_HEIGHT_MAX = 2.4
export const LINE_HEIGHT_STEP = 0.1

export const FONT_WEIGHTS: Record<FontWeight, number> = {
  normal: 400,
  medium: 500,
  bold: 600,
}

// ── Pure helper functions (exported for testing) ─────────────────────

export function loadFromLocalStorage(): ReadingSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        typeof parsed.lineHeight === 'string' &&
        LEGACY_LINE_HEIGHTS[parsed.lineHeight]
      ) {
        parsed.lineHeight = LEGACY_LINE_HEIGHTS[parsed.lineHeight]
      }
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    console.warn('Failed to load reading settings from localStorage')
  }

  return { ...DEFAULT_SETTINGS }
}

export function migrateOldSettings(settings: ReadingSettings): ReadingSettings {
  if (typeof window === 'undefined') return settings

  let migrated = { ...settings }
  let didMigrate = false

  try {
    // Migrate from old Nuxt/Pinia key
    const oldSettings = localStorage.getItem(OLD_READING_SETTINGS_KEY)
    if (oldSettings) {
      const parsed = JSON.parse(oldSettings)
      if (
        typeof parsed.lineHeight === 'string' &&
        LEGACY_LINE_HEIGHTS[parsed.lineHeight]
      ) {
        parsed.lineHeight = LEGACY_LINE_HEIGHTS[parsed.lineHeight]
      }
      migrated = { ...DEFAULT_SETTINGS, ...parsed }
      localStorage.removeItem(OLD_READING_SETTINGS_KEY)
      didMigrate = true
    }

    // Migrate old viewOptions
    const oldViewOptions = localStorage.getItem(OLD_VIEW_OPTIONS_KEY)
    if (oldViewOptions) {
      const parsed = JSON.parse(oldViewOptions)
      if (parsed.showDescription !== undefined)
        migrated.showDescription = parsed.showDescription
      if (parsed.showCrossRef !== undefined)
        migrated.showCrossRef = parsed.showCrossRef
      if (parsed.highlightNames !== undefined)
        migrated.highlightNames = parsed.highlightNames
      if (parsed.showFootnotes !== undefined)
        migrated.showFootnotes = parsed.showFootnotes
      localStorage.removeItem(OLD_VIEW_OPTIONS_KEY)
      didMigrate = true
    }

    // Migrate old fontSize
    const oldFontSize = localStorage.getItem(OLD_FONT_SIZE_KEY)
    if (oldFontSize) {
      const size = parseInt(oldFontSize, 10)
      if (!isNaN(size) && size >= 14 && size <= 24) {
        migrated.fontSize = size
      }
      localStorage.removeItem(OLD_FONT_SIZE_KEY)
      didMigrate = true
    }

    if (didMigrate) {
      saveToLocalStorage(migrated)
    }
  } catch {
    console.warn('Failed to migrate old settings')
  }

  return migrated
}

export function saveToLocalStorage(settings: ReadingSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    console.warn('Failed to save reading settings to localStorage')
  }
}

export function computeEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return 'light'
  }
  return theme
}

export function applyCSSVariables(settings: ReadingSettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty(
    '--reading-font-family',
    FONT_FAMILIES[settings.fontFamily].css,
  )
  root.style.setProperty('--reading-font-size', `${settings.fontSize}px`)
  root.style.setProperty(
    '--reading-font-weight',
    String(FONT_WEIGHTS[settings.fontWeight]),
  )
  root.style.setProperty('--reading-line-height', String(settings.lineHeight))
  root.style.setProperty('--reading-text-align', settings.textAlign)
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#1a1a1a' : '#faf8f6',
    )
  }
}

// ── Supabase sync helpers (exported for testing) ─────────────────────

export function settingsToSnakeCase(settings: ReadingSettings) {
  return {
    theme: settings.theme,
    font_family: settings.fontFamily,
    font_size: settings.fontSize,
    font_weight: settings.fontWeight,
    line_height: settings.lineHeight,
    text_align: settings.textAlign,
    verse_joining: settings.verseJoining,
    show_verse_numbers: settings.showVerseNumbers,
    tongdok_auto_complete: settings.tongdokAutoComplete,
    show_description: settings.showDescription,
    show_cross_ref: settings.showCrossRef,
    highlight_names: settings.highlightNames,
    show_footnotes: settings.showFootnotes,
  }
}

export function mergeServerSettings(
  local: ReadingSettings,
  server: Record<string, unknown>,
): ReadingSettings {
  let lineHeight = (server.line_height as number) || local.lineHeight
  if (
    typeof lineHeight === 'string' &&
    LEGACY_LINE_HEIGHTS[lineHeight as string]
  ) {
    lineHeight = LEGACY_LINE_HEIGHTS[lineHeight as string]
  }
  return {
    ...local,
    theme: (server.theme as ThemeMode) || local.theme,
    fontFamily: (server.font_family as FontFamily) || local.fontFamily,
    fontSize: (server.font_size as number) || local.fontSize,
    fontWeight: (server.font_weight as FontWeight) || local.fontWeight,
    lineHeight,
    textAlign: (server.text_align as TextAlign) || local.textAlign,
    verseJoining: (server.verse_joining as boolean) ?? local.verseJoining,
    showVerseNumbers:
      (server.show_verse_numbers as boolean) ?? local.showVerseNumbers,
    tongdokAutoComplete:
      (server.tongdok_auto_complete as boolean) ?? local.tongdokAutoComplete,
    showDescription:
      (server.show_description as boolean) ?? local.showDescription,
    showCrossRef: (server.show_cross_ref as boolean) ?? local.showCrossRef,
    highlightNames:
      (server.highlight_names as boolean) ?? local.highlightNames,
    showFootnotes: (server.show_footnotes as boolean) ?? local.showFootnotes,
  }
}

// ── Context ──────────────────────────────────────────────────────────

export const ReadingSettingsContext =
  createContext<ReadingSettingsContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────

export function ReadingSettingsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [settings, setSettings] = useState<ReadingSettings>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
    const loaded = loadFromLocalStorage()
    return migrateOldSettings(loaded)
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [systemDark, setSystemDark] = useState(false)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedRef = useRef(false)

  // Track system color scheme
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Compute effective theme
  const effectiveTheme = useMemo<'light' | 'dark'>(() => {
    if (settings.theme === 'system') return systemDark ? 'dark' : 'light'
    return settings.theme
  }, [settings.theme, systemDark])

  // Apply CSS variables when settings change
  useEffect(() => {
    applyCSSVariables(settings)
  }, [
    settings.fontFamily,
    settings.fontSize,
    settings.fontWeight,
    settings.lineHeight,
    settings.textAlign,
    // Include settings for the effect dependency, but only the typography fields trigger it
    settings,
  ])

  // Apply theme to document
  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  // Sync from Supabase on mount (authenticated users only)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    async function syncFromServer() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('user_reading_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error || !data) return

        const merged = mergeServerSettings(settings, data)
        setSettings(merged)
        saveToLocalStorage(merged)
      } catch {
        console.warn('Failed to sync reading settings from server')
      } finally {
        setIsLoading(false)
      }
    }

    syncFromServer()
  }, [settings])

  // Debounced sync to Supabase
  const syncToServer = useCallback(
    async (settingsToSync: ReadingSettings) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setIsSyncing(true)
      try {
        await supabase.from('user_reading_settings').upsert({
          user_id: user.id,
          ...settingsToSnakeCase(settingsToSync),
        })
      } catch {
        console.warn('Failed to sync reading settings to server')
      } finally {
        setIsSyncing(false)
      }
    },
    [],
  )

  const debouncedSync = useCallback(
    (settingsToSync: ReadingSettings) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      syncTimeoutRef.current = setTimeout(() => {
        syncToServer(settingsToSync)
      }, 500)
    },
    [syncToServer],
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  const updateSetting = useCallback(
    <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        saveToLocalStorage(next)
        debouncedSync(next)
        return next
      })
    },
    [debouncedSync],
  )

  const updateSettings = useCallback(
    (updates: Partial<ReadingSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...updates }
        saveToLocalStorage(next)
        debouncedSync(next)
        return next
      })
    },
    [debouncedSync],
  )

  const resetSettings = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS }
    setSettings(defaults)
    saveToLocalStorage(defaults)
    debouncedSync(defaults)
  }, [debouncedSync])

  const value = useMemo<ReadingSettingsContextValue>(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
      effectiveTheme,
      isLoading,
      isSyncing,
    }),
    [
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
      effectiveTheme,
      isLoading,
      isSyncing,
    ],
  )

  return (
    <ReadingSettingsContext.Provider value={value}>
      {children}
    </ReadingSettingsContext.Provider>
  )
}
