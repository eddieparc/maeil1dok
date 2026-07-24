import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET } from '../bible/schedules/today/route'

type QueryResult = { data: unknown; error: unknown }

// A chainable thenable query builder whose awaited value is `result`.
function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order']) {
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
  scheduleResult = {
    data: [{ id: 'schedule-1', plan_id: 7 }],
    error: null,
  },
  progressResult = {
    data: [{ schedule_id: 'schedule-1', is_completed: true }],
    error: null,
  },
}: {
  user?: { id: string } | null
  subscriptionResult?: QueryResult
  scheduleResult?: QueryResult
  progressResult?: QueryResult
} = {}) {
  const subscriptionQuery = createQuery(subscriptionResult)
  const scheduleQuery = createQuery(scheduleResult)
  const progressQuery = createQuery(progressResult)
  const from = vi.fn((table: string) => {
    if (table === 'plan_subscriptions') return subscriptionQuery
    if (table === 'daily_schedules') return scheduleQuery
    if (table === 'user_progress') return progressQuery
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
    progressQuery,
  }
}

describe('GET /api/bible/schedules/today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 and performs no table query when unauthenticated', async () => {
    const mock = createMockSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('returns empty data without querying schedules or progress when no readable subscriptions', async () => {
    const mock = createMockSupabase({
      subscriptionResult: { data: [], error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual([])
    expect(mock.from).toHaveBeenCalledWith('plan_subscriptions')
    expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
    expect(mock.from).not.toHaveBeenCalledWith('user_progress')
  })

  it('restricts to active subscriptions on active plans and merges progress', async () => {
    const mock = createMockSupabase({
      subscriptionResult: {
        data: [
          { id: 'sub-1', plan_id: 7 },
          { id: 'sub-2', plan_id: 9 },
        ],
        error: null,
      },
      scheduleResult: {
        data: [
          { id: 'schedule-1', plan_id: 7 },
          { id: 'schedule-2', plan_id: 9 },
        ],
        error: null,
      },
      progressResult: {
        data: [{ schedule_id: 'schedule-1', is_completed: true }],
        error: null,
      },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mock.subscriptionQuery.select).toHaveBeenCalledWith(
      'id,plan_id,bible_reading_plans!inner(is_active)'
    )
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('bible_reading_plans.is_active', true)
    expect(mock.scheduleQuery.in).toHaveBeenCalledWith('plan_id', [7, 9])
    expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('date', '2026-07-11')
    expect(mock.scheduleQuery.order).toHaveBeenCalledWith('plan_id', { ascending: true })
    expect(mock.progressQuery.in).toHaveBeenCalledWith('subscription_id', ['sub-1', 'sub-2'])
    expect(mock.progressQuery.in).toHaveBeenCalledWith('schedule_id', ['schedule-1', 'schedule-2'])
    expect(json.data).toEqual([
      { id: 'schedule-1', plan_id: 7, is_completed: true },
      { id: 'schedule-2', plan_id: 9, is_completed: false },
    ])
  })

  it('returns 500 when the schedule query fails', async () => {
    const mock = createMockSupabase({
      scheduleResult: { data: null, error: { message: 'boom' } },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to load today schedules')
    expect(mock.from).not.toHaveBeenCalledWith('user_progress')
  })

  it('returns 500 when the progress query fails instead of reporting false progress', async () => {
    const mock = createMockSupabase({
      progressResult: { data: null, error: { message: 'rls denied' } },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to load today schedules')
  })

  it('returns empty data without querying progress when no schedules match today', async () => {
    const mock = createMockSupabase({
      scheduleResult: { data: [], error: null },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual([])
    expect(mock.from).not.toHaveBeenCalledWith('user_progress')
  })
})
