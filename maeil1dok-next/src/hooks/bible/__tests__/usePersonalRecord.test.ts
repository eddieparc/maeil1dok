// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { usePersonalRecord } from '../usePersonalRecord'
import { BIBLE_BOOKS } from '@/lib/bible/books'

describe('usePersonalRecord', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial load', () => {
    it('should fetch read chapters on mount', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ chapter: 1 }, { chapter: 2 }, { chapter: 3 }] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/personal-records'),
        expect.objectContaining({ method: 'GET' })
      )
      expect(result.current.readChapters).toEqual([1, 2, 3])
    })

    it('should handle empty read chapters', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.readChapters).toEqual([])
    })

    it('should handle fetch error gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.readChapters).toEqual([])
    })

    it('should set isLoading to true during initial fetch', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ data: [] }),
              })
            }, 100)
          })
      )
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('markAsRead', () => {
    it('should mark chapter as read and update state', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: '1', book: 'gen', chapter: 5 } }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.markAsRead(5)
      })

      expect(result.current.readChapters).toContain(5)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bible/personal-records'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should handle duplicate chapter (409 conflict)', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ chapter: 5 }] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ error: 'Record already exists' }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not throw, should handle gracefully
      await act(async () => {
        await result.current.markAsRead(5)
      })

      expect(result.current.readChapters).toContain(5)
    })

    it('should handle API error when marking as read', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockRejectedValueOnce(new Error('API error'))

      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.markAsRead(5)
        })
      ).rejects.toThrow()
    })
  })

  describe('isChapterRead', () => {
    it('should return true if chapter is in readChapters', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ chapter: 1 }, { chapter: 2 }] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isChapterRead(1)).toBe(true)
      expect(result.current.isChapterRead(2)).toBe(true)
    })

    it('should return false if chapter is not in readChapters', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ chapter: 1 }] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isChapterRead(1)).toBe(true)
      expect(result.current.isChapterRead(5)).toBe(false)
    })
  })

  describe('getBookProgress', () => {
    it('should return correct progress for book', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ chapter: 1 }, { chapter: 2 }, { chapter: 3 }] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const progress = result.current.getBookProgress()
      expect(progress.read).toBe(3)
      expect(progress.total).toBe(BIBLE_BOOKS['gen'].chapters)
    })

    it('should return 0 read chapters when none are read', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const progress = result.current.getBookProgress()
      expect(progress.read).toBe(0)
      expect(progress.total).toBe(BIBLE_BOOKS['gen'].chapters)
    })

    it('should return correct total chapters for different books', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('psa'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const progress = result.current.getBookProgress()
      expect(progress.total).toBe(BIBLE_BOOKS['psa'].chapters) // 150 chapters
    })
  })

  describe('API integration', () => {
    it('should pass book parameter to GET request', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      global.fetch = mockFetch

      renderHook(() => usePersonalRecord('mat'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain('book=mat')
    })

    it('should send read_date in POST request', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: '1' } }),
        })

      global.fetch = mockFetch

      const { result } = renderHook(() => usePersonalRecord('gen'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.markAsRead(5)
      })

      const postCall = mockFetch.mock.calls[1]
      const body = JSON.parse(postCall[1].body)
      expect(body).toHaveProperty('book', 'gen')
      expect(body).toHaveProperty('chapter', 5)
      expect(body).toHaveProperty('read_date')
    })
  })
})
