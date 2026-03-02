import { describe, expect, it, vi } from 'vitest'
import { createNote, deleteNote, getNote, getNotes, updateNote } from '@/repositories/bible/noteRepository'

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

describe('noteRepository', () => {
  it('gets notes by user and optional chapter filter', async () => {
    const query = createQueryMock()
    const rows = [{ id: 'n1', user_id: 'u1', book: 'gen', chapter: 1, content: 'memo' }]
    query.order.mockResolvedValue({ data: rows, error: null })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getNotes(supabase as never, 'u1', { book: 'gen', chapter: 1 })

    expect(supabase.from).toHaveBeenCalledWith('user_notes')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(query.eq).toHaveBeenCalledWith('book', 'gen')
    expect(query.eq).toHaveBeenCalledWith('chapter', 1)
    expect(result.data).toEqual(rows)
  })

  it('returns null when getNote has not found error', async () => {
    const query = createQueryMock()
    query.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    const supabase = { from: vi.fn().mockReturnValue(query) }

    const result = await getNote(supabase as never, 'u1', 'n1')

    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('creates, updates and deletes a note', async () => {
    const query = createQueryMock()
    query.single
      .mockResolvedValueOnce({ data: { id: 'n1', content: 'first' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'n1', content: 'updated' }, error: null })
    const deleteChain = { eq: vi.fn() }
    deleteChain.eq.mockReturnValueOnce(deleteChain).mockResolvedValueOnce({ data: null, error: null })
    query.delete.mockReturnValue(deleteChain)

    const supabase = { from: vi.fn().mockReturnValue(query) }

    const created = await createNote(supabase as never, 'u1', {
      book: 'gen',
      chapter: 1,
      content: 'first',
    })
    const updated = await updateNote(supabase as never, 'u1', 'n1', { content: 'updated' })
    const removed = await deleteNote(supabase as never, 'u1', 'n1')

    expect(created.data).toEqual({ id: 'n1', content: 'first' })
    expect(updated.data).toEqual({ id: 'n1', content: 'updated' })
    expect(removed.data).toEqual({ success: true })
  })
})
