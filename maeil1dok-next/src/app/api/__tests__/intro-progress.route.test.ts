import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from '../intro/progress/route'

type QueryResult = {
  readonly data: unknown
  readonly error: unknown
}

const FROZEN_NOW = '2026-07-11T09:30:00.000Z'

// Canonical UUID fixtures — the route now rejects non-UUID intro IDs before any
// authorization query, so all valid-path fixtures must use real UUID shapes.
const INTRO_ID = '11111111-1111-4111-8111-111111111111'
const GHOST_INTRO_ID = '22222222-2222-4222-8222-222222222222'
const PROGRESS_ID = '33333333-3333-4333-8333-333333333333'

function request(body?: unknown): Request {
  return new Request('http://localhost/api/intro/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Raw request helper: sends the given string verbatim as the body so tests can
// exercise malformed JSON and empty bodies with a JSON content type.
function rawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/intro/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

// A chainable query stub: select()/eq() return the same object, and
// maybeSingle()/single() resolve to the configured result.
function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.maybeSingle = vi.fn().mockResolvedValue(result)
  query.single = vi.fn().mockResolvedValue(result)
  return query
}

function createSupabase({
  user = { id: 'user-1' },
  authError = null,
  intro = { data: { id: INTRO_ID, plan_id: 1 }, error: null },
  plan = { data: { id: 1 }, error: null },
  subscription = { data: { id: 'sub-1' }, error: null },
  upsertResult = {
    data: {
      id: PROGRESS_ID,
      user_id: 'user-1',
      video_intro_id: INTRO_ID,
      is_completed: true,
      completed_at: FROZEN_NOW,
      created_at: '2026-07-10T00:00:00.000Z',
      updated_at: FROZEN_NOW,
    },
    error: null,
  },
}: {
  readonly user?: { readonly id: string } | null
  readonly authError?: unknown
  readonly intro?: QueryResult
  readonly plan?: QueryResult
  readonly subscription?: QueryResult
  readonly upsertResult?: QueryResult
} = {}) {
  const upsertSingle = vi.fn().mockResolvedValue(upsertResult)
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }))
  const upsert = vi.fn(() => ({ select: upsertSelect }))

  const from = vi.fn((table: string) => {
    if (table === 'video_bible_intros') return createQuery(intro)
    if (table === 'bible_reading_plans') return createQuery(plan)
    if (table === 'plan_subscriptions') return createQuery(subscription)
    if (table === 'user_video_intro_progress') return { upsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
      from,
    },
    from,
    upsert,
  }
}

describe('POST /api/intro/progress — active-subscription authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FROZEN_NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 and touches no table when unauthenticated', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 before parsing when unauthenticated body is malformed JSON', async () => {
    const mock = createSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(rawRequest('{ not json'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(rawRequest('{ "videoIntroId": '))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated empty body', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(rawRequest(''))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['array', [INTRO_ID, true]],
    ['string', 'intro'],
    ['number', 42],
    ['boolean', true],
  ])('returns 400 Request body must be an object for top-level %s', async (_label, payload) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request(payload))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Request body must be an object' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', {}],
    ['null', { videoIntroId: null }],
    ['blank string', { videoIntroId: '   ' }],
    ['non-UUID string', { videoIntroId: 'intro-1' }],
    ['number', { videoIntroId: 42 }],
    ['boolean', { videoIntroId: true }],
    ['object', { videoIntroId: {} }],
    ['array', { videoIntroId: [] }],
  ])('returns 400 videoIntroId must be a UUID string when videoIntroId is %s', async (_label, extra) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ completed: true, ...extra }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'videoIntroId must be a UUID string' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', {}],
    ['null', { completed: null }],
    ['string', { completed: 'yes' }],
    ['number', { completed: 1 }],
    ['object', { completed: {} }],
    ['array', { completed: [] }],
  ])('returns 400 completed must be boolean when completed is %s', async (_label, extra) => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, ...extra }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'completed must be boolean' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 and never upserts when the intro does not exist', async () => {
    const mock = createSupabase({ intro: { data: null, error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: GHOST_INTRO_ID, completed: true }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Video intro not found' })
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 and never upserts when the intro lookup errors', async () => {
    const mock = createSupabase({ intro: { data: null, error: { message: 'boom' } } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(404)
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 and never upserts when the intro plan is inactive', async () => {
    const mock = createSupabase({ plan: { data: null, error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(404)
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 and never upserts when the user has no active subscription', async () => {
    const mock = createSupabase({ subscription: { data: null, error: null } })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Video intro not found' })
    expect(mock.upsert).not.toHaveBeenCalled()
  })

  it('upserts completed progress for an authorized active subscription', async () => {
    const mock = createSupabase()
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(200)
    expect(mock.upsert).toHaveBeenCalledTimes(1)
    expect(mock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        video_intro_id: INTRO_ID,
        is_completed: true,
        completed_at: FROZEN_NOW,
      },
      { onConflict: 'user_id,video_intro_id' }
    )
    expect(await response.json()).toEqual({
      data: {
        id: PROGRESS_ID,
        userId: 'user-1',
        videoIntroId: INTRO_ID,
        isCompleted: true,
        completedAt: FROZEN_NOW,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: FROZEN_NOW,
      },
    })
  })

  it('sets completed_at to null when marking progress incomplete', async () => {
    const mock = createSupabase({
      upsertResult: {
        data: {
          id: PROGRESS_ID,
          user_id: 'user-1',
          video_intro_id: INTRO_ID,
          is_completed: false,
          completed_at: null,
          created_at: '2026-07-10T00:00:00.000Z',
          updated_at: FROZEN_NOW,
        },
        error: null,
      },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: false }))

    expect(response.status).toBe(200)
    expect(mock.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        video_intro_id: INTRO_ID,
        is_completed: false,
        completed_at: null,
      },
      { onConflict: 'user_id,video_intro_id' }
    )
    expect(await response.json()).toMatchObject({ data: { isCompleted: false, completedAt: null } })
  })

  it('returns 500 when the upsert fails', async () => {
    const mock = createSupabase({
      upsertResult: { data: null, error: { message: 'db down' } },
    })
    createClientMock.mockResolvedValue(mock.supabase)

    const response = await POST(request({ videoIntroId: INTRO_ID, completed: true }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update progress' })
  })
})
