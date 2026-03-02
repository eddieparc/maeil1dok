// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useBiblePageState } from '../useBiblePageState'

describe('useBiblePageState', () => {
  it('uses default state values', () => {
    const { result } = renderHook(() => useBiblePageState())

    expect(result.current.viewMode).toBe('home')
    expect(result.current.currentBook).toBe('gen')
    expect(result.current.currentChapter).toBe(1)
    expect(result.current.currentVersion).toBe('GAE')
  })

  it('changes view mode with setViewMode', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.setViewMode('toc')
    })
    expect(result.current.viewMode).toBe('toc')

    act(() => {
      result.current.setViewMode('reader')
    })
    expect(result.current.viewMode).toBe('reader')
  })

  it('handles cross-book next navigation (gen:50 -> exo:1)', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('gen')
    })
    act(() => {
      result.current.selectChapter(50)
    })
    act(() => {
      result.current.goToNextChapter()
    })

    expect(result.current.currentBook).toBe('exo')
    expect(result.current.currentChapter).toBe(1)
  })

  it('handles cross-book previous navigation (exo:1 -> gen:50)', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('exo')
    })
    act(() => {
      result.current.selectChapter(1)
    })
    act(() => {
      result.current.goToPrevChapter()
    })

    expect(result.current.currentBook).toBe('gen')
    expect(result.current.currentChapter).toBe(50)
  })

  it('does nothing on previous from first book first chapter', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('gen')
    })
    act(() => {
      result.current.selectChapter(1)
    })
    act(() => {
      result.current.goToPrevChapter()
    })

    expect(result.current.currentBook).toBe('gen')
    expect(result.current.currentChapter).toBe(1)
  })

  it('does nothing on next from last book last chapter', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('rev')
    })
    act(() => {
      result.current.selectChapter(22)
    })
    act(() => {
      result.current.goToNextChapter()
    })

    expect(result.current.currentBook).toBe('rev')
    expect(result.current.currentChapter).toBe(22)
  })

  it('returns chapter suffix as 편 only for psa', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('psa')
    })
    expect(result.current.chapterSuffix).toBe('편')

    act(() => {
      result.current.selectBook('gen')
    })
    expect(result.current.chapterSuffix).toBe('장')
  })

  it('parses deep link params with initFromQuery', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.initFromQuery({ book: 'jhn', chapter: '3', version: 'KNT' })
    })

    expect(result.current.currentBook).toBe('jhn')
    expect(result.current.currentChapter).toBe(3)
    expect(result.current.currentVersion).toBe('KNT')
  })

  it('keeps defaults for invalid deep link values', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.initFromQuery({ book: 'invalid', chapter: '-1', version: 'bad' })
    })

    expect(result.current.currentBook).toBe('gen')
    expect(result.current.currentChapter).toBe(1)
    expect(result.current.currentVersion).toBe('GAE')
  })

  it('builds share URL from current state', () => {
    const { result } = renderHook(() => useBiblePageState())

    act(() => {
      result.current.selectBook('rom')
      result.current.selectChapter(8)
      result.current.selectVersion('SAE')
    })

    expect(result.current.generateShareUrl()).toBe('/bible?book=rom&chapter=8&version=SAE')
  })
})
