import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { POST } from '../bible/schedules/complete/route'

type QueryResult = { data: unknown; error: unknown }

function createRequest(body: object): Request {
  return new Request('http://localhost/api/bible/schedules/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createMalformedJsonRequest(): Request {
  return new Request('http://localhost/api/bible/schedules/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"schedule_id":',
  })
}

function createSelectQuery(result: QueryResult) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function createProgressQuery(result: QueryResult) {
  const query = {
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return query
}

function createMockSupabase({
  user = { id: 'user-1' },
  subscriptionResult = { data: { id: 'sub-1', plan_id: 'plan-1' }, error: null },
  scheduleResult = { data: { id: 'schedule-1' }, error: null },
  progressResult = { data: { id: 'progress-1' }, error: null },
}: {
  user?: { id: string } | null
  subscriptionResult?: QueryResult
  scheduleResult?: QueryResult
  progressResult?: QueryResult
} = {}) {
  const subscriptionQuery = createSelectQuery(subscriptionResult)
  const scheduleQuery = createSelectQuery(scheduleResult)
  const progressQuery = createProgressQuery(progressResult)
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

describe('POST /api/bible/schedules/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks an owned-plan schedule complete', async () => {
    const mock = createMockSupabase()
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createRequest({
      schedule_id: 'schedule-1',
      subscription_id: 'sub-1',
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toEqual({ id: 'progress-1' })
    expect(mock.subscriptionQuery.select).toHaveBeenCalledWith(
      'id,plan_id,bible_reading_plans!inner(is_active)'
    )
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('plan_id', 'plan-1')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('bible_reading_plans.is_active', true)
    expect(mock.progressQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: 'sub-1',
        schedule_id: 'schedule-1',
        is_completed: true,
      }),
      { onConflict: 'subscription_id,schedule_id' }
    )
  })
  it('rejects an inactive subscription before schedule lookup or progress upsert', async () => {
    const mock = createMockSupabase({
      subscriptionResult: { data: null, error: { code: 'PGRST116' } },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createRequest({
      schedule_id: 'schedule-1',
      subscription_id: 'inactive-sub',
    }))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Subscription not found')
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('is_active', true)
    expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
    expect(mock.progressQuery.upsert).not.toHaveBeenCalled()
  })

  it('rejects a subscription whose plan is inactive before schedule lookup or progress upsert', async () => {
    const mock = createMockSupabase({
      subscriptionResult: { data: null, error: { code: 'PGRST116' } },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createRequest({
      schedule_id: 'schedule-1',
      subscription_id: 'inactive-plan-sub',
    }))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Subscription not found')
    expect(mock.subscriptionQuery.select).toHaveBeenCalledWith(
      'id,plan_id,bible_reading_plans!inner(is_active)'
    )
    expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('bible_reading_plans.is_active', true)
    expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
    expect(mock.progressQuery.upsert).not.toHaveBeenCalled()
  })

  it('rejects a schedule outside the owned subscription plan before progress upsert', async () => {
    const mock = createMockSupabase({
      scheduleResult: { data: null, error: { code: 'PGRST116' } },
    })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createRequest({
      schedule_id: 'foreign-schedule',
      subscription_id: 'sub-1',
    }))
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.error).toBe('Schedule not found')
    expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('id', 'foreign-schedule')
    expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('plan_id', 'plan-1')
    expect(mock.progressQuery.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 and performs no database write when unauthenticated', async () => {
    const mock = createMockSupabase({ user: null })
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createRequest({
      schedule_id: 'schedule-1',
      subscription_id: 'sub-1',
    }))

    expect(response.status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('returns 400 and performs no table query when JSON body is malformed', async () => {
    const mock = createMockSupabase()
    createClientMock.mockResolvedValue(mock.supabase as never)

    const response = await POST(createMalformedJsonRequest())
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
    expect(mock.from).not.toHaveBeenCalled()
  })
})
