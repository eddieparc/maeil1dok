import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'

// Type definitions
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily = 'ridi-batang' | 'noto-serif' | 'kopub-batang' | 'pretendard' | 'noto-sans' | 'system'
export type FontWeight = 'normal' | 'medium' | 'bold'
// LineHeight는 이제 숫자형 (1.4 ~ 2.4 범위)
export type LineHeight = number
export type TextAlign = 'left' | 'justify'

export interface ReadingSettings {
  // Theme
  theme: ThemeMode

  // Typography
  fontFamily: FontFamily
  fontSize: number
  fontWeight: FontWeight
  lineHeight: LineHeight
  textAlign: TextAlign

  // Verse display options
  verseJoining: boolean
  showVerseNumbers: boolean

  // Behavior settings
  tongdokAutoComplete: boolean

  // View options (existing, migrated from localStorage)
  showDescription: boolean
  showCrossRef: boolean
  highlightNames: boolean
  showFootnotes: boolean
}

interface ReadingSettingsState {
  settings: ReadingSettings
  isLoading: boolean
  isSyncing: boolean
  syncError: string | null
  lastSyncedAt: Date | null
  initialized: boolean
}

// Default settings
const DEFAULT_SETTINGS: ReadingSettings = {
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

// Font family mappings
export const FONT_FAMILIES: Record<FontFamily, { name: string; css: string; type: 'serif' | 'sans-serif' | 'system' }> = {
  'kopub-batang': { name: 'KoPub 바탕', css: '"KoPub Batang", serif', type: 'serif' },
  'ridi-batang': { name: 'RIDI 바탕', css: '"RIDIBatang", serif', type: 'serif' },
  'noto-serif': { name: 'Noto Serif KR', css: '"Noto Serif KR", serif', type: 'serif' },
  'pretendard': { name: 'Pretendard', css: '"Pretendard", sans-serif', type: 'sans-serif' },
  'noto-sans': { name: 'Noto Sans KR', css: '"Noto Sans KR", sans-serif', type: 'sans-serif' },
  'system': { name: '시스템 기본', css: '-apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif', type: 'system' },
}

// Font families in display order
export const FONT_FAMILY_ORDER: FontFamily[] = [
  'kopub-batang',
  'ridi-batang', 
  'noto-serif',
  'pretendard',
  'noto-sans',
  'system',
]

// Line height 범위 상수
export const LINE_HEIGHT_MIN = 1.4
export const LINE_HEIGHT_MAX = 2.4
export const LINE_HEIGHT_STEP = 0.1

// 기존 문자열 값을 숫자로 변환하는 맵 (마이그레이션용)
export const LEGACY_LINE_HEIGHTS: Record<string, number> = {
  compact: 1.5,
  normal: 1.8,
  wide: 2.2,
}

// Font weight mappings
export const FONT_WEIGHTS: Record<FontWeight, number> = {
  normal: 400,
  medium: 500,
  bold: 600,
}

const STORAGE_KEY = 'readingSettings'
const OLD_VIEW_OPTIONS_KEY = 'bibleViewOptions'
const OLD_FONT_SIZE_KEY = 'bibleFontSize'

// Timers and pending user edits belong to a store instance, not the module/SSR request.
interface SettingsSync {
  timer: ReturnType<typeof setTimeout> | null
  pending: Partial<ReadingSettings>
  serverLoaded: boolean
}
const syncStates = new WeakMap<object, SettingsSync>()
const syncState = (store: object): SettingsSync => {
  let state = syncStates.get(store)
  if (!state) {
    state = { timer: null, pending: {}, serverLoaded: false }
    syncStates.set(store, state)
  }
  return state
}

export const useReadingSettingsStore = defineStore('readingSettings', {
  state: (): ReadingSettingsState => ({
    settings: { ...DEFAULT_SETTINGS },
    isLoading: false,
    isSyncing: false,
    syncError: null,
    lastSyncedAt: null,
    initialized: false,
  }),

  getters: {
    // Computed CSS values
    fontFamilyCSS: (state): string => FONT_FAMILIES[state.settings.fontFamily].css,
    lineHeightValue: (state): number => state.settings.lineHeight,
    fontWeightValue: (state): number => FONT_WEIGHTS[state.settings.fontWeight],

    // Effective theme (resolves 'system' to actual theme)
    effectiveTheme: (state): 'light' | 'dark' => {
      if (state.settings.theme === 'system') {
        if (typeof window !== 'undefined') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        return 'light'
      }
      return state.settings.theme
    },

    // CSS custom properties object for inline styles
    cssVariables: (state) => ({
      '--reading-font-family': FONT_FAMILIES[state.settings.fontFamily].css,
      '--reading-font-size': `${state.settings.fontSize}px`,
      '--reading-font-weight': FONT_WEIGHTS[state.settings.fontWeight],
      '--reading-line-height': state.settings.lineHeight,
      '--reading-text-align': state.settings.textAlign,
    }),
  },

  actions: {
    async initialize() {
      if (this.initialized) return

      this.loadFromLocalStorage()
      this.migrateOldSettings()
      this.applyTheme()
      this.setupSystemThemeListener()
      this.initialized = true

      const auth = useAuthService()
      if (auth.isAuthenticated.value) {
        await this.syncFromServer()
        this.applyTheme()
      }
    },

    async onLogin() {
      await this.syncFromServer()
      this.applyTheme()
    },

    // Load from localStorage
    loadFromLocalStorage() {
      if (typeof window === 'undefined') return

      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          // 기존 문자열 lineHeight를 숫자로 변환
          if (typeof parsed.lineHeight === 'string' && LEGACY_LINE_HEIGHTS[parsed.lineHeight]) {
            parsed.lineHeight = LEGACY_LINE_HEIGHTS[parsed.lineHeight]
          }
          this.settings = { ...DEFAULT_SETTINGS, ...parsed }
        }
      } catch (e) {
        console.warn('Failed to load reading settings from localStorage:', e)
      }
    },

    // Migrate old settings from previous localStorage keys
    migrateOldSettings() {
      if (typeof window === 'undefined') return

      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        let migrated = false
        // Only migrate fields absent from the current saved preferences.
        const oldViewOptions = localStorage.getItem(OLD_VIEW_OPTIONS_KEY)
        if (oldViewOptions) {
          const parsed = JSON.parse(oldViewOptions)
          if (saved.showDescription === undefined && parsed.showDescription !== undefined) {
            this.settings.showDescription = parsed.showDescription
            migrated = true
          }
          if (saved.showCrossRef === undefined && parsed.showCrossRef !== undefined) {
            this.settings.showCrossRef = parsed.showCrossRef
            migrated = true
          }
          if (saved.highlightNames === undefined && parsed.highlightNames !== undefined) {
            this.settings.highlightNames = parsed.highlightNames
            migrated = true
          }
          if (saved.showFootnotes === undefined && parsed.showFootnotes !== undefined) {
            this.settings.showFootnotes = parsed.showFootnotes
            migrated = true
          }
          localStorage.removeItem(OLD_VIEW_OPTIONS_KEY)
        }

        // Migrate old fontSize
        const oldFontSize = localStorage.getItem(OLD_FONT_SIZE_KEY)
        if (oldFontSize) {
          const size = parseInt(oldFontSize, 10)
          if (saved.fontSize === undefined && !isNaN(size) && size >= 14 && size <= 24) {
            this.settings.fontSize = size
            migrated = true
          }
          localStorage.removeItem(OLD_FONT_SIZE_KEY)
        }

        if (migrated) this.saveToLocalStorage()
      } catch (e) {
        console.warn('Failed to migrate old settings:', e)
      }
    },

    // Save to localStorage
    saveToLocalStorage() {
      if (typeof window === 'undefined') return

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
      } catch (e) {
        console.warn('Failed to save reading settings to localStorage:', e)
      }
    },

    // Sync from server (authenticated users)
    async syncFromServer() {
      const auth = useAuthService()
      if (!auth.isAuthenticated.value || this.isLoading) return

      this.isLoading = true
      try {
        const api = useApi()
        const response = await api.GET('/api/v1/auth/reading-settings/')

        if (response.data.success && response.data.data.settings) {
          const serverSettings = response.data.data.settings
          const lineHeight = serverSettings.line_height || this.settings.lineHeight
          // Merge server settings (snake_case from backend)
          this.settings = {
            ...this.settings,
            theme: serverSettings.theme || this.settings.theme,
            fontFamily: serverSettings.font_family || this.settings.fontFamily,
            fontSize: serverSettings.font_size || this.settings.fontSize,
            fontWeight: serverSettings.font_weight || this.settings.fontWeight,
            lineHeight: lineHeight,
            textAlign: serverSettings.text_align || this.settings.textAlign,
            verseJoining: serverSettings.verse_joining ?? this.settings.verseJoining,
            showVerseNumbers: serverSettings.show_verse_numbers ?? this.settings.showVerseNumbers,
            tongdokAutoComplete: serverSettings.tongdok_auto_complete ?? this.settings.tongdokAutoComplete,
            showDescription: serverSettings.show_description ?? this.settings.showDescription,
            showCrossRef: serverSettings.show_cross_ref ?? this.settings.showCrossRef,
            highlightNames: serverSettings.highlight_names ?? this.settings.highlightNames,
            showFootnotes: serverSettings.show_footnotes ?? this.settings.showFootnotes,
            ...syncState(this).pending,
          }
          syncState(this).serverLoaded = true
          this.syncError = null
          this.saveToLocalStorage()
          this.lastSyncedAt = new Date()
        } else {
          throw new Error('Reading settings were not returned by the server')
        }
      } catch (e) {
        this.syncError = '설정을 불러오지 못했습니다. 다시 시도해주세요.'
        console.warn('Failed to sync reading settings from server:', e)
      } finally {
        this.isLoading = false
        if (syncState(this).serverLoaded && Object.keys(syncState(this).pending).length) this.debouncedSync()
      }
    },

    // Sync to server (debounced, called after setting changes)
    async syncToServer() {
      const auth = useAuthService()
      if (!auth.isAuthenticated.value || this.isLoading || this.isSyncing) return
      const state = syncState(this)
      // A pending edit must not send untouched defaults before the user's GET completes.
      if (!state.serverLoaded) await this.syncFromServer()
      if (!state.serverLoaded) return
      if (state.timer) clearTimeout(state.timer)
      state.timer = null
      const snapshot = { ...this.settings }
      this.isSyncing = true
      this.syncError = null
      try {
        const api = useApi()
        const response = await api.PATCH('/api/v1/auth/reading-settings/update/', {
          theme: snapshot.theme,
          font_family: snapshot.fontFamily,
          font_size: snapshot.fontSize,
          font_weight: snapshot.fontWeight,
          line_height: snapshot.lineHeight,
          text_align: snapshot.textAlign,
          verse_joining: snapshot.verseJoining,
          show_verse_numbers: snapshot.showVerseNumbers,
          tongdok_auto_complete: snapshot.tongdokAutoComplete,
          show_description: snapshot.showDescription,
          show_cross_ref: snapshot.showCrossRef,
          highlight_names: snapshot.highlightNames,
          show_footnotes: snapshot.showFootnotes,
        })
        if (!response.success) throw new Error('Reading settings persistence failed')
        this.lastSyncedAt = new Date()
        for (const key of Object.keys(state.pending) as Array<keyof ReadingSettings>) {
          if (state.pending[key] === snapshot[key]) delete state.pending[key]
        }
      } catch (e) {
        this.syncError = '설정을 서버에 저장하지 못했습니다. 이 기기의 변경사항은 유지됩니다.'
        console.warn('Failed to sync reading settings to server:', e)
      } finally {
        this.isSyncing = false
        // Serialize writes; a later user edit must finish after the in-flight snapshot.
        if (Object.keys(state.pending).some(key => this.settings[key as keyof ReadingSettings] !== snapshot[key as keyof ReadingSettings])) this.debouncedSync()
      }
    },

    // Update a single setting
    updateSetting<K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) {
      this.settings[key] = value
      Object.assign(syncState(this).pending, { [key]: value })
      this.saveToLocalStorage()

      if (key === 'theme') {
        this.applyTheme()
      }

      // Debounced sync to server (400ms)
      this.debouncedSync()
    },

    // Update multiple settings at once
    updateSettings(updates: Partial<ReadingSettings>) {
      Object.assign(this.settings, updates)
      Object.assign(syncState(this).pending, updates)
      this.saveToLocalStorage()

      if ('theme' in updates) {
        this.applyTheme()
      }

      this.debouncedSync()
    },

    // Keep local recovery immediate; debounce remote persistence by 400ms.
    debouncedSync() {
      const state = syncState(this)
      if (state.timer) clearTimeout(state.timer)
      state.timer = setTimeout(() => {
        state.timer = null
        void this.syncToServer()
      }, 400)
    },

    // Apply theme to document
    applyTheme() {
      if (typeof window === 'undefined') return

      const theme = this.effectiveTheme
      document.documentElement.setAttribute('data-theme', theme)

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#faf8f6')
      }
    },

    // Listen for system theme changes
    setupSystemThemeListener() {
      if (typeof window === 'undefined') return

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', () => {
        if (this.settings.theme === 'system') {
          this.applyTheme()
        }
      })
    },

    // Reset to defaults
    resetToDefaults() {
      this.settings = { ...DEFAULT_SETTINGS }
      syncState(this).pending = { ...DEFAULT_SETTINGS }
      this.saveToLocalStorage()
      this.applyTheme()
      this.debouncedSync()
    },

    // Adjust font size by delta
    adjustFontSize(delta: number) {
      const newSize = this.settings.fontSize + delta
      if (newSize >= 14 && newSize <= 24) {
        this.updateSetting('fontSize', newSize)
      }
    },
  },
})
