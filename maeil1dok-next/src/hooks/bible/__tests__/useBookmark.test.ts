// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useBookmark } from '../useBookmark'

describe('useBookmark', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial load', () => {
    it('should fetch bookmark status on mount', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/bookmarks'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.current.isBookmarked).toBe(false)
    })

    it('should set isBookmarked to true if bookmark exists', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: '1',
              book: 'gen',
              chapter: 1,
              bookmark_type: 'chapter',
              user_id: 'user-1',
              created_at: '2026-03-02T00:00:00Z',
            },
          ],
        }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(true)
    })

    it('should handle fetch error gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(false)
    })
  })

  describe('toggleBookmark', () => {
    it('should add bookmark with optimistic update', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: '1', book: 'gen', chapter: 1 } }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(false)

      let togglePromise: Promise<void> | undefined
      act(() => {
        togglePromise = result.current.toggleBookmark()
      })

      // Optimistic update should happen immediately
      expect(result.current.isBookmarked).toBe(true)

      if (togglePromise) {
        await togglePromise
      }

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/bookmarks'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should remove bookmark with optimistic update', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: '1',
                book: 'gen',
                chapter: 1,
                bookmark_type: 'chapter',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: '1',
                book: 'gen',
                chapter: 1,
                bookmark_type: 'chapter',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(true)

      let togglePromise: Promise<void> | undefined
      act(() => {
        togglePromise = result.current.toggleBookmark()
      })

      // Optimistic update should happen immediately
      expect(result.current.isBookmarked).toBe(false)

      if (togglePromise) {
        await togglePromise
      }

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/bookmarks'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should revert optimistic update on error when adding', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockRejectedValueOnce(new Error('Failed to add bookmark'))

      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(false)

      let togglePromise: Promise<void> | undefined
      act(() => {
        togglePromise = result.current.toggleBookmark()
      })

      // Optimistic update
      expect(result.current.isBookmarked).toBe(true)

      if (togglePromise) {
        await togglePromise
      }

      // Should revert on error - wait for state update
      await waitFor(() => {
        expect(result.current.isBookmarked).toBe(false)
      })
    })

    it('should revert optimistic update on error when removing', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: '1',
                book: 'gen',
                chapter: 1,
                bookmark_type: 'chapter',
              },
            ],
          }),
        })
        .mockRejectedValueOnce(new Error('Failed to remove bookmark'))

      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isBookmarked).toBe(true)

      let togglePromise: Promise<void> | undefined
      act(() => {
        togglePromise = result.current.toggleBookmark()
      })

      // Optimistic update
      expect(result.current.isBookmarked).toBe(false)

      if (togglePromise) {
        await togglePromise
      }

      // Should revert on error - wait for state update
      await waitFor(() => {
        expect(result.current.isBookmarked).toBe(true)
      })
    })

    it('should handle 409 conflict when adding duplicate bookmark', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ error: 'Bookmark already exists' }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let togglePromise: Promise<void> | undefined
      act(() => {
        togglePromise = result.current.toggleBookmark()
      })

      expect(result.current.isBookmarked).toBe(true)

      if (togglePromise) {
        await togglePromise
      }

      // Should revert on 409 - wait for state update
      await waitFor(() => {
        expect(result.current.isBookmarked).toBe(false)
      })
    })
  })

  describe('isLoading state', () => {
    it('should set isLoading to true during initial fetch', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ data: [] }),
            })
          }, 100)
        })
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => useBookmark('gen', 1))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
