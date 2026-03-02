import { describe, expect, it, vi } from 'vitest'
import { getBookProgress, getReadChapters, markAsRead } from '@/repositories/bible/personalRecordRepository'

function createQueryMock() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
  }
}

describe('personalRecordRepository', () => {
  it('returns sorted chapter list for a book', async () => {
    const query = createQueryMock()
    query.order.mockResolvedValue({
      data: [{ chapter: 3 }, { chapter: 1 }, { chapter: 2 }],
      error: null,
    })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getReadChapters(supabase as never, 'u1', 'gen')

    expect(supabase.from).toHaveBeenCalledWith('user_bible_progress')
    expect(result.data).toEqual([1, 2, 3])
  })

  it('marks chapter as read through upsert', async () => {
    const query = createQueryMock()
    query.upsert.mockResolvedValue({ data: null, error: null })
    query.order.mockResolvedValue({ data: [{ id: 'p1', chapter: 1 }], error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await markAsRead(supabase as never, 'u1', 'gen', 1)

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', book: 'gen', chapter: 1 }),
      { onConflict: 'user_id,book,chapter' }
    )
    expect(result.error).toBeNull()
  })

  it('returns zero percent when total chapters is zero', async () => {
    const query = createQueryMock()
    query.order.mockResolvedValue({ data: [], error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getBookProgress(supabase as never, 'u1', 'gen', 0)

    expect(result.data).toEqual({ read: 0, total: 0, percentage: 0 })
    expect(result.error).toBeNull()
  })
})
