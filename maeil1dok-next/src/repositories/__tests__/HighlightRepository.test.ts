import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseHighlightRepository } from '@/repositories/implementations/SupabaseHighlightRepository'
import type { VerseHighlight, CreateHighlightInput } from '@/types'

function createMockSupabase() {
  const mockFrom = vi.fn()
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    }),
  }

  const chainableQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }

  mockFrom.mockReturnValue(chainableQuery)

  return {
    from: mockFrom,
    auth: mockAuth,
    chainableQuery,
  }
}

const mockHighlightRow = {
  id: 'highlight-1',
  user_id: 'user-1',
  book: 'gen',
  chapter: 1,
  verse_start: 1,
  verse_end: 3,
  color: 'yellow',
  version: 'GAE',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const expectedHighlight: VerseHighlight = {
  id: 'highlight-1',
  userId: 'user-1',
  book: 'gen',
  chapter: 1,
  verseStart: 1,
  verseEnd: 3,
  color: 'yellow',
  version: 'GAE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('SupabaseHighlightRepository', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseHighlightRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseHighlightRepository(mockSupabase as never)
  })

  describe('getHighlights', () => {
    it('returns array of VerseHighlight for given book, chapter, version', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [mockHighlightRow],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }))

      const result = await repo.getHighlights('gen', 1, 'GAE')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expectedHighlight)
    })

    it('returns empty array when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await repo.getHighlights('gen', 1, 'GAE')
      expect(result).toEqual([])
    })
  })

  describe('createHighlight', () => {
    it('returns created VerseHighlight', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: mockHighlightRow,
        error: null,
      })

      const input: CreateHighlightInput = {
        book: 'gen',
        chapter: 1,
        verseStart: 1,
        verseEnd: 3,
        color: 'yellow',
        version: 'GAE',
      }

      const result = await repo.createHighlight(input)

      expect(result).toEqual(expectedHighlight)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_highlights')
      expect(mockSupabase.chainableQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          book: 'gen',
          chapter: 1,
          verse_start: 1,
          verse_end: 3,
          color: 'yellow',
          version: 'GAE',
        }),
        expect.objectContaining({ onConflict: 'user_id,book,chapter,verse_start,verse_end,version' })
      )
    })
  })

  describe('deleteHighlight', () => {
    it('deletes highlight by id for current user', async () => {
      await repo.deleteHighlight('highlight-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_highlights')
      expect(mockSupabase.chainableQuery.delete).toHaveBeenCalled()
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('id', 'highlight-1')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })
  })

  describe('updateHighlightColor', () => {
    it('returns updated VerseHighlight with new color', async () => {
      const updatedRow = { ...mockHighlightRow, color: 'green' }
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      })

      const result = await repo.updateHighlightColor('highlight-1', 'green')

      expect(result.color).toBe('green')
      expect(result.id).toBe('highlight-1')
      expect(mockSupabase.from).toHaveBeenCalledWith('user_highlights')
    })
  })
})
