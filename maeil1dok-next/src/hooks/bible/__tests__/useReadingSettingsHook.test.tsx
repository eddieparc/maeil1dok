import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  ReadingSettingsContext,
  type ReadingSettingsContextValue,
} from '../ReadingSettingsContext'
import { useReadingSettings } from '../useReadingSettings'

function createContextValue(
  overrides: Partial<ReadingSettingsContextValue> = {},
): ReadingSettingsContextValue {
  return {
    settings: { ...DEFAULT_SETTINGS },
    updateSetting: vi.fn(),
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    effectiveTheme: 'light',
    isLoading: false,
    isSyncing: false,
    ...overrides,
  }
}

describe('useReadingSettings hook', () => {
  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useReadingSettings())).toThrow(
      'useReadingSettings must be used within a ReadingSettingsProvider',
    )
  })

  it('returns context with computed cssVariables', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReadingSettingsContext.Provider
        value={createContextValue({
          settings: {
            ...DEFAULT_SETTINGS,
            fontFamily: 'pretendard',
            fontSize: 20,
            fontWeight: 'bold',
            lineHeight: 2.1,
            textAlign: 'justify',
          },
        })}
      >
        {children}
      </ReadingSettingsContext.Provider>
    )

    const { result } = renderHook(() => useReadingSettings(), { wrapper })

    expect(result.current.cssVariables).toEqual({
      '--reading-font-family': '"Pretendard", sans-serif',
      '--reading-font-size': '20px',
      '--reading-font-weight': '600',
      '--reading-line-height': '2.1',
      '--reading-text-align': 'justify',
    })
  })

  it('invokes onSettingsChange callback with latest settings', () => {
    const onSettingsChange = vi.fn()
    const settings = { ...DEFAULT_SETTINGS, fontSize: 22 }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ReadingSettingsContext.Provider
        value={createContextValue({ settings })}
      >
        {children}
      </ReadingSettingsContext.Provider>
    )

    renderHook(
      () => useReadingSettings({ onSettingsChange }),
      { wrapper },
    )

    expect(onSettingsChange).toHaveBeenCalledWith(settings)
  })
})
