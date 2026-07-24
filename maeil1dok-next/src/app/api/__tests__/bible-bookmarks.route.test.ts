import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from '../bible/bookmarks/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

function request(rawBody?: string): Request {
  return new Request('http://localhost/api/bible/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function jsonRequest(body: unknown): Request {
  return request(JSON.stringify(body))
}

function createSupabase({
  user = { id: 'user-1' },
  authError = null,
  insertResult = { data: { id: 'bookmark-1' }, error: null } as QueryResult,
}: {
  readonly user?: { readonly id: string } | null
  readonly authError?: unknown
  readonly insertResult?: QueryResult
} = {}) {
  const single = vi.fn().mockResolvedValue(insertResult)
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))

  const from = vi.fn((table: string) => {
    if (table === 'bible_bookmarks') return { insert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
      },
      from,
    },
    from,
    insert,
  }
}

describe('POST /api/bible/bookmarks — canonical shape validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 and touches no table for an unauthenticated malformed-JSON request', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request('{ not json'))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON without inserting', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request('{ not json'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [{ bookmark_type: 'chapter', book: 'gen', chapter: 1 }]],
    ['string', 'chapter'],
    ['number', 3],
    ['boolean', true],
  ])('returns 400 for top-level %s JSON without inserting', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest(body))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid bookmark_type without inserting', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ bookmark_type: 'page', book: 'gen', chapter: 1 }))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['blank string', '   '],
    ['empty string', ''],
    ['non-string', 42],
    ['null', null],
  ])('returns 400 for %s book without inserting', async (_label, book) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ bookmark_type: 'chapter', book, chapter: 1 }))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['float', 2.5],
    ['string', '1'],
    ['missing', undefined],
  ])('returns 400 for %s chapter without inserting', async (_label, chapter) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ bookmark_type: 'chapter', book: 'gen', chapter }))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['missing start_verse', { end_verse: 5 }],
    ['missing end_verse', { start_verse: 3 }],
    ['non-positive start_verse', { start_verse: 0, end_verse: 5 }],
    ['non-positive end_verse', { start_verse: 3, end_verse: 0 }],
    ['float start_verse', { start_verse: 1.5, end_verse: 5 }],
    ['null bounds', { start_verse: null, end_verse: null }],
  ])('returns 400 for verse bookmark with %s without inserting', async (_label, verses) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      jsonRequest({ bookmark_type: 'verse', book: 'gen', chapter: 1, ...verses })
    )

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 400 for a verse bookmark where end_verse < start_verse', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      jsonRequest({ bookmark_type: 'verse', book: 'gen', chapter: 1, start_verse: 8, end_verse: 3 })
    )

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('persists a chapter bookmark with null verse bounds, ignoring supplied verse fields', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      jsonRequest({
        bookmark_type: 'chapter',
        book: '  gen  ',
        chapter: 3,
        start_verse: 4,
        end_verse: 9,
        title: '창세기',
      })
    )

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledTimes(1)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      bookmark_type: 'chapter',
      book: 'gen',
      chapter: 3,
      start_verse: null,
      end_verse: null,
      title: '창세기',
      color: '#3B82F6',
    })
  })

  it('persists a verse bookmark with the exact positive bounds', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      jsonRequest({
        bookmark_type: 'verse',
        book: 'gen',
        chapter: 1,
        start_verse: 3,
        end_verse: 8,
        color: '#FF0000',
      })
    )

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      bookmark_type: 'verse',
      book: 'gen',
      chapter: 1,
      start_verse: 3,
      end_verse: 8,
      title: '',
      color: '#FF0000',
    })
  })

  it('allows an equal-bound verse bookmark (single verse)', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      jsonRequest({ bookmark_type: 'verse', book: 'gen', chapter: 1, start_verse: 5, end_verse: 5 })
    )

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledTimes(1)
  })

  it('returns 409 when Supabase reports a duplicate (code 23505)', async () => {
    const mock = createSupabase({
      insertResult: { data: null, error: { code: '23505', message: 'duplicate' } },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ bookmark_type: 'chapter', book: 'gen', chapter: 1 }))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Bookmark already exists' })
  })

  it('returns 201 with { data } on a successful insert', async () => {
    const mock = createSupabase({
      insertResult: { data: { id: 'bookmark-9' }, error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ bookmark_type: 'chapter', book: 'gen', chapter: 1 }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { id: 'bookmark-9' } })
  })
})
