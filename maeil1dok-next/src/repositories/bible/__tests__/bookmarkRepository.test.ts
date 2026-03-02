import { describe, expect, it, vi } from 'vitest'
import { getBookmarks, isBookmarked, toggleBookmark } from '@/repositories/bible/bookmarkRepository'

function createQueryMock() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
}

describe('bookmarkRepository', () => {
  it('returns bookmarks with optional book filter', async () => {
    const query = createQueryMock()
    const bookmarks = [{ id: 'b1', user_id: 'u1', book: 'gen', chapter: 1 }]
    query.order.mockResolvedValue({ data: bookmarks, error: null })

    const supabase = {
      from: vi.fn().mockReturnValue(query),
    }

    const result = await getBookmarks(supabase as never, 'u1', 'gen')

    expect(supabase.from).toHaveBeenCalledWith('user_bookmarks')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(query.eq).toHaveBeenCalledWith('book', 'gen')
    expect(result.data).toEqual(bookmarks)
    expect(result.error).toBeNull()
  })

  it('toggles off an existing bookmark', async () => {
    const query = createQueryMock()
    query.maybeSingle.mockResolvedValue({ data: { id: 'b1' }, error: null })
    const deleteChain = { eq: vi.fn() }
    deleteChain.eq.mockReturnValueOnce(deleteChain).mockResolvedValueOnce({ data: null, error: null })
    query.delete.mockReturnValue(deleteChain)

    const supabase = {
      from: vi.fn().mockReturnValue(query),
    }

    const result = await toggleBookmark(supabase as never, 'u1', { book: 'gen', chapter: 1, verse: null })

    expect(result.data).toEqual({ bookmarked: false })
    expect(result.error).toBeNull()
  })

  it('returns false when bookmark is not found', async () => {
    const query = createQueryMock()
    query.maybeSingle.mockResolvedValue({ data: null, error: null })

    const supabase = {
      from: vi.fn().mockReturnValue(query),
    }

    const result = await isBookmarked(supabase as never, 'u1', 'gen', 1)

    expect(result.data).toBe(false)
    expect(result.error).toBeNull()
  })
})
