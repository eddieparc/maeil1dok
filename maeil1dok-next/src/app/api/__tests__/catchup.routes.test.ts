import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NotFoundError } from '@/repositories/types/errors'
import * as catchupScheduling from '@/lib/catchup/scheduling'
import { POST as abandonPost } from '@/app/api/catchup/abandon/route'
import { POST as completePost } from '@/app/api/catchup/complete/route'
import { POST as createPost } from '@/app/api/catchup/create/route'
function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'user-1' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}
function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
function createRawRequest(rawBody: string): Request { return new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rawBody }) }
function createMalformedJsonRequest(): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"sessionId":',
  })
}
function createCatchupCreateMock(error: { code: string } | null, session = { id: 'session-1' }) {
  const dailySchedulesQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
  }
  dailySchedulesQuery.select.mockReturnValue(dailySchedulesQuery)
  dailySchedulesQuery.eq.mockReturnValue(dailySchedulesQuery)
  dailySchedulesQuery.lt.mockReturnValue(dailySchedulesQuery)
  dailySchedulesQuery.order.mockResolvedValue({
    data: [
      {
        id: 'missed-schedule-1',
        plan_id: 1,
        date: '2026-07-01',
        book: 'Genesis',
        start_chapter: 1,
        end_chapter: 1,
        audio_link: null,
        guide_link: null,
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    error: null,
  })
  const progressQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  }
  progressQuery.select.mockReturnValue(progressQuery)
  progressQuery.eq.mockReturnValue(progressQuery)
  progressQuery.in.mockResolvedValue({ data: [], error: null })
  const sessionInsert = vi.fn()
  const sessionSelect = vi.fn()
  const sessionSingle = vi.fn().mockResolvedValue({ data: error ? null : session, error })
  sessionInsert.mockReturnValue({ select: sessionSelect })
  sessionSelect.mockReturnValue({ single: sessionSingle })
  const catchupSessionsQuery = { insert: sessionInsert }
  const catchupSchedulesInsert = vi.fn().mockResolvedValue({ error: null })
  const supabase = {
    ...createMockSupabase(),
    from: vi.fn((table: string) => {
      if (table === 'daily_schedules') return dailySchedulesQuery
      if (table === 'user_progress') return progressQuery
      if (table === 'catchup_sessions') return catchupSessionsQuery
      if (table === 'catchup_schedules') return { insert: catchupSchedulesInsert }
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
  return { supabase, sessionInsert, sessionSelect, sessionSingle, catchupSchedulesInsert }
}
describe('Catchup API routes — object ownership before effect', () => {
  const getSessionById = vi.fn()
  const updateSessionStatus = vi.fn()
  const markScheduleComplete = vi.fn()
  const getSchedulesForSession = vi.fn()
  const SESSION_ID = '11111111-1111-4111-8111-111111111111'
  const FOREIGN_SESSION_ID = '22222222-2222-4222-8222-222222222222'
  const SCHEDULE_ID = '33333333-3333-4333-8333-333333333333'
  const FOREIGN_SCHEDULE_ID = '44444444-4444-4444-8444-444444444444'
  const VALID_DATE = '2026-07-08'
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerRepositories).mockReturnValue({
      catchup: { getSessionById, updateSessionStatus, markScheduleComplete, getSchedulesForSession },
    } as never)
  })
  describe('POST /api/catchup/abandon', () => {
    it('returns 401 and performs NO write when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)
      const res = await abandonPost(createRequest({ sessionId: SESSION_ID }))
      expect(res.status).toBe(401)
      expect(getSessionById).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it('returns 400 and performs NO repository access when JSON body is malformed', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await abandonPost(createMalformedJsonRequest())
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(getSessionById).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
      expect(markScheduleComplete).not.toHaveBeenCalled()
      expect(getSchedulesForSession).not.toHaveBeenCalled()
    })
    it.each(['null', '[]', '"not an object"', '42', 'true'])(
      'returns 400 must-be-an-object with no repository access for top-level body %s',
      async (rawBody) => {
        vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
        const res = await abandonPost(createRawRequest(rawBody))
        const json = await res.json()
        expect(res.status).toBe(400)
        expect(json.error).toBe('Request body must be an object')
        expect(createServerRepositories).not.toHaveBeenCalled()
        expect(getSessionById).not.toHaveBeenCalled()
        expect(updateSessionStatus).not.toHaveBeenCalled()
      }
    )
    it('returns 400 sessionId-required with no repository access when sessionId is omitted', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await abandonPost(createRequest({}))
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('sessionId is required')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(getSessionById).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it.each([
      ['blank string', { sessionId: '   ' }],
      ['non-UUID string', { sessionId: 'session-1' }],
      ['number', { sessionId: 42 }],
      ['boolean', { sessionId: true }],
      ['object', { sessionId: {} }],
      ['array', { sessionId: [] }],
      ['null', { sessionId: null }],
    ])('returns 400 sessionId-must-be-UUID with no repository access for %s', async (_label, body) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await abandonPost(createRequest(body))
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('sessionId must be a UUID')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(getSessionById).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it('returns 404 without a status write for a foreign/missing session', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      getSessionById.mockResolvedValue(null)
      const res = await abandonPost(createRequest({ sessionId: FOREIGN_SESSION_ID }))
      const json = await res.json()
      expect(res.status).toBe(404)
      expect(json.error).toBe('Session not found')
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it('maps repository NotFoundError to 404 (deny-by-default, no leak)', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      getSessionById.mockResolvedValue({ id: SESSION_ID, status: 'active' })
      updateSessionStatus.mockRejectedValue(new NotFoundError('Catchup session not found'))
      const res = await abandonPost(createRequest({ sessionId: SESSION_ID }))
      expect(res.status).toBe(404)
    })
    it('abandons an owned session', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      getSessionById.mockResolvedValue({ id: SESSION_ID, status: 'active' })
      updateSessionStatus.mockResolvedValue({ id: SESSION_ID, status: 'abandoned' })
      const res = await abandonPost(createRequest({ sessionId: SESSION_ID }))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.session.status).toBe('abandoned')
      expect(updateSessionStatus).toHaveBeenCalledWith(SESSION_ID, 'abandoned')
    })
    it.each(['completed', 'abandoned'])(
      'returns 404 without a status write when the session is already %s (terminal immutability)',
      async (terminalStatus) => {
        vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
        getSessionById.mockResolvedValue({ id: SESSION_ID, status: terminalStatus })
        const res = await abandonPost(createRequest({ sessionId: SESSION_ID }))
        const json = await res.json()
        expect(res.status).toBe(404)
        expect(json.error).toBe('Session not found')
        expect(updateSessionStatus).not.toHaveBeenCalled()
      }
    )
  })
  describe('POST /api/catchup/complete', () => {
    it('returns 401 and performs NO write when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)
      const res = await completePost(createRequest({ scheduleId: SCHEDULE_ID, date: VALID_DATE }))
      expect(res.status).toBe(401)
      expect(markScheduleComplete).not.toHaveBeenCalled()
    })
    it('returns 400 and performs NO repository access when JSON body is malformed', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await completePost(createMalformedJsonRequest())
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(getSessionById).not.toHaveBeenCalled()
      expect(markScheduleComplete).not.toHaveBeenCalled()
      expect(getSchedulesForSession).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it.each(['null', '[]', '"not an object"', '42', 'true'])(
      'returns 400 must-be-an-object with no repository access for top-level body %s',
      async (rawBody) => {
        vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
        const res = await completePost(createRawRequest(rawBody))
        const json = await res.json()
        expect(res.status).toBe(400)
        expect(json.error).toBe('Request body must be an object')
        expect(createServerRepositories).not.toHaveBeenCalled()
        expect(markScheduleComplete).not.toHaveBeenCalled()
      }
    )
    it('returns 400 scheduleId-required with no repository access when scheduleId is omitted', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await completePost(createRequest({ date: VALID_DATE }))
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('scheduleId is required')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markScheduleComplete).not.toHaveBeenCalled()
    })
    it.each([
      ['blank string', { scheduleId: '   ' }],
      ['non-UUID string', { scheduleId: 'schedule-1' }],
      ['number', { scheduleId: 42 }],
      ['boolean', { scheduleId: true }],
      ['object', { scheduleId: {} }],
      ['array', { scheduleId: [] }],
      ['null', { scheduleId: null }],
    ])('returns 400 scheduleId-must-be-UUID with no repository access for %s', async (_label, field) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await completePost(createRequest({ ...field, date: VALID_DATE }))
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('scheduleId must be a UUID')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markScheduleComplete).not.toHaveBeenCalled()
    })
    it.each([
      ['missing date', {}],
      ['blank string', { date: '   ' }],
      ['non-string', { date: 42 }],
      ['null', { date: null }],
      ['object', { date: {} }],
      ['array', { date: [] }],
      ['malformed', { date: '2026-7-1' }],
      ['datetime', { date: '2026-07-08T00:00:00Z' }],
      ['slashes', { date: '2026/07/08' }],
      ['invalid month', { date: '2026-13-01' }],
      ['invalid day', { date: '2026-04-31' }],
      ['impossible leap day', { date: '2026-02-29' }],
    ])('returns 400 date-must-be-YYYY-MM-DD with no repository access for %s', async (_label, field) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      const res = await completePost(createRequest({ scheduleId: SCHEDULE_ID, ...field }))
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('date must be YYYY-MM-DD')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markScheduleComplete).not.toHaveBeenCalled()
    })
    it('maps a foreign schedule NotFoundError to 404 without a session write', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      markScheduleComplete.mockRejectedValue(new NotFoundError('Catchup schedule not found'))
      const res = await completePost(createRequest({ scheduleId: FOREIGN_SCHEDULE_ID, date: VALID_DATE }))
      const json = await res.json()
      expect(res.status).toBe(404)
      expect(json.error).toBe('Catchup schedule not found')
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it('returns 404 for a schedule under a terminal session without touching session state', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      // Repository fails closed (NotFoundError) when the joined session is not active.
      markScheduleComplete.mockRejectedValue(new NotFoundError('Catchup schedule not found'))
      const res = await completePost(createRequest({ scheduleId: SCHEDULE_ID, date: VALID_DATE }))
      const json = await res.json()
      expect(res.status).toBe(404)
      expect(json.error).toBe('Catchup schedule not found')
      expect(getSchedulesForSession).not.toHaveBeenCalled()
      expect(updateSessionStatus).not.toHaveBeenCalled()
    })
    it('completes an owned schedule and completes the session when all done', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      markScheduleComplete.mockResolvedValue({ id: SCHEDULE_ID, isCompleted: true, sessionId: SESSION_ID })
      getSchedulesForSession.mockResolvedValue([{ id: SCHEDULE_ID, isCompleted: true }])
      updateSessionStatus.mockResolvedValue({ id: SESSION_ID, status: 'completed' })
      const res = await completePost(createRequest({ scheduleId: SCHEDULE_ID, date: VALID_DATE }))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.sessionStatus).toBe('completed')
      expect(updateSessionStatus).toHaveBeenCalledWith(SESSION_ID, 'completed')
    })
    it('accepts a valid leap-day date on a successful complete path', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      markScheduleComplete.mockResolvedValue({ id: SCHEDULE_ID, isCompleted: true, sessionId: SESSION_ID })
      getSchedulesForSession.mockResolvedValue([{ id: SCHEDULE_ID, isCompleted: false }])
      const res = await completePost(createRequest({ scheduleId: SCHEDULE_ID, date: '2024-02-29' }))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(json.sessionStatus).toBe('active')
      expect(markScheduleComplete).toHaveBeenCalledWith(SCHEDULE_ID)
    })
  })
  describe('POST /api/catchup/create', () => {
    const getUserSubscriptions = vi.fn()
    const getSessionsForSubscription = vi.fn()
    beforeEach(() => {
      getUserSubscriptions.mockResolvedValue([{ id: 'subscription-1', planId: 1 }])
      getSessionsForSubscription.mockResolvedValue([])
      vi.mocked(createServerRepositories).mockReturnValue({
        plan: { getUserSubscriptions },
        catchup: { getSessionsForSubscription },
      } as never)
    })
    function expectNoCreateEffects(mock: ReturnType<typeof createCatchupCreateMock>) {
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(getUserSubscriptions).not.toHaveBeenCalled()
      expect(getSessionsForSubscription).not.toHaveBeenCalled()
      expect(mock.supabase.from).not.toHaveBeenCalled()
      expect(mock.sessionInsert).not.toHaveBeenCalled()
      expect(mock.catchupSchedulesInsert).not.toHaveBeenCalled()
    }
    it('authenticates before parsing a malformed body and performs no writes for an anonymous request', async () => {
      const supabase = createMockSupabase(null)
      vi.mocked(createClient).mockResolvedValue(supabase as never)
      const res = await createPost(createMalformedJsonRequest())
      const json = await res.json()
      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(supabase.auth.getUser).toHaveBeenCalledOnce()
      expect(createServerRepositories).not.toHaveBeenCalled()
    })
    it('returns 400 without reads or writes when an authenticated request has malformed JSON', async () => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(createMalformedJsonRequest())
      const json = await res.json()
      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expectNoCreateEffects(mock)
    })
    it.each(['null', '[]', '"not an object"', '42', 'true'])(
      'returns 400 without writes when the authenticated request body is %s',
      async (rawBody) => {
        const mock = createCatchupCreateMock(null)
        vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
        const res = await createPost(createRawRequest(rawBody))
        expect(res.status).toBe(400)
        expect(mock.supabase.auth.getUser).toHaveBeenCalledOnce()
        expectNoCreateEffects(mock)
      }
    )
    it.each([
      ['planId omitted', { planId: undefined }], ['planId=0', { planId: 0 }], ['planId=-1', { planId: -1 }],
      ['planId=1.5', { planId: 1.5 }], ['planId="1"', { planId: '1' }], ['planId=null', { planId: null }], ['planId={}', { planId: {} }], ['planId=[]', { planId: [] }],
      ['targetDate omitted', { targetDate: undefined }], ['targetDate blank', { targetDate: '   ' }], ['targetDate=42', { targetDate: 42 }],
      ['targetDate datetime', { targetDate: '2026-07-31T12:00:00Z' }], ['targetDate short', { targetDate: '2026-7-1' }],
      ['targetDate invalid month', { targetDate: '2026-13-01' }], ['targetDate invalid day', { targetDate: '2026-04-31' }],
      ['strategy="other"', { strategy: 'other' }], ['strategy=42', { strategy: 42 }], ['strategy=null', { strategy: null }], ['strategy={}', { strategy: {} }], ['strategy=[]', { strategy: [] }],
      ['targetDate="2026-02-30"', { targetDate: '2026-02-30' }], ['targetDate="2026/07/31"', { targetDate: '2026/07/31' }],
      ['targetDate=null', { targetDate: null }], ['targetDate={}', { targetDate: {} }], ['targetDate=[]', { targetDate: [] }],
      ['maxDailyReadings=0', { maxDailyReadings: 0 }], ['maxDailyReadings=-1', { maxDailyReadings: -1 }],
      ['maxDailyReadings=1.5', { maxDailyReadings: 1.5 }], ['maxDailyReadings above PostgreSQL INTEGER max', { maxDailyReadings: 2_147_483_648 }],
      ['maxDailyReadings="3"', { maxDailyReadings: '3' }], ['maxDailyReadings=null', { maxDailyReadings: null }], ['maxDailyReadings={}', { maxDailyReadings: {} }], ['maxDailyReadings=[]', { maxDailyReadings: [] }],
      ['maxDailyChapters=0', { maxDailyChapters: 0 }], ['maxDailyChapters=-1', { maxDailyChapters: -1 }],
      ['maxDailyChapters=1.5', { maxDailyChapters: 1.5 }], ['maxDailyChapters above PostgreSQL INTEGER max', { maxDailyChapters: 2_147_483_648 }],
      ['maxDailyChapters="5"', { maxDailyChapters: '5' }], ['maxDailyChapters=null', { maxDailyChapters: null }], ['maxDailyChapters={}', { maxDailyChapters: {} }], ['maxDailyChapters=[]', { maxDailyChapters: [] }],
      ['weekendMultiplier=0', { weekendMultiplier: 0 }], ['weekendMultiplier=-1', { weekendMultiplier: -1 }],
      ['weekendMultiplier="1.5"', { weekendMultiplier: '1.5' }], ['weekendMultiplier=null', { weekendMultiplier: null }],
      ['weekendMultiplier={}', { weekendMultiplier: {} }], ['weekendMultiplier=[]', { weekendMultiplier: [] }],
    ])('returns 400 with no writes for invalid %s', async (_label, invalidField) => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(
        createRequest({
          planId: 1,
          targetDate: '2026-07-31',
          maxDailyReadings: 3,
          maxDailyChapters: 5,
          weekendMultiplier: 1.5,
          ...invalidField,
        })
      )
      expect(res.status).toBe(400)
      expect(mock.supabase.auth.getUser).toHaveBeenCalledOnce()
      expectNoCreateEffects(mock)
    })
    it.each([
      ['planId', '{"planId":1e309,"targetDate":"2026-07-31","maxDailyReadings":3,"maxDailyChapters":5,"weekendMultiplier":1.5}'],
      ['maxDailyReadings', '{"planId":1,"targetDate":"2026-07-31","maxDailyReadings":1e309,"maxDailyChapters":5,"weekendMultiplier":1.5}'],
      ['maxDailyChapters', '{"planId":1,"targetDate":"2026-07-31","maxDailyReadings":3,"maxDailyChapters":1e309,"weekendMultiplier":1.5}'],
      ['weekendMultiplier', '{"planId":1,"targetDate":"2026-07-31","maxDailyReadings":3,"maxDailyChapters":5,"weekendMultiplier":1e309}'],
    ])('returns 400 with no effects for raw non-finite %s', async (_field, rawBody) => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(createRawRequest(rawBody))
      expect(res.status).toBe(400)
      expect(mock.supabase.auth.getUser).toHaveBeenCalledOnce()
      expectNoCreateEffects(mock)
    })
    it('returns 403 without querying schedules or writing when the plan subscription is absent', async () => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      getUserSubscriptions.mockResolvedValue([])
      const res = await createPost(createRequest({ planId: 1, targetDate: '2026-07-31' }))
      expect(res.status).toBe(403)
      expect(createServerRepositories).toHaveBeenCalledOnce()
      expect(getUserSubscriptions).toHaveBeenCalledOnce()
      expect(getSessionsForSubscription).not.toHaveBeenCalled()
      expect(mock.supabase.from).not.toHaveBeenCalled()
      expect(mock.sessionInsert).not.toHaveBeenCalled()
      expect(mock.catchupSchedulesInsert).not.toHaveBeenCalled()
    })
    it('returns 409 without querying schedules or writing when an active session already exists', async () => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      getSessionsForSubscription.mockResolvedValue([{ id: 'active-1', status: 'active' }])
      const res = await createPost(createRequest({ planId: 1, targetDate: '2026-07-31' }))
      expect(res.status).toBe(409)
      expect(createServerRepositories).toHaveBeenCalledOnce()
      expect(getUserSubscriptions).toHaveBeenCalledOnce()
      expect(getSessionsForSubscription).toHaveBeenCalledWith('subscription-1')
      expect(mock.supabase.from).not.toHaveBeenCalled()
      expect(mock.sessionInsert).not.toHaveBeenCalled()
      expect(mock.catchupSchedulesInsert).not.toHaveBeenCalled()
    })
    it('uses the documented defaults and returns the created session summary', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'))
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(createRequest({ planId: 1, targetDate: '2026-07-31' }))
      const json = await res.json()
      expect(res.status).toBe(200)
      expect(mock.sessionInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'parallel',
          max_daily_readings: 3,
          max_daily_chapters: 5,
          weekend_multiplier: 1.5,
        })
      )
      expect(json).toEqual(
        expect.objectContaining({
          session: { id: 'session-1' },
          summary: expect.objectContaining({ totalDays: expect.any(Number), canComplete: expect.any(Boolean), remainingAfterTarget: expect.any(Number) }),
        })
      )
      vi.useRealTimers()
    })
    it('passes the target date to scheduling as local calendar midnight', async () => {
      const originalTimezone = process.env.TZ
      process.env.TZ = 'Asia/Seoul'
      const scheduleSpy = vi.spyOn(catchupScheduling, 'generateCatchupSchedule')
      try {
        const mock = createCatchupCreateMock(null)
        vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
        await createPost(createRequest({ planId: 1, targetDate: '2026-07-31' }))
        const [{ targetRejoinDate }] = scheduleSpy.mock.calls[0]
        expect(targetRejoinDate.getHours()).toBe(0)
      } finally {
        scheduleSpy.mockRestore()
        if (originalTimezone === undefined) delete process.env.TZ
        else process.env.TZ = originalTimezone
      }
    })
    it.each(['parallel', 'sequential'])('accepts the exact %s strategy', async (strategy) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'))
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(createRequest({ planId: 1, targetDate: '2026-07-31', strategy }))
      expect(res.status).toBe(200)
      expect(mock.sessionInsert).toHaveBeenCalledWith(expect.objectContaining({ strategy }))
      vi.useRealTimers()
    })
    it('accepts a provided positive fractional weekend multiplier', async () => {
      const mock = createCatchupCreateMock(null)
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(createRequest({ planId: 1, targetDate: '2026-07-31', weekendMultiplier: 1.25 }))
      expect(res.status).toBe(200)
      expect(mock.sessionInsert).toHaveBeenCalledWith(expect.objectContaining({ weekend_multiplier: 1.25 }))
    })
    it('returns 409 with the active-session error and creates no schedule rows when the insert conflicts', async () => {
      const mock = createCatchupCreateMock({ code: '23505' })
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(
        createRequest({ planId: 1, targetDate: '2026-07-31', maxDailyReadings: 3, maxDailyChapters: 5, weekendMultiplier: 1.5 })
      )
      const json = await res.json()
      expect(res.status).toBe(409)
      expect(json.error).toBe('Active catchup session already exists')
      expect(mock.catchupSchedulesInsert).not.toHaveBeenCalled()
    })
    it('keeps the existing 500 response and creates no schedule rows for a non-conflict insert error', async () => {
      const mock = createCatchupCreateMock({ code: 'PGRST000' })
      vi.mocked(createClient).mockResolvedValue(mock.supabase as never)
      const res = await createPost(
        createRequest({ planId: 1, targetDate: '2026-07-31', maxDailyReadings: 3, maxDailyChapters: 5, weekendMultiplier: 1.5 })
      )
      const json = await res.json()
      expect(res.status).toBe(500)
      expect(json.error).toBe('Failed to create catchup session')
      expect(mock.catchupSchedulesInsert).not.toHaveBeenCalled()
    })
  })
})
