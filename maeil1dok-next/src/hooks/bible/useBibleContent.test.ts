// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useBibleContent } from './useBibleContent'

describe('useBibleContent smoke', () => {
  it('initializes with loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    const settings = {
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
    } as const

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'GAE', settings),
    )

    expect(result.current.isLoading).toBe(true)
  })
})
