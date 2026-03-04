import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Browser globals mock ──────────────────────────────────────────────
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k]
  }),
}

const styleSetProperty = vi.fn()
const setAttribute = vi.fn()
const querySelector: ReturnType<typeof vi.fn> = vi.fn(() => null)

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    matchMedia: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    localStorage: localStorageMock,
  })
  vi.stubGlobal('localStorage', localStorageMock)
  vi.stubGlobal('document', {
    documentElement: {
      style: { setProperty: styleSetProperty },
      setAttribute,
    },
    querySelector,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Lazy imports (so globals are stubbed before module evaluation) ────
async function importModule() {
  // Force fresh module on every call
  vi.resetModules()
  return import('../ReadingSettingsContext')
}

// ─────────────────────────────────────────────────────────────────────
// DEFAULT_SETTINGS
// ─────────────────────────────────────────────────────────────────────
describe('DEFAULT_SETTINGS', () => {
  it('has all required keys with correct defaults', async () => {
    const { DEFAULT_SETTINGS } = await importModule()
    expect(DEFAULT_SETTINGS).toEqual({
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
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// loadFromLocalStorage
// ─────────────────────────────────────────────────────────────────────
describe('loadFromLocalStorage', () => {
  it('returns defaults when no stored data', async () => {
    const { loadFromLocalStorage, DEFAULT_SETTINGS } = await importModule()
    expect(loadFromLocalStorage()).toEqual(DEFAULT_SETTINGS)
  })

  it('loads and merges stored settings', async () => {
    const { loadFromLocalStorage, STORAGE_KEY } = await importModule()
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({ fontSize: 20, theme: 'dark' }),
    )
    const result = loadFromLocalStorage()
    expect(result.fontSize).toBe(20)
    expect(result.theme).toBe('dark')
    // Other defaults preserved
    expect(result.fontFamily).toBe('kopub-batang')
  })

  it('migrates legacy string lineHeight to number', async () => {
    const { loadFromLocalStorage, STORAGE_KEY } = await importModule()
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify({ lineHeight: 'compact' }),
    )
    expect(loadFromLocalStorage().lineHeight).toBe(1.5)
  })

  it('handles corrupt JSON gracefully', async () => {
    const { loadFromLocalStorage, DEFAULT_SETTINGS, STORAGE_KEY } =
      await importModule()
    localStorageMock.setItem(STORAGE_KEY, '{invalid json')
    expect(loadFromLocalStorage()).toEqual(DEFAULT_SETTINGS)
  })
})

// ─────────────────────────────────────────────────────────────────────
// migrateOldSettings
// ─────────────────────────────────────────────────────────────────────
describe('migrateOldSettings', () => {
  it('migrates from old bible-reading-settings key', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem(
      'bible-reading-settings',
      JSON.stringify({ fontSize: 22, theme: 'dark' }),
    )
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.fontSize).toBe(22)
    expect(result.theme).toBe('dark')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('bible-reading-settings')
  })

  it('migrates old bibleViewOptions', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem(
      'bibleViewOptions',
      JSON.stringify({
        showDescription: false,
        showCrossRef: false,
        highlightNames: false,
        showFootnotes: true,
      }),
    )
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.showDescription).toBe(false)
    expect(result.showCrossRef).toBe(false)
    expect(result.highlightNames).toBe(false)
    expect(result.showFootnotes).toBe(true)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('bibleViewOptions')
  })

  it('migrates old bibleFontSize', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem('bibleFontSize', '18')
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.fontSize).toBe(18)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('bibleFontSize')
  })

  it('accepts minimum bibleFontSize 12', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem('bibleFontSize', '12')
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.fontSize).toBe(12)
  })

  it('rejects out-of-range bibleFontSize', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem('bibleFontSize', '50')
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.fontSize).toBe(DEFAULT_SETTINGS.fontSize) // unchanged
  })

  it('migrates legacy string lineHeight in bible-reading-settings', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    localStorageMock.setItem(
      'bible-reading-settings',
      JSON.stringify({ lineHeight: 'wide' }),
    )
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result.lineHeight).toBe(2.2)
  })

  it('saves migrated settings to new key', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS, STORAGE_KEY } =
      await importModule()
    localStorageMock.setItem('bibleFontSize', '20')
    migrateOldSettings({ ...DEFAULT_SETTINGS })
    // Should have called setItem with the new storage key
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    )
  })

  it('returns settings unchanged when no legacy data exists', async () => {
    const { migrateOldSettings, DEFAULT_SETTINGS } = await importModule()
    const result = migrateOldSettings({ ...DEFAULT_SETTINGS })
    expect(result).toEqual(DEFAULT_SETTINGS)
  })
})

// ─────────────────────────────────────────────────────────────────────
// saveToLocalStorage
// ─────────────────────────────────────────────────────────────────────
describe('saveToLocalStorage', () => {
  it('persists settings as JSON', async () => {
    const { saveToLocalStorage, DEFAULT_SETTINGS, STORAGE_KEY } =
      await importModule()
    saveToLocalStorage(DEFAULT_SETTINGS)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(DEFAULT_SETTINGS),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────
// computeEffectiveTheme
// ─────────────────────────────────────────────────────────────────────
describe('computeEffectiveTheme', () => {
  it('returns "light" for theme "light"', async () => {
    const { computeEffectiveTheme } = await importModule()
    expect(computeEffectiveTheme('light')).toBe('light')
  })

  it('returns "dark" for theme "dark"', async () => {
    const { computeEffectiveTheme } = await importModule()
    expect(computeEffectiveTheme('dark')).toBe('dark')
  })

  it('resolves "system" to "light" when prefers-color-scheme is light', async () => {
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: false,
    })
    const { computeEffectiveTheme } = await importModule()
    expect(computeEffectiveTheme('system')).toBe('light')
  })

  it('resolves "system" to "dark" when prefers-color-scheme is dark', async () => {
    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
    })
    const { computeEffectiveTheme } = await importModule()
    expect(computeEffectiveTheme('system')).toBe('dark')
  })
})

// ─────────────────────────────────────────────────────────────────────
// applyCSSVariables
// ─────────────────────────────────────────────────────────────────────
describe('applyCSSVariables', () => {
  it('sets all CSS custom properties on documentElement', async () => {
    const { applyCSSVariables, DEFAULT_SETTINGS, FONT_FAMILIES, FONT_WEIGHTS } =
      await importModule()
    applyCSSVariables(DEFAULT_SETTINGS)
    expect(styleSetProperty).toHaveBeenCalledWith(
      '--reading-font-family',
      FONT_FAMILIES['kopub-batang'].css,
    )
    expect(styleSetProperty).toHaveBeenCalledWith(
      '--reading-font-size',
      '16px',
    )
    expect(styleSetProperty).toHaveBeenCalledWith(
      '--reading-font-weight',
      String(FONT_WEIGHTS['medium']),
    )
    expect(styleSetProperty).toHaveBeenCalledWith(
      '--reading-line-height',
      '1.6',
    )
    expect(styleSetProperty).toHaveBeenCalledWith(
      '--reading-text-align',
      'left',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────
// applyTheme
// ─────────────────────────────────────────────────────────────────────
describe('applyTheme', () => {
  it('sets data-theme attribute to "light"', async () => {
    const { applyTheme } = await importModule()
    applyTheme('light')
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'light')
  })

  it('sets data-theme attribute to "dark"', async () => {
    const { applyTheme } = await importModule()
    applyTheme('dark')
    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
  })

  it('updates meta theme-color when element exists', async () => {
    const metaSetAttribute = vi.fn()
    querySelector.mockReturnValue({ setAttribute: metaSetAttribute } as unknown as Element)
    const { applyTheme } = await importModule()
    applyTheme('dark')
    expect(metaSetAttribute).toHaveBeenCalledWith('content', '#1a1a1a')
    applyTheme('light')
    expect(metaSetAttribute).toHaveBeenCalledWith('content', '#faf8f6')
  })
})

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────
describe('Constants', () => {
  it('FONT_FAMILIES covers all font family options', async () => {
    const { FONT_FAMILIES } = await importModule()
    expect(Object.keys(FONT_FAMILIES)).toEqual(
      expect.arrayContaining([
        'kopub-batang',
        'ridi-batang',
        'noto-serif',
        'pretendard',
        'noto-sans',
        'system',
      ]),
    )
    // Each has css property
    for (const val of Object.values(FONT_FAMILIES)) {
      expect(val).toHaveProperty('css')
      expect(val).toHaveProperty('name')
    }
  })

  it('FONT_WEIGHTS maps string keys to numeric values', async () => {
    const { FONT_WEIGHTS } = await importModule()
    expect(FONT_WEIGHTS).toEqual({ normal: 400, medium: 500, bold: 600 })
  })

  it('LEGACY_LINE_HEIGHTS maps old strings to numbers', async () => {
    const { LEGACY_LINE_HEIGHTS } = await importModule()
    expect(LEGACY_LINE_HEIGHTS).toEqual({
      compact: 1.5,
      normal: 1.8,
      wide: 2.2,
    })
  })

  it('STORAGE_KEY is "readingSettings"', async () => {
    const { STORAGE_KEY } = await importModule()
    expect(STORAGE_KEY).toBe('readingSettings')
  })
})

// ─────────────────────────────────────────────────────────────────────
// settingsToSnakeCase / mergeServerSettings (Supabase helpers)
// ─────────────────────────────────────────────────────────────────────
describe('Supabase helpers', () => {
  it('settingsToSnakeCase converts camelCase to snake_case', async () => {
    const { settingsToSnakeCase, DEFAULT_SETTINGS } = await importModule()
    const result = settingsToSnakeCase(DEFAULT_SETTINGS)
    expect(result).toEqual({
      theme: 'light',
      font_family: 'kopub-batang',
      font_size: 16,
      font_weight: 'medium',
      line_height: 1.6,
      text_align: 'left',
      verse_joining: false,
      show_verse_numbers: true,
      tongdok_auto_complete: false,
      show_description: true,
      show_cross_ref: true,
      highlight_names: true,
      show_footnotes: false,
    })
  })

  it('mergeServerSettings merges server data with local settings', async () => {
    const { mergeServerSettings, DEFAULT_SETTINGS } = await importModule()
    const server = {
      theme: 'dark',
      font_size: 20,
      verse_joining: true,
      show_footnotes: true,
    }
    const result = mergeServerSettings(DEFAULT_SETTINGS, server)
    expect(result.theme).toBe('dark')
    expect(result.fontSize).toBe(20)
    expect(result.verseJoining).toBe(true)
    expect(result.showFootnotes).toBe(true)
    // Unset fields keep local values
    expect(result.fontFamily).toBe('kopub-batang')
    expect(result.lineHeight).toBe(1.6)
  })

  it('mergeServerSettings migrates legacy string lineHeight from server', async () => {
    const { mergeServerSettings, DEFAULT_SETTINGS } = await importModule()
    const server = { line_height: 'normal' }
    const result = mergeServerSettings(DEFAULT_SETTINGS, server)
    expect(result.lineHeight).toBe(1.8)
  })
})
