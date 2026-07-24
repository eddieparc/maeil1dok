import { describe, expect, it, vi } from 'vitest'
import {
  completeSchedule,
  getMonthlySchedules,
  getNextPosition,
  getSchedules,
  getTodaySchedules,
} from '@/repositories/bible/scheduleRepository'

describe('scheduleRepository', () => {
  it('gets schedules and merges completion status', async () => {
    const subQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'sub1' }, error: null }),
    }
    const scheduleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 's1', date: '2026-03-01', book: 'gen', start_chapter: 1, end_chapter: 2 },
          { id: 's2', date: '2026-03-02', book: 'gen', start_chapter: 3, end_chapter: 3 },
        ],
        error: null,
      }),
    }
    const progressQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ schedule_id: 's1', is_completed: true }],
        error: null,
      }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'plan_subscriptions') return subQuery
        if (table === 'daily_schedules') return scheduleQuery
        return progressQuery
      }),
    }

    const result = await getSchedules(supabase as never, 'u1', 1)

    expect(result.data).toEqual([
      expect.objectContaining({ id: 's1', is_completed: true }),
      expect.objectContaining({ id: 's2', is_completed: false }),
    ])
    expect(result.error).toBeNull()
  })

  it('filters schedules by month and today', async () => {
    const monthlyRows = [
      { id: 's1', date: '2026-03-01', book: 'gen', start_chapter: 1, end_chapter: 1 },
      { id: 's2', date: '2026-03-15', book: 'gen', start_chapter: 2, end_chapter: 2 },
    ]
    const todayRows = [{ id: 's2', date: '2026-03-15', book: 'gen', start_chapter: 2, end_chapter: 2 }]

    const monthlyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: monthlyRows, error: null }),
    }
    const todayQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: todayRows, error: null }),
    }
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(monthlyQuery)
        .mockReturnValueOnce(todayQuery),
    }

    const monthly = await getMonthlySchedules(supabase as never, 1, 2026, 3)
    const today = await getTodaySchedules(supabase as never, 1, '2026-03-15')

    expect(monthly.data).toEqual(monthlyRows)
    expect(today.data).toEqual(todayRows)
  })

  it('returns next unread position and completes schedule', async () => {
    const subscriptionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'sub1' }, error: null }),
    }
    const dailyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 's1', date: '2026-03-01', book: 'gen', start_chapter: 1, end_chapter: 1 },
          { id: 's2', date: '2026-03-02', book: 'gen', start_chapter: 2, end_chapter: 2 },
        ],
        error: null,
      }),
    }
    const progressQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ schedule_id: 's1', is_completed: true }],
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'plan_subscriptions') return subscriptionQuery
        if (table === 'daily_schedules') return dailyQuery
        return progressQuery
      }),
    }

    const next = await getNextPosition(supabase as never, 'u1', 1, '2026-03-01')
    const completed = await completeSchedule(supabase as never, 'sub1', 's1')

    expect(next.data).toEqual({ book: 'gen', chapter: 2, schedule_id: 's2' })
    expect(completed.data).toEqual({ success: true })
    expect(progressQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: 'sub1',
        schedule_id: 's1',
        is_completed: true,
      }),
      { onConflict: 'subscription_id,schedule_id' }
    )
  })
})
