import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET } from '../bible/schedules/route'

type QueryResult = { data: unknown; error: unknown }

function createRequest(query = ''): Request {
  return new Request(`http://localhost/api/bible/schedules${query}`)
}

// A chainable thenable query builder whose awaited value is `result`.
function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'gte', 'lte']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return query
}

function createMockSupabase({
  user = { id: 'user-1' },
  subscriptionResult = {
    data: [{ id: 'sub-1', plan_id: 7 }],
    error: null,
  },
  scheduleResult = { data: [{ id: 'schedule-1', plan_id: 7 }], error: null },
}: {
  user?: { id: string } | null
  subscriptionResult?: QueryResult
  scheduleResult?: QueryResult
} = {}) {
  const subscriptionQuery = createQuery(subscriptionResult)
  const scheduleQuery = createQuery(scheduleResult)
  const from = vi.fn((table: string) => {
    if (table === 'plan_subscriptions') return subscriptionQuery
    if (table === 'daily_schedules') return scheduleQuery
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from,
    },
    from,
    subscriptionQuery,
    scheduleQuery,
  }
}

describe('GET /api/bible/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 and performs no table query when unauthenticated', async () => {
    const mock = createMockSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns 400 and performs no query for an invalid plan_id', async () => {
    const mock = createMockSupabase()
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(createRequest('?plan_id=0'))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('plan_id must be a positive integer')
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('loads readable subscriptions first and queries schedules only by owned plan ids', async () => {
    const mock = createMockSupabase({
      subscriptionResult: {
        data: [
          { id: 'sub-1', plan_id: 7 },
          { id: 'sub-2', plan_id: 9 },
        ],
        error: null,
      },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(createRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mock.subscriptionQuery.select).toHaveBeenCalledWith(
      'id,plan_id,bible_reading_plans!inner(is_active)'
    )
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('bible_reading_plans.is_active', true)
    expect(mock.scheduleQuery.in).toHaveBeenCalledWith('plan_id', [7, 9])
    expect(json.data).toEqual([{ id: 'schedule-1', plan_id: 7 }])
  })

  it('returns schedules and applies date filters for an owned active plan_id', async () => {
    const mock = createMockSupabase()
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(
      createRequest('?plan_id=7&date=2026-07-11&date_from=2026-07-01&date_to=2026-07-31')
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('plan_id', 7)
    expect(mock.scheduleQuery.in).toHaveBeenCalledWith('plan_id', [7])
    expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('date', '2026-07-11')
    expect(mock.scheduleQuery.gte).toHaveBeenCalledWith('date', '2026-07-01')
    expect(mock.scheduleQuery.lte).toHaveBeenCalledWith('date', '2026-07-31')
    expect(json.data).toEqual([{ id: 'schedule-1', plan_id: 7 }])
  })

  it('returns 404 and never queries schedules for an unreadable plan_id', async () => {
    const mock = createMockSupabase({
      subscriptionResult: { data: [], error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(createRequest('?plan_id=123'))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Plan not found')
    expect(mock.from).toHaveBeenCalledWith('plan_subscriptions')
    expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
  })

  it('returns empty data without querying schedules when no plan_id and no readable subscriptions', async () => {
    const mock = createMockSupabase({
      subscriptionResult: { data: [], error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET(createRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual([])
    expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
  })
})
