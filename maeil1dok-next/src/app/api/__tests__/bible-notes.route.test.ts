import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from '../bible/notes/route'
import { PATCH } from '../bible/notes/[id]/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

function postRequest(rawBody?: string): Request {
  return new Request('http://localhost/api/bible/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function postJson(body: unknown): Request {
  return postRequest(JSON.stringify(body))
}

function patchRequest(rawBody?: string): Request {
  return new Request('http://localhost/api/bible/notes/note-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function patchJson(body: unknown): Request {
  return patchRequest(JSON.stringify(body))
}

const params = Promise.resolve({ id: 'note-1' })

function createSupabase({
  user = { id: 'user-1' } as { readonly id: string } | null,
  authError = null as unknown,
  insertResult = { data: { id: 'note-1' }, error: null } as QueryResult,
  updateResult = { data: { id: 'note-1' }, error: null } as QueryResult,
} = {}) {
  const insertSingle = vi.fn().mockResolvedValue(insertResult)
  const insertSelect = vi.fn(() => ({ single: insertSingle }))
  const insert = vi.fn(() => ({ select: insertSelect }))

  const updateSingle = vi.fn().mockResolvedValue(updateResult)
  const updateSelect = vi.fn(() => ({ single: updateSingle }))
  const updateEqUser = vi.fn(() => ({ select: updateSelect }))
  const updateEqId = vi.fn(() => ({ eq: updateEqUser }))
  const update = vi.fn(() => ({ eq: updateEqId }))

  const from = vi.fn((table: string) => {
    if (table === 'reflection_notes') return { insert, update }
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
    update,
  }
}

describe('POST /api/bible/notes — canonical verse-window validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 and touches no table for an unauthenticated malformed-JSON request', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postRequest('{ not json'))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON without inserting', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postRequest('{ not json'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [{ book: 'gen', chapter: 1, content: 'x' }]],
    ['string', 'note'],
    ['number', 3],
  ])('returns 400 for top-level %s JSON without inserting', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postJson(body))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['blank book', { book: '   ', chapter: 1, content: 'x' }],
    ['non-string book', { book: 5, chapter: 1, content: 'x' }],
    ['zero chapter', { book: 'gen', chapter: 0, content: 'x' }],
    ['float chapter', { book: 'gen', chapter: 1.5, content: 'x' }],
    ['blank content', { book: 'gen', chapter: 1, content: '   ' }],
    ['non-string content', { book: 'gen', chapter: 1, content: 42 }],
    ['non-boolean is_private', { book: 'gen', chapter: 1, content: 'x', is_private: 'yes' }],
  ])('returns 400 for %s without inserting', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postJson(body))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['only start_verse', { start_verse: 5 }],
    ['only end_verse', { end_verse: 5 }],
    ['null start, number end', { start_verse: null, end_verse: 5 }],
    ['number start, null end', { start_verse: 5, end_verse: null }],
    ['non-positive start', { start_verse: 0, end_verse: 5 }],
    ['non-positive end', { start_verse: 3, end_verse: 0 }],
    ['float start', { start_verse: 1.5, end_verse: 5 }],
    ['reversed', { start_verse: 8, end_verse: 3 }],
  ])('returns 400 for invalid verse window (%s) without inserting', async (_label, verses) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postJson({ book: 'gen', chapter: 1, content: 'x', ...verses }))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('persists a chapter-level note with both verse bounds null', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(postJson({ book: '  gen  ', chapter: 3, content: 'reflection' }))

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledTimes(1)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 3,
      start_verse: null,
      end_verse: null,
      content: 'reflection',
      is_private: true,
    })
  })

  it('persists a single-verse note with equal positive bounds', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      postJson({ book: 'gen', chapter: 1, content: 'x', start_verse: 5, end_verse: 5, is_private: false })
    )

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 1,
      start_verse: 5,
      end_verse: 5,
      content: 'x',
      is_private: false,
    })
  })

  it('persists a ranged note with exact positive ordered bounds', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(
      postJson({ book: 'gen', chapter: 1, content: 'x', start_verse: 3, end_verse: 8 })
    )

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 1,
      start_verse: 3,
      end_verse: 8,
      content: 'x',
      is_private: true,
    })
  })
})

describe('PATCH /api/bible/notes/[id] — canonical verse-window validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 and touches no table for an unauthenticated malformed-JSON request', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchRequest('{ not json'), { params })

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON without updating', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchRequest('{ not json'), { params })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mock.update).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [{ content: 'x' }]],
    ['string', 'note'],
  ])('returns 400 for top-level %s JSON without updating', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson(body), { params })

    expect(response.status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it.each([
    ['blank content', { content: '   ' }],
    ['non-string content', { content: 42 }],
    ['non-boolean is_private', { is_private: 'yes' }],
    ['only start_verse', { start_verse: 5 }],
    ['only end_verse', { end_verse: 5 }],
    ['null start, number end', { start_verse: null, end_verse: 5 }],
    ['non-positive bound', { start_verse: 0, end_verse: 5 }],
    ['float bound', { start_verse: 1.5, end_verse: 5 }],
    ['reversed', { start_verse: 8, end_verse: 3 }],
  ])('returns 400 for invalid PATCH body (%s) without updating', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson(body), { params })

    expect(response.status).toBe(400)
    expect(mock.update).not.toHaveBeenCalled()
  })

  it('allows clearing the verse window with null/null bounds', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson({ start_verse: null, end_verse: null }), { params })

    expect(response.status).toBe(200)
    expect(mock.update).toHaveBeenCalledTimes(1)
    const updatePayload = mock.update.mock.calls[0][0]
    expect(updatePayload.start_verse).toBeNull()
    expect(updatePayload.end_verse).toBeNull()
  })

  it('allows a content-only update', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson({ content: 'updated' }), { params })

    expect(response.status).toBe(200)
    const updatePayload = mock.update.mock.calls[0][0]
    expect(updatePayload.content).toBe('updated')
    expect(updatePayload).not.toHaveProperty('start_verse')
    expect(updatePayload).not.toHaveProperty('end_verse')
  })

  it('allows a privacy-only update', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson({ is_private: false }), { params })

    expect(response.status).toBe(200)
    const updatePayload = mock.update.mock.calls[0][0]
    expect(updatePayload.is_private).toBe(false)
  })

  it('allows a valid ranged verse-window update', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await PATCH(patchJson({ start_verse: 2, end_verse: 4 }), { params })

    expect(response.status).toBe(200)
    const updatePayload = mock.update.mock.calls[0][0]
    expect(updatePayload.start_verse).toBe(2)
    expect(updatePayload.end_verse).toBe(4)
  })
})
