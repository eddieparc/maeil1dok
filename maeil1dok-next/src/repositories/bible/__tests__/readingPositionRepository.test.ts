import { describe, expect, it, vi } from 'vitest'
import { getPosition, savePosition } from '@/repositories/bible/readingPositionRepository'

function createQueryMock() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
  }
}

describe('readingPositionRepository', () => {
  it('returns null when no saved reading position exists', async () => {
    const query = createQueryMock()
    query.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getPosition(supabase as never, 'u1')

    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('saves reading position with upsert', async () => {
    const query = createQueryMock()
    const row = { user_id: 'u1', book: 'gen', chapter: 1, verse: 1, scroll_position: 120, version: 'GAE' }
    query.single.mockResolvedValue({ data: row, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await savePosition(supabase as never, 'u1', {
      book: 'gen',
      chapter: 1,
      verse: 1,
      scroll_position: 120,
      version: 'GAE',
    })

    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }), {
      onConflict: 'user_id',
    })
    expect(result.data).toEqual(row)
  })

  it('returns error when save fails', async () => {
    const query = createQueryMock()
    query.single.mockResolvedValue({ data: null, error: new Error('write failed') })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await savePosition(supabase as never, 'u1', { book: 'gen', chapter: 1 })

    expect(result.data).toBeNull()
    expect(result.error).toEqual(new Error('write failed'))
  })
})
