import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/notifications/friendActivity', () => ({
  notifyFollowersOfCompletion: vi.fn(),
}))

import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'
import { POST } from '../notifications/friend-activity/route'

type QueryResult = { data: unknown; error: unknown }

function createRequest(body: object): Request {
  return new Request('http://localhost/api/notifications/friend-activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/notifications/friend-activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

function createSelectQuery(result: QueryResult) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
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
  const progressQuery = createSelectQuery(progressResult)
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

const validBody = {
  activityType: 'reading',
  subscriptionId: 'sub-1',
  scheduleId: 'schedule-1',
}

describe('POST /api/notifications/friend-activity — object-ownership before notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 before body parsing and never notifies when unauthenticated', async () => {
      const mock = createMockSupabase({ user: null })
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRawRequest('not json at all'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(mock.from).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('body validation', () => {
    it('returns 400 for malformed JSON and never touches tables', async () => {
      const mock = createMockSupabase()
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRawRequest('{"activityType":'))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(mock.from).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it.each([
      ['null', 'null'],
      ['array', '[]'],
      ['string primitive', '"reading"'],
      ['number primitive', '5'],
    ])('returns 400 for top-level %s body', async (_label, rawBody) => {
      const mock = createMockSupabase()
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRawRequest(rawBody))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Request body must be an object')
      expect(mock.from).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it('rejects activityType "hasena" with 400 and never notifies', async () => {
      const mock = createMockSupabase()
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(
        createRequest({ activityType: 'hasena', subscriptionId: 'sub-1', scheduleId: 'schedule-1' })
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('activityType must be "reading"')
      expect(mock.from).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it.each([
      ['missing both', { activityType: 'reading' }],
      ['missing scheduleId', { activityType: 'reading', subscriptionId: 'sub-1' }],
      ['missing subscriptionId', { activityType: 'reading', scheduleId: 'schedule-1' }],
      ['blank subscriptionId', { activityType: 'reading', subscriptionId: '   ', scheduleId: 'schedule-1' }],
      ['blank scheduleId', { activityType: 'reading', subscriptionId: 'sub-1', scheduleId: '' }],
      ['non-string ids', { activityType: 'reading', subscriptionId: 1, scheduleId: 2 }],
    ])('returns 400 and never notifies when %s', async (_label, body) => {
      const mock = createMockSupabase()
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRequest(body))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('subscriptionId and scheduleId are required')
      expect(mock.from).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('object ownership', () => {
    it('returns 404 for a foreign/inactive subscription before schedule lookup or notify', async () => {
      const mock = createMockSupabase({
        subscriptionResult: { data: null, error: { code: 'PGRST116' } },
      })
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRequest(validBody))
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Subscription not found')
      expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(mock.subscriptionQuery.eq).toHaveBeenCalledWith('bible_reading_plans.is_active', true)
      expect(mock.from).not.toHaveBeenCalledWith('daily_schedules')
      expect(mock.from).not.toHaveBeenCalledWith('user_progress')
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it('returns 404 for a schedule outside the plan before progress lookup or notify', async () => {
      const mock = createMockSupabase({
        scheduleResult: { data: null, error: { code: 'PGRST116' } },
      })
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRequest(validBody))
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Schedule not found')
      expect(mock.scheduleQuery.eq).toHaveBeenCalledWith('plan_id', 'plan-1')
      expect(mock.from).not.toHaveBeenCalledWith('user_progress')
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it('returns 403 when the schedule has no completed progress and never notifies', async () => {
      const mock = createMockSupabase({
        progressResult: { data: null, error: { code: 'PGRST116' } },
      })
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRequest(validBody))
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Completed progress not found')
      expect(mock.progressQuery.eq).toHaveBeenCalledWith('subscription_id', 'sub-1')
      expect(mock.progressQuery.eq).toHaveBeenCalledWith('schedule_id', 'schedule-1')
      expect(mock.progressQuery.eq).toHaveBeenCalledWith('is_completed', true)
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('valid owned completion', () => {
    it('queues a reading notification only after full ownership + completion proof', async () => {
      const mock = createMockSupabase()
      createClientMock.mockResolvedValue(mock.supabase as never)

      const res = await POST(createRequest(validBody))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ status: 'queued' })
      expect(mock.subscriptionQuery.select).toHaveBeenCalledWith(
        'id,plan_id,bible_reading_plans!inner(is_active)'
      )
      expect(notifyFollowersOfCompletion).toHaveBeenCalledWith('user-1', 'reading')
    })
  })
})
