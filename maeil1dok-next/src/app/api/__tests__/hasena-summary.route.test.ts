import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET } from '../hasena/summary/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

const cachedRow = {
  id: 'summary-1',
  video_id: 'video-1',
  video_date: '2026-07-11',
  title: 'Title',
  summary: 'Summary body',
  transcript: 'Transcript body',
  model_used: 'gpt-test',
  is_edited: false,
  created_at: '2026-07-11T00:00:00.000Z',
  updated_at: '2026-07-11T00:00:00.000Z',
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/hasena/summary${query}`)
}

function createSupabase({
  user = { id: 'user-1' },
  authError = null,
  queryResult = { data: cachedRow, error: null },
}: {
  readonly user?: { readonly id: string } | null
  readonly authError?: unknown
  readonly queryResult?: QueryResult
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue(queryResult)
  const single = vi.fn(() => {
    throw new Error('single() must not be called; use maybeSingle()')
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle, single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn((table: string) => {
    if (table !== 'hasena_summaries') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { select }
  })

  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
      from,
    },
    from,
    select,
    eq,
    maybeSingle,
    single,
  }
}

describe('GET /api/hasena/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated and does not touch the table', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=video-1'))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns 400 for a missing videoId after auth and does not touch the table', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request(''))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'videoId required' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns 400 for a whitespace-only videoId after auth and does not touch the table', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=%20%20%20'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'videoId required' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns 200 with the cached row payload on a hit', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=video-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(cachedRow)
    expect(mock.from).toHaveBeenCalledWith('hasena_summaries')
    expect(mock.select).toHaveBeenCalledWith(
      'id, video_id, video_date, title, summary, transcript, model_used, is_edited, created_at, updated_at',
    )
    expect(mock.maybeSingle).toHaveBeenCalledTimes(1)
    expect(mock.single).not.toHaveBeenCalled()
  })

  it('trims whitespace-padded videoId before filtering hasena_summaries.video_id', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=%20video-1%20'))

    expect(response.status).toBe(200)
    expect(mock.eq).toHaveBeenCalledWith('video_id', 'video-1')
  })

  it('returns 404 for a normal cache miss ({ data: null, error: null })', async () => {
    const mock = createSupabase({ queryResult: { data: null, error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=video-1'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Summary not available yet' })
  })

  it('returns a sanitized 500 for a surfaced read error', async () => {
    const mock = createSupabase({
      queryResult: { data: null, error: { message: 'permission denied for table hasena_summaries', code: '42501' } },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await GET(request('?videoId=video-1'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Failed to load Hasena summary' })
    expect(JSON.stringify(body)).not.toContain('permission denied')
    expect(JSON.stringify(body)).not.toContain('42501')
  })
})
