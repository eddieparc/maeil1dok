import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createClientMock = vi.hoisted(() => vi.fn())
const syncHasenaEntriesMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/hasena/hasenaSync', () => ({
  syncHasenaEntries: syncHasenaEntriesMock,
}))

import { GET } from '../hasena/day/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

const entry = {
  id: 'entry-1',
  date: '2026-07-11',
  video_id: 'video-1',
  title: 'Title',
  passage: 'John 1:1',
  body_text: 'Body',
  verses: [{ number: '1', text: 'In the beginning' }],
  source_url: 'https://example.com/source',
  body_source_url: 'https://example.com/body',
  fetched_at: '2026-07-11T00:00:00.000Z',
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/hasena/day${query}`)
}

function createQuery(result: QueryResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn()
  const select = vi.fn()
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ eq, maybeSingle })
  return { select, eq, maybeSingle }
}

function createSupabase({
  user = { id: 'user-1' },
  authError = null,
  entryResults = [{ data: entry, error: null }],
  recordResult = { data: null, error: null },
}: {
  readonly user?: { readonly id: string } | null
  readonly authError?: unknown
  readonly entryResults?: readonly QueryResult[]
  readonly recordResult?: QueryResult
} = {}) {
  const entryQueries = entryResults.map(createQuery)
  const recordQuery = createQuery(recordResult)
  let entryIndex = 0
  const from = vi.fn((table: string) => {
    if (table === 'hasena_entries') {
      const query = entryQueries[entryIndex]
      entryIndex += 1
      if (!query) throw new Error('Missing hasena_entries query result')
      return query
    }
    if (table === 'hasena_records') return recordQuery
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
      from,
    },
    from,
  }
}

describe('GET /api/hasena/day', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncHasenaEntriesMock.mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it.each(['', '?date=July-11-2026'])('returns 400 for a missing or malformed date', async (query) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request(query))

    expect(response.status).toBe(400)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns false when an entry is cached without a record', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      entry: {
        id: 'entry-1', date: '2026-07-11', videoId: 'video-1', title: 'Title',
        passage: 'John 1:1', bodyText: 'Body', verses: [{ number: '1', text: 'In the beginning' }],
        sourceUrl: 'https://example.com/source', bodySourceUrl: 'https://example.com/body',
        fetchedAt: '2026-07-11T00:00:00.000Z',
      },
      isCompleted: false,
    })
    expect(syncHasenaEntriesMock).not.toHaveBeenCalled()
  })

  it('returns true when the cached entry has a completed record', async () => {
    const mock = createSupabase({ recordResult: { data: { is_completed: true }, error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ isCompleted: true })
  })

  it('returns 500 without syncing when the entry query fails', async () => {
    const mock = createSupabase({
      entryResults: [
        { data: null, error: { message: 'database unavailable' } },
        { data: null, error: null },
      ],
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to load Hasena day' })
    expect(syncHasenaEntriesMock).not.toHaveBeenCalled()
  })

  it('returns 404 after a cache miss and sync failure', async () => {
    const mock = createSupabase({ entryResults: [{ data: null, error: null }] })
    createClientMock.mockResolvedValue(mock.supabase)
    syncHasenaEntriesMock.mockRejectedValue(new Error('sync failed'))

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(404)
    expect(syncHasenaEntriesMock).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the record query fails', async () => {
    const mock = createSupabase({ recordResult: { data: null, error: { message: 'database unavailable' } } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?date=2026-07-11'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to load Hasena day' })
  })
})
