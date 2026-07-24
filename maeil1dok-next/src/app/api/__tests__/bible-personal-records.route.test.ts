import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET, POST } from '../bible/personal-records/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

function request(rawBody?: string): Request {
  return new Request('http://localhost/api/bible/personal-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function jsonRequest(body: unknown): Request {
  return request(JSON.stringify(body))
}

function getRequest(search = ''): Request {
  return new Request(`http://localhost/api/bible/personal-records${search}`, {
    method: 'GET',
  })
}

function createSupabase({
  user = { id: 'user-1' },
  authError = null,
  insertResult = { data: { id: 'record-1' }, error: null } as QueryResult,
  selectResult = { data: [], error: null } as QueryResult,
}: {
  readonly user?: { readonly id: string } | null
  readonly authError?: unknown
  readonly insertResult?: QueryResult
  readonly selectResult?: QueryResult
} = {}) {
  const single = vi.fn().mockResolvedValue(insertResult)
  const insertSelect = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: insertSelect }))
  const recordsQuery = Object.assign(Promise.resolve(selectResult), {
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
  })
  recordsQuery.eq.mockReturnValue(recordsQuery)
  recordsQuery.gte.mockReturnValue(recordsQuery)
  recordsQuery.lte.mockReturnValue(recordsQuery)
  recordsQuery.order.mockReturnValue(recordsQuery)
  const selectRecords = vi.fn(() => recordsQuery)

  const from = vi.fn((table: string) => {
    if (table === 'personal_reading_records') return { insert, select: selectRecords }
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
    selectRecords,
    recordsQuery,
  }
}

const validBody = { book: 'gen', chapter: 1, read_date: '2026-07-11' }

describe('GET /api/bible/personal-records — query validation and boundary correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 and touches no table for an unauthenticated malformed book filter', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest('?book=zzz'))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns all records for the authenticated user when no filters are supplied', async () => {
    const mock = createSupabase({ selectResult: { data: [{ id: 'record-1' }], error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: 'record-1' }] })
    expect(mock.from).toHaveBeenCalledWith('personal_reading_records')
    expect(mock.selectRecords).toHaveBeenCalledWith('*')
    expect(mock.recordsQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mock.recordsQuery.order).toHaveBeenCalledWith('read_date', { ascending: false })
  })

  it('normalizes an uppercase book filter to the canonical lowercase Next key', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest('?book=GEN'))

    expect(response.status).toBe(200)
    expect(mock.recordsQuery.eq).toHaveBeenCalledWith('book', 'gen')
  })

  it('applies valid date-range predicates after the user predicate', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest('?date_from=2026-07-01&date_to=2026-07-31'))

    expect(response.status).toBe(200)
    expect(mock.recordsQuery.gte).toHaveBeenCalledWith('read_date', '2026-07-01')
    expect(mock.recordsQuery.lte).toHaveBeenCalledWith('read_date', '2026-07-31')
  })

  it('accepts year 0001 and applies both date-range predicates', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest('?date_from=0001-01-01&date_to=0001-01-01'))

    expect(response.status).toBe(200)
    expect(mock.recordsQuery.gte).toHaveBeenCalledWith('read_date', '0001-01-01')
    expect(mock.recordsQuery.lte).toHaveBeenCalledWith('read_date', '0001-01-01')
  })

  it.each([
    ['blank', '?book=+++'],
    ['unsupported code', '?book=zzz'],
    ['non-canonical jnh alias', '?book=jnh'],
  ])('returns 400 for a %s book filter without accessing a table', async (_label, search) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest(search))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'book must be a supported Bible book code' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it.each([
    ['blank', ''],
    ['wrong format', '2026/07/11'],
    ['impossible date', '2026-02-30'],
  ])('returns 400 for %s %s without accessing a table', async (_label, value) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest(`?date_from=${value}`))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'date_from must be a valid YYYY-MM-DD date' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it.each([
    ['blank', ''],
    ['wrong format', '2026/07/11'],
    ['impossible date', '2026-02-30'],
  ])('returns 400 for %s %s without accessing a table', async (_label, value) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest(`?date_to=${value}`))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'date_to must be a valid YYYY-MM-DD date' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns 400 for a reversed date range without accessing a table', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(getRequest('?date_from=2026-07-31&date_to=2026-07-01'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'date_from must be before or equal to date_to' })
    expect(mock.from).not.toHaveBeenCalled()
  })
})

describe('POST /api/bible/personal-records — input validation and boundary correctness', () => {
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
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [validBody]],
    ['string', 'gen'],
    ['number', 3],
    ['boolean', true],
  ])('returns 400 for top-level %s JSON without inserting', async (_label, body) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest(body))

    expect(response.status).toBe(400)
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['blank', '   '],
    ['non-string', 42],
    ['unsupported code', 'zzz'],
    ['non-canonical jnh (Django alias for Jonah)', 'jnh'],
  ])('returns 400 for %s book without inserting', async (_label, book) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, book }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'book must be a supported Bible book code' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('normalizes surrounding whitespace and uppercase book to the canonical lowercase Next key', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, book: '  GEN  ' }))

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledTimes(1)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 1,
      read_date: '2026-07-11',
    })
  })

  it.each([
    ['missing', undefined],
    ['string', '1'],
    ['float', 2.5],
    ['zero', 0],
    ['negative', -3],
  ])('returns 400 for %s chapter without inserting', async (_label, chapter) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, chapter }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'chapter must be a positive integer' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 400 for a chapter above the selected book chapter count without inserting', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    // exo has 40 chapters; 41 is out of range.
    const response = await POST(jsonRequest({ ...validBody, book: 'exo', chapter: 41 }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'chapter is out of range for book' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('accepts a chapter exactly at the selected book maximum', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, book: 'exo', chapter: 40 }))

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['missing', undefined],
    ['non-string', 20260711],
    ['blank', '   '],
    ['wrong format', '2026/07/11'],
    ['short year', '26-07-11'],
    ['impossible day', '2026-02-30'],
    ['impossible month', '2026-13-01'],
  ])('returns 400 for %s read_date without inserting', async (_label, read_date) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, read_date }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'read_date must be a valid YYYY-MM-DD date' })
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('returns 409 when Supabase reports a duplicate (code 23505)', async () => {
    const mock = createSupabase({
      insertResult: { data: null, error: { code: '23505', message: 'duplicate' } },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest(validBody))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Record already exists for this book and chapter',
    })
  })

  it('returns 201 with { data } on a successful insert', async () => {
    const mock = createSupabase({
      insertResult: { data: { id: 'record-9' }, error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest(validBody))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { id: 'record-9' } })
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 1,
      read_date: '2026-07-11',
    })
  })

  it('accepts year 0001 and inserts the canonical read_date', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(jsonRequest({ ...validBody, read_date: '0001-01-01' }))

    expect(response.status).toBe(201)
    expect(mock.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      book: 'gen',
      chapter: 1,
      read_date: '0001-01-01',
    })
  })
})
