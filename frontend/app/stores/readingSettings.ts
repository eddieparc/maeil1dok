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

// Debounce timeout reference
let syncTimeout: NodeJS.Timeout | null = null

export const useReadingSettingsStore = defineStore('readingSettings', {
  state: (): ReadingSettingsState => ({
    settings: { ...DEFAULT_SETTINGS },
    isLoading: false,
    isSyncing: false,
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
        // Migrate old viewOptions
        const oldViewOptions = localStorage.getItem(OLD_VIEW_OPTIONS_KEY)
        if (oldViewOptions) {
          const parsed = JSON.parse(oldViewOptions)
          if (parsed.showDescription !== undefined) this.settings.showDescription = parsed.showDescription
          if (parsed.showCrossRef !== undefined) this.settings.showCrossRef = parsed.showCrossRef
          if (parsed.highlightNames !== undefined) this.settings.highlightNames = parsed.highlightNames
          if (parsed.showFootnotes !== undefined) this.settings.showFootnotes = parsed.showFootnotes
          localStorage.removeItem(OLD_VIEW_OPTIONS_KEY)
        }

        // Migrate old fontSize
        const oldFontSize = localStorage.getItem(OLD_FONT_SIZE_KEY)
        if (oldFontSize) {
          const size = parseInt(oldFontSize, 10)
          if (!isNaN(size) && size >= 14 && size <= 24) {
            this.settings.fontSize = size
          }
          localStorage.removeItem(OLD_FONT_SIZE_KEY)
        }

        this.saveToLocalStorage()
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
      if (!auth.isAuthenticated.value) return

      this.isLoading = true
      try {
        const api = useApi()
        const response = await api.get('/api/v1/accounts/reading-settings/')

        if (response.data?.success && response.data.settings) {
          const serverSettings = response.data.settings
          // lineHeight 변환: 문자열이면 숫자로 변환
          let lineHeight = serverSettings.line_height || this.settings.lineHeight
          if (typeof lineHeight === 'string' && LEGACY_LINE_HEIGHTS[lineHeight]) {
            lineHeight = LEGACY_LINE_HEIGHTS[lineHeight]
          }
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
          }
          this.saveToLocalStorage()
          this.lastSyncedAt = new Date()
        }
      } catch (e) {
        console.warn('Failed to sync reading settings from server:', e)
      } finally {
        this.isLoading = false
      }
    },

    // Sync to server (debounced, called after setting changes)
    async syncToServer() {
      const auth = useAuthService()
      if (!auth.isAuthenticated.value) return

      this.isSyncing = true
      try {
        const api = useApi()
        await api.patch('/api/v1/accounts/reading-settings/update/', {
          theme: this.settings.theme,
          font_family: this.settings.fontFamily,
          font_size: this.settings.fontSize,
          font_weight: this.settings.fontWeight,
          line_height: this.settings.lineHeight,
          text_align: this.settings.textAlign,
          verse_joining: this.settings.verseJoining,
          show_verse_numbers: this.settings.showVerseNumbers,
          tongdok_auto_complete: this.settings.tongdokAutoComplete,
          show_description: this.settings.showDescription,
          show_cross_ref: this.settings.showCrossRef,
          highlight_names: this.settings.highlightNames,
          show_footnotes: this.settings.showFootnotes,
        })
        this.lastSyncedAt = new Date()
      } catch (e) {
        console.warn('Failed to sync reading settings to server:', e)
      } finally {
        this.isSyncing = false
      }
    },

    // Update a single setting
    updateSetting<K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) {
      this.settings[key] = value
      this.saveToLocalStorage()

      if (key === 'theme') {
        this.applyTheme()
      }

      // Debounced sync to server (500ms)
      this.debouncedSync()
    },

    // Update multiple settings at once
    updateSettings(updates: Partial<ReadingSettings>) {
      Object.assign(this.settings, updates)
      this.saveToLocalStorage()

      if ('theme' in updates) {
        this.applyTheme()
      }

      this.debouncedSync()
    },

    // Debounced server sync (500ms)
    debouncedSync() {
      if (syncTimeout) {
        clearTimeout(syncTimeout)
      }
      syncTimeout = setTimeout(() => {
        this.syncToServer()
      }, 500)
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
