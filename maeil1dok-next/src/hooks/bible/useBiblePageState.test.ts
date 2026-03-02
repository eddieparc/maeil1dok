// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useBiblePageState } from './useBiblePageState'

describe('useBiblePageState smoke', () => {
  it('initializes with genesis chapter 1', () => {
    const { result } = renderHook(() => useBiblePageState())

    expect(result.current.currentBook).toBe('gen')
    expect(result.current.currentChapter).toBe(1)
  })
})
