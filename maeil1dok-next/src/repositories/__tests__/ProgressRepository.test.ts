import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseProgressRepository } from '@/repositories/implementations/SupabaseProgressRepository'
import type { UserProgress } from '@/types'

function createMockSupabase() {
  const mockFrom = vi.fn()
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  }

  const chainableQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    upsert: vi.fn().mockReturnThis(),
  }

  mockFrom.mockReturnValue(chainableQuery)

  return {
    from: mockFrom,
    auth: mockAuth,
    chainableQuery,
  }
}

const now = '2026-01-01T00:00:00.000Z'

const mockProgressRow = {
  id: 'progress-1',
  subscription_id: 'sub-1',
  schedule_id: 'schedule-1',
  is_completed: true,
  completed_at: now,
  created_at: now,
  updated_at: now,
}

const expectedProgress: UserProgress = {
  id: 'progress-1',
  subscriptionId: 'sub-1',
  scheduleId: 'schedule-1',
  isCompleted: true,
  completedAt: now,
  createdAt: now,
  updatedAt: now,
}

describe('SupabaseProgressRepository', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseProgressRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseProgressRepository(mockSupabase as any)
  })

  describe('getProgress', () => {
    it('returns null when progress not found (PGRST116)', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      const result = await repo.getProgress('sub-1', 'schedule-1')
      expect(result).toBeNull()
    })

    it('returns UserProgress when found', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: mockProgressRow,
        error: null,
      })

      const result = await repo.getProgress('sub-1', 'schedule-1')
      expect(result).toEqual(expectedProgress)
    })

    it('throws NetworkError on database error', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: null,
        error: { code: '500', message: 'Database error' },
      })

      await expect(repo.getProgress('sub-1', 'schedule-1')).rejects.toThrow('Database error')
    })
  })

  describe('markComplete', () => {
    it('creates progress record marked as complete', async () => {
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: mockProgressRow,
        error: null,
      })

      const result = await repo.markComplete('sub-1', 'schedule-1')

      expect(result.isCompleted).toBe(true)
      expect(result.scheduleId).toBe('schedule-1')
      expect(result.subscriptionId).toBe('sub-1')
      expect(mockSupabase.chainableQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ is_completed: true }),
        expect.objectContaining({ onConflict: 'subscription_id,schedule_id' })
      )
    })
  })

  describe('markIncomplete', () => {
    it('toggles is_completed to false', async () => {
      const incompleteRow = { ...mockProgressRow, is_completed: false, completed_at: null }
      mockSupabase.chainableQuery.single.mockResolvedValue({
        data: incompleteRow,
        error: null,
      })

      const result = await repo.markIncomplete('sub-1', 'schedule-1')

      expect(result.isCompleted).toBe(false)
      expect(result.completedAt).toBeNull()
      expect(mockSupabase.chainableQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ is_completed: false, completed_at: null }),
        expect.objectContaining({ onConflict: 'subscription_id,schedule_id' })
      )
    })
  })

  describe('getProgressForSubscription', () => {
    it('returns all progress for a subscription', async () => {
      mockSupabase.chainableQuery.order = vi.fn().mockResolvedValue({
        data: [mockProgressRow, { ...mockProgressRow, id: 'progress-2' }],
        error: null,
      })

      const result = await repo.getProgressForSubscription('sub-1')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(expectedProgress)
    })
  })

  describe('getProgressSummary', () => {
    it('returns correct counts with streak from profile', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })

      const progressList = [{ is_completed: true }, { is_completed: true }, { is_completed: false }]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_progress') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: progressList, error: null }),
          }
        }

        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { current_streak: 5, longest_streak: 10 },
              error: null,
            }),
          }
        }

        return mockSupabase.chainableQuery
      })

      const result = await repo.getProgressSummary('sub-1')
      expect(result.totalDays).toBe(3)
      expect(result.completedDays).toBe(2)
      expect(result.currentStreak).toBe(5)
      expect(result.longestStreak).toBe(10)
    })
  })

  describe('bulkGetProgress', () => {
    it('returns empty array for empty scheduleIds', async () => {
      const result = await repo.bulkGetProgress('sub-1', [])
      expect(result).toEqual([])
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('fetches progress for given schedule IDs', async () => {
      mockSupabase.chainableQuery.in = vi.fn().mockResolvedValue({
        data: [mockProgressRow],
        error: null,
      })

      const result = await repo.bulkGetProgress('sub-1', ['schedule-1'])
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expectedProgress)
    })
  })
})
