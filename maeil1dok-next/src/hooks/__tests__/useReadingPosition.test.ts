// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/client')
vi.mock('@/repositories/bible/readingPositionRepository')
vi.mock('@/repositories/factory')

import { useReadingPosition } from '../useReadingPosition'
import { createClient } from '@/lib/supabase/client'
import {
  getPosition,
  savePosition,
} from '@/repositories/bible/readingPositionRepository'

const mockGetPosition = vi.mocked(getPosition)
const mockSavePosition = vi.mocked(savePosition)

const STORAGE_KEY = 'lastReadingPosition'

// localStorage mock (jsdom localStorage may not be available in vitest node env)
function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((_key: string): string | null => store[_key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((_index: number) => null),
  }
}

function createMockSupabase(user: { id: string } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'Not authenticated' },
      }),
    },
    from: vi.fn(),
  }
}

function defaultOptions(overrides: Record<string, unknown> = {}) {
  return {
    book: 'gen',
    chapter: 1,
    verse: null as number | null,
    version: 'GAE',
    pathname: '/bible',
    searchParams: {
      toString: () => '',
      has: (_key: string) => false,
    },
    router: { replace: vi.fn() },
    onRestore: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
}

describe('useReadingPosition', () => {
  let mockLocalStorage: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage = createLocalStorageMock()
    vi.stubGlobal('localStorage', mockLocalStorage)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal('scrollY', 0)
  })

  describe('localStorage save', () => {
    it('saves previous position to localStorage when book/chapter changes', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      const options = defaultOptions()
      const { rerender } = renderHook(
        (props) => useReadingPosition(props),
        { initialProps: options },
      )

      // Let restore effect settle
      await waitFor(() => expect(true).toBe(true))

      // Change chapter → triggers persist of previous location
      rerender({ ...options, chapter: 2 })

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled()
        const calls = mockLocalStorage.setItem.mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0]).toBe(STORAGE_KEY)
        const parsed = JSON.parse(lastCall[1])
        expect(parsed.book).toBe('gen')
        expect(parsed.chapter).toBe(1)
      })
    })
  })

  describe('localStorage load (unauthenticated)', () => {
    it('restores from localStorage when not authenticated', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === STORAGE_KEY) {
          return JSON.stringify({
            book: 'exo',
            chapter: 3,
            verse: null,
            scrollPosition: 150,
            version: 'GAE',
          })
        }
        return null
      })

      const options = defaultOptions()
      renderHook(() => useReadingPosition(options))

      await waitFor(() => {
        expect(options.onRestore).toHaveBeenCalledWith(
          expect.objectContaining({
            book: 'exo',
            chapter: 3,
            version: 'GAE',
          }),
        )
      })

      expect(mockGetPosition).not.toHaveBeenCalled()
    })
  })

  describe('Supabase sync (authenticated)', () => {
    const mockUser = { id: 'user-123' }

    it('saves to both localStorage and Supabase when authenticated', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(mockUser) as never)
      mockSavePosition.mockResolvedValue({ data: null, error: null })
      mockGetPosition.mockResolvedValue({ data: null, error: null })

      const options = defaultOptions()
      const { rerender } = renderHook(
        (props) => useReadingPosition(props),
        { initialProps: options },
      )

      // Wait for restore + auth check to complete
      await waitFor(() => expect(true).toBe(true))

      // Change chapter to trigger persist of previous location
      rerender({ ...options, chapter: 2 })

      await waitFor(() => {
        expect(mockSavePosition).toHaveBeenCalledWith(
          expect.anything(),
          'user-123',
          expect.objectContaining({ book: 'gen', chapter: 1 }),
        )
      })

      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('loads from Supabase on mount when authenticated', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(mockUser) as never)

      mockGetPosition.mockResolvedValue({
        data: {
          id: 'pos-1',
          user_id: 'user-123',
          book: 'lev',
          chapter: 5,
          verse: null,
          scroll_position: 200,
          version: 'NIV',
          updated_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        } as never,
        error: null,
      })

      const options = defaultOptions()
      renderHook(() => useReadingPosition(options))

      await waitFor(() => {
        expect(options.onRestore).toHaveBeenCalledWith(
          expect.objectContaining({
            book: 'lev',
            chapter: 5,
            version: 'NIV',
          }),
        )
      })

      expect(mockGetPosition).toHaveBeenCalledWith(expect.anything(), 'user-123')
    })

    it('falls back to localStorage when Supabase returns error', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(mockUser) as never)
      mockGetPosition.mockResolvedValue({
        data: null,
        error: new Error('network error'),
      })

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === STORAGE_KEY) {
          return JSON.stringify({
            book: 'num',
            chapter: 7,
            verse: null,
            scrollPosition: 100,
            version: 'GAE',
          })
        }
        return null
      })

      const options = defaultOptions()
      renderHook(() => useReadingPosition(options))

      await waitFor(() => {
        expect(options.onRestore).toHaveBeenCalledWith(
          expect.objectContaining({
            book: 'num',
            chapter: 7,
          }),
        )
      })
    })

    it('falls back to localStorage when Supabase returns no data', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(mockUser) as never)
      mockGetPosition.mockResolvedValue({ data: null, error: null })

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === STORAGE_KEY) {
          return JSON.stringify({
            book: 'deu',
            chapter: 10,
            scrollPosition: 50,
            version: 'GAE',
          })
        }
        return null
      })

      const options = defaultOptions()
      renderHook(() => useReadingPosition(options))

      await waitFor(() => {
        expect(options.onRestore).toHaveBeenCalledWith(
          expect.objectContaining({
            book: 'deu',
            chapter: 10,
          }),
        )
      })
    })
  })

  describe('unauthenticated — no Supabase calls', () => {
    it('does not call savePosition when unauthenticated', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      const options = defaultOptions()
      const { rerender } = renderHook(
        (props) => useReadingPosition(props),
        { initialProps: options },
      )

      // Let restore effect settle
      await waitFor(() => expect(true).toBe(true))

      // Trigger persist by changing chapter
      rerender({ ...options, chapter: 2 })

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled()
      })

      expect(mockSavePosition).not.toHaveBeenCalled()
    })

    it('does not call getPosition when unauthenticated', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      const options = defaultOptions()
      renderHook(() => useReadingPosition(options))

      // Let all effects settle
      await new Promise((r) => setTimeout(r, 50))

      expect(mockGetPosition).not.toHaveBeenCalled()
    })
  })

  describe('onRestore callback', () => {
    it('calls onRestore with full position from Supabase', async () => {
      const mockUser = { id: 'user-456' }
      vi.mocked(createClient).mockReturnValue(createMockSupabase(mockUser) as never)

      mockGetPosition.mockResolvedValue({
        data: {
          id: 'pos-2',
          user_id: 'user-456',
          book: 'psa',
          chapter: 23,
          verse: 1,
          scroll_position: 0,
          version: 'GAE',
          updated_at: '2026-01-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        } as never,
        error: null,
      })

      const onRestore = vi.fn()
      const options = defaultOptions({ onRestore })

      renderHook(() => useReadingPosition(options))

      await waitFor(() => {
        expect(onRestore).toHaveBeenCalledTimes(1)
      })

      expect(onRestore).toHaveBeenCalledWith(
        expect.objectContaining({
          book: 'psa',
          chapter: 23,
          verse: 1,
          scrollPosition: 0,
          version: 'GAE',
        }),
      )
    })

    it('is not called when no saved position exists', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      const onRestore = vi.fn()
      const options = defaultOptions({ onRestore })

      renderHook(() => useReadingPosition(options))

      await new Promise((r) => setTimeout(r, 50))

      expect(onRestore).not.toHaveBeenCalled()
    })

    it('does not restore when searchParams has book or chapter', async () => {
      vi.mocked(createClient).mockReturnValue(createMockSupabase(null) as never)

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === STORAGE_KEY) {
          return JSON.stringify({ book: 'gen', chapter: 5, version: 'GAE' })
        }
        return null
      })

      const onRestore = vi.fn()
      const options = defaultOptions({
        onRestore,
        searchParams: {
          toString: () => 'book=gen&chapter=5',
          has: (key: string) => key === 'book' || key === 'chapter',
        },
      })

      renderHook(() => useReadingPosition(options))

      await new Promise((r) => setTimeout(r, 50))

      expect(onRestore).not.toHaveBeenCalled()
    })
  })
})
