import { describe, expect, it, vi } from 'vitest'
import {
  createHighlight,
  deleteHighlight,
  getChapterHighlights,
  updateHighlight,
} from '@/repositories/bible/highlightRepository'

function createQueryMock() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
}

describe('highlightRepository', () => {
  it('gets chapter highlights', async () => {
    const query = createQueryMock()
    const rows = [{ id: 'h1', user_id: 'u1', book: 'gen', chapter: 1 }]
    query.order.mockResolvedValue({ data: rows, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getChapterHighlights(supabase as never, 'u1', 'gen', 1, 'GAE')

    expect(supabase.from).toHaveBeenCalledWith('user_highlights')
    expect(result.data).toEqual(rows)
    expect(result.error).toBeNull()
  })

  it('creates and updates a highlight', async () => {
    const query = createQueryMock()
    query.single
      .mockResolvedValueOnce({ data: { id: 'h1', color: 'yellow' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'h1', color: 'blue' }, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const created = await createHighlight(supabase as never, 'u1', {
      book: 'gen',
      chapter: 1,
      verse_start: 1,
      verse_end: 2,
      color: 'yellow',
      version: 'GAE',
    })
    const updated = await updateHighlight(supabase as never, 'u1', 'h1', { color: 'blue' })

    expect(created.data).toEqual({ id: 'h1', color: 'yellow' })
    expect(updated.data).toEqual({ id: 'h1', color: 'blue' })
  })

  it('returns error when delete fails', async () => {
    const query = createQueryMock()
    query.delete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: new Error('delete failed') }),
      }),
    })

    const supabase = { from: vi.fn().mockReturnValue(query) }
    const result = await deleteHighlight(supabase as never, 'u1', 'h1')

    expect(result.data).toBeNull()
    expect(result.error).toEqual(new Error('delete failed'))
  })
})
