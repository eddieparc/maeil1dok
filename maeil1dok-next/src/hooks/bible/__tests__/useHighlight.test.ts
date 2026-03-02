// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useHighlight } from '../useHighlight'

describe('useHighlight', () => {
  let store: Record<string, string>

  beforeEach(() => {
    global.fetch = vi.fn()
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { store = {} },
      get length() { return Object.keys(store).length },
      key: (index: number) => Object.keys(store)[index] ?? null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  const makeHighlight = (overrides: Record<string, unknown> = {}) => ({
    id: 'h1',
    userId: 'user1',
    book: 'gen',
    chapter: 1,
    verseStart: 1,
    verseEnd: 1,
    color: 'yellow',
    version: 'GAE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  })

  function mockFetchSequence(...responses: Array<{ ok: boolean; data?: unknown }>) {
    const fn = vi.fn()
    for (const resp of responses) {
      if (resp.ok) {
        fn.mockResolvedValueOnce({
          ok: true,
          json: async () => resp.data,
        })
      } else {
        fn.mockResolvedValueOnce({ ok: false, status: 500 })
      }
    }
    return fn
  }

  describe('initial load', () => {
    it('should fetch highlights on mount', async () => {
      const mockFetch = mockFetchSequence({ ok: true, data: [makeHighlight()] })
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.highlights).toHaveLength(1)
      expect(result.current.highlights[0].id).toBe('h1')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/highlights?'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('should handle fetch error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.highlights).toHaveLength(0)
    })

    it('should handle non-ok response', async () => {
      global.fetch = mockFetchSequence({ ok: false })

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.highlights).toHaveLength(0)
    })
  })

  describe('createHighlight', () => {
    it('should create highlight with color and optimistic update', async () => {
      const saved = makeHighlight()
      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: true, data: saved },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.createHighlight(1, 'yellow')
      })

      expect(result.current.highlights).toHaveLength(1)
      expect(result.current.highlights[0].id).toBe('h1')
      // Verify POST was made
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const createCall = mockFetch.mock.calls[1]
      expect(createCall[1].method).toBe('POST')
      const body = JSON.parse(createCall[1].body)
      expect(body.color).toBe('yellow')
      expect(body.verseStart).toBe(1)
      expect(body.verseEnd).toBe(1)
    })

    it('should create highlight with memo', async () => {
      const saved = makeHighlight({ memo: 'Important verse' })
      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: true, data: saved },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.createHighlight(1, 'yellow', 'Important verse')
      })

      // Verify memo was sent in request body
      const createCall = mockFetch.mock.calls[1]
      const body = JSON.parse(createCall[1].body)
      expect(body.memo).toBe('Important verse')
    })

    it('should revert optimistic update on API error', async () => {
      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: false },
        { ok: true, data: [] },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.createHighlight(1, 'yellow')
      })

      await waitFor(() => {
        expect(result.current.highlights).toHaveLength(0)
      })
    })
  })

  describe('updateHighlight', () => {
    it('should update highlight color and memo', async () => {
      const original = makeHighlight()
      const mockFetch = mockFetchSequence(
        { ok: true, data: [original] },
        { ok: true, data: { ...original, color: 'blue', memo: 'Updated' } },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.highlights).toHaveLength(1))

      await act(async () => {
        await result.current.updateHighlight('h1', 'blue', 'Updated')
      })

      // Verify PATCH call
      const updateCall = mockFetch.mock.calls[1]
      expect(updateCall[1].method).toBe('PATCH')
      const body = JSON.parse(updateCall[1].body)
      expect(body.id).toBe('h1')
      expect(body.color).toBe('blue')
      expect(body.memo).toBe('Updated')

      // Optimistic update should have applied
      expect(result.current.highlights[0].color).toBe('blue')
    })
  })

  describe('deleteHighlight', () => {
    it('should delete with optimistic update', async () => {
      const mockFetch = mockFetchSequence(
        { ok: true, data: [makeHighlight()] },
        { ok: true, data: { success: true } },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.highlights).toHaveLength(1))

      await act(async () => {
        await result.current.deleteHighlight('h1')
      })

      expect(result.current.highlights).toHaveLength(0)
      // Verify DELETE was called
      const deleteCall = mockFetch.mock.calls[1]
      expect(deleteCall[1].method).toBe('DELETE')
      expect(deleteCall[0]).toContain('id=h1')
    })

    it('should revert on API error', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [makeHighlight()] })
        .mockRejectedValueOnce(new Error('Delete failed'))
      global.fetch = fn

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.highlights).toHaveLength(1))

      await act(async () => {
        await result.current.deleteHighlight('h1')
      })

      // Should revert
      expect(result.current.highlights).toHaveLength(1)
      expect(result.current.highlights[0].id).toBe('h1')
    })
  })

  describe('getVerseHighlight', () => {
    it('should return highlight for a verse within range', async () => {
      const highlight = makeHighlight({ verseStart: 1, verseEnd: 3 })
      global.fetch = mockFetchSequence({ ok: true, data: [highlight] })

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.getVerseHighlight(1)).not.toBeNull()
      expect(result.current.getVerseHighlight(2)).not.toBeNull()
      expect(result.current.getVerseHighlight(3)).not.toBeNull()
      expect(result.current.getVerseHighlight(1)?.id).toBe('h1')
    })

    it('should return null when no highlight exists for verse', async () => {
      const highlight = makeHighlight({ verseStart: 1, verseEnd: 1 })
      global.fetch = mockFetchSequence({ ok: true, data: [highlight] })

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.getVerseHighlight(99)).toBeNull()
    })
  })

  describe('customColors', () => {
    it('should track color on create', async () => {
      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: true, data: makeHighlight({ color: '#FF0000' }) },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.createHighlight(1, '#FF0000')
      })

      expect(result.current.customColors).toContain('#FF0000')
      // Should persist to localStorage
      const stored = JSON.parse(store['highlightCustomColors'] || '[]')
      expect(stored).toContain('#FF0000')
    })

    it('should limit to max 5 colors (MRU order)', async () => {
      store['highlightCustomColors'] = JSON.stringify(['#111', '#222', '#333', '#444', '#555'])

      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: true, data: makeHighlight({ color: '#666' }) },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.customColors).toHaveLength(5)

      await act(async () => {
        await result.current.createHighlight(1, '#666')
      })

      expect(result.current.customColors).toHaveLength(5)
      expect(result.current.customColors[0]).toBe('#666')
      expect(result.current.customColors).not.toContain('#555')
    })

    it('should load from localStorage on init', () => {
      store['highlightCustomColors'] = JSON.stringify(['#AABBCC', '#DDEEFF'])
      global.fetch = mockFetchSequence({ ok: true, data: [] })

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))

      expect(result.current.customColors).toEqual(['#AABBCC', '#DDEEFF'])
    })

    it('should not duplicate existing color, move to front instead', async () => {
      store['highlightCustomColors'] = JSON.stringify(['#AAA', '#BBB', '#CCC'])

      const mockFetch = mockFetchSequence(
        { ok: true, data: [] },
        { ok: true, data: makeHighlight({ color: '#BBB' }) },
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useHighlight('gen', 1, 'GAE'))
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.createHighlight(1, '#BBB')
      })

      expect(result.current.customColors).toEqual(['#BBB', '#AAA', '#CCC'])
    })
  })
})
