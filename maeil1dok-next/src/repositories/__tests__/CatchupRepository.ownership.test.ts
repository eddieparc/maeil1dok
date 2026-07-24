import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCatchupRepository } from '@/repositories/implementations/SupabaseCatchupRepository'
import { AuthError, NotFoundError } from '@/repositories/types/errors'

const PGRST116 = { code: 'PGRST116', message: 'No rows found' }

function createMockSupabase(userId: string | null = 'current-user') {
  const chainableQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  const from = vi.fn().mockReturnValue(chainableQuery)
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: userId ? { id: userId } : null },
      error: null,
    }),
  }

  return { from, auth, chainableQuery }
}

const sessionRow = {
  id: 'session-1',
  subscription_id: 'sub-1',
  name: 'catchup',
  range_start: '2026-01-01',
  range_end: '2026-01-05',
  strategy: 'parallel',
  target_rejoin_date: '2026-01-10',
  max_daily_readings: 3,
  max_daily_chapters: 5,
  weekend_multiplier: 1.5,
  status: 'active',
  completed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const scheduleRow = {
  id: 'schedule-1',
  session_id: 'session-1',
  original_schedule_id: 42,
  scheduled_date: '2026-01-02',
  is_completed: false,
  completed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('SupabaseCatchupRepository — object-ownership through subscription FK chain', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseCatchupRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseCatchupRepository(mockSupabase as never)
  })

  describe('getSessionById', () => {
    it('scopes the read to the authenticated owner via plan_subscriptions.user_id', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({ data: sessionRow, error: null })

      const result = await repo.getSessionById('session-1')

      expect(result?.id).toBe('session-1')
      expect(mockSupabase.from).toHaveBeenCalledWith('catchup_sessions')
      expect(mockSupabase.chainableQuery.select).toHaveBeenCalledWith('*, plan_subscriptions!inner(user_id)')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('id', 'session-1')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('plan_subscriptions.user_id', 'current-user')
    })

    it('returns null for a session that exists but belongs to another user (no ownership leak)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({ data: null, error: PGRST116 })

      const result = await repo.getSessionById('someone-elses-session')

      expect(result).toBeNull()
    })

    it('throws AuthError and performs NO query when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(repo.getSessionById('session-1')).rejects.toBeInstanceOf(AuthError)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('updateSessionStatus', () => {
    it('verifies ownership then scopes the write to id AND owned subscription', async () => {
      mockSupabase.chainableQuery.single
        .mockResolvedValueOnce({ data: sessionRow, error: null })
        .mockResolvedValueOnce({ data: { ...sessionRow, status: 'abandoned' }, error: null })

      const result = await repo.updateSessionStatus('session-1', 'abandoned')

      expect(result.status).toBe('abandoned')
      expect(mockSupabase.chainableQuery.update).toHaveBeenCalledWith({
        status: 'abandoned',
        completed_at: null,
      })
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('id', 'session-1')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('subscription_id', 'sub-1')
    })

    it('sets completed_at when transitioning an active session to completed', async () => {
      mockSupabase.chainableQuery.single
        .mockResolvedValueOnce({ data: sessionRow, error: null })
        .mockResolvedValueOnce({ data: { ...sessionRow, status: 'completed' }, error: null })

      await repo.updateSessionStatus('session-1', 'completed')

      const payload = mockSupabase.chainableQuery.update.mock.calls[0][0]
      expect(payload.status).toBe('completed')
      expect(typeof payload.completed_at).toBe('string')
      expect(payload.completed_at).not.toBe('')
    })

    it('clears completed_at when abandoning (terminal timestamp never lingers)', async () => {
      mockSupabase.chainableQuery.single
        .mockResolvedValueOnce({ data: sessionRow, error: null })
        .mockResolvedValueOnce({ data: { ...sessionRow, status: 'abandoned' }, error: null })

      await repo.updateSessionStatus('session-1', 'abandoned')

      const payload = mockSupabase.chainableQuery.update.mock.calls[0][0]
      expect(payload.completed_at).toBeNull()
    })

    it.each(['completed', 'abandoned'] as const)(
      'throws NotFoundError and performs NO write when the owned session is already %s',
      async (terminalStatus) => {
        mockSupabase.chainableQuery.single.mockResolvedValueOnce({
          data: { ...sessionRow, status: terminalStatus },
          error: null,
        })

        await expect(repo.updateSessionStatus('session-1', 'abandoned')).rejects.toBeInstanceOf(
          NotFoundError
        )
        expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
      }
    )

    it('throws NotFoundError and performs NO write for a foreign session (IDOR denied)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValueOnce({ data: null, error: PGRST116 })

      await expect(repo.updateSessionStatus('foreign-session', 'abandoned')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
    })

    it('throws AuthError and performs NO write when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      await expect(repo.updateSessionStatus('session-1', 'abandoned')).rejects.toBeInstanceOf(AuthError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
    })
  })

  describe('markScheduleComplete', () => {
    it('verifies ownership via nested session/subscription chain then scopes the write', async () => {
      mockSupabase.chainableQuery.single
        .mockResolvedValueOnce({ data: scheduleRow, error: null })
        .mockResolvedValueOnce({ data: { ...scheduleRow, is_completed: true }, error: null })

      const result = await repo.markScheduleComplete('schedule-1')

      expect(result.isCompleted).toBe(true)
      expect(mockSupabase.chainableQuery.select).toHaveBeenCalledWith(
        '*, catchup_sessions!inner(subscription_id, plan_subscriptions!inner(user_id))'
      )
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith(
        'catchup_sessions.plan_subscriptions.user_id',
        'current-user'
      )
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('catchup_sessions.status', 'active')
      expect(mockSupabase.chainableQuery.eq).toHaveBeenCalledWith('session_id', 'session-1')
    })

    it('throws NotFoundError and performs NO write for a foreign schedule (IDOR denied)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValueOnce({ data: null, error: PGRST116 })

      await expect(repo.markScheduleComplete('foreign-schedule')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
    })
  })

  describe('markScheduleIncomplete', () => {
    it('throws NotFoundError and performs NO write for a foreign schedule (IDOR denied)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValueOnce({ data: null, error: PGRST116 })

      await expect(repo.markScheduleIncomplete('foreign-schedule')).rejects.toBeInstanceOf(NotFoundError)
      expect(mockSupabase.chainableQuery.update).not.toHaveBeenCalled()
    })
  })
})
