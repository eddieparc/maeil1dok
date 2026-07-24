import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseScheduleRepository } from '@/repositories/implementations/SupabaseScheduleRepository'
import { NetworkError } from '@/repositories/types/errors'
import type { DailySchedule } from '@/types'

const now = '2026-01-01T00:00:00.000Z'

const scheduleRow = {
  id: 'schedule-1',
  plan_id: 7,
  date: '2026-07-01',
  book: '창세기',
  start_chapter: 1,
  end_chapter: 3,
  audio_link: null,
  guide_link: null,
  created_at: now,
}

const expectedSchedule: DailySchedule = {
  id: 'schedule-1',
  planId: 7,
  date: '2026-07-01',
  book: '창세기',
  startChapter: 1,
  endChapter: 3,
  audioLink: null,
  guideLink: null,
  createdAt: now,
}

describe('SupabaseScheduleRepository — getSchedulesForPlans (bulk)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createMock(result?: { data: unknown; error: unknown }) {
    const order = vi.fn().mockResolvedValue(result ?? { data: [scheduleRow], error: null })
    const lte = vi.fn().mockReturnValue({ order })
    const gte = vi.fn().mockReturnValue({ lte })
    const inFn = vi.fn().mockReturnValue({ gte })
    const select = vi.fn().mockReturnValue({ in: inFn })
    const from = vi.fn().mockReturnValue({ select })
    return { from, select, inFn, gte, lte, order }
  }

  it('returns [] without touching the table for empty plan IDs', async () => {
    const mock = createMock()
    const repo = new SupabaseScheduleRepository(mock as never)

    const result = await repo.getSchedulesForPlans([], '2026-07-01', '2026-07-31')

    expect(result).toEqual([])
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('queries daily_schedules with de-duplicated plan ids and the date range', async () => {
    const mock = createMock()
    const repo = new SupabaseScheduleRepository(mock as never)

    const result = await repo.getSchedulesForPlans([7, 7, 9], '2026-07-01', '2026-07-31')

    expect(mock.from).toHaveBeenCalledWith('daily_schedules')
    expect(mock.inFn).toHaveBeenCalledWith('plan_id', [7, 9])
    expect(mock.gte).toHaveBeenCalledWith('date', '2026-07-01')
    expect(mock.lte).toHaveBeenCalledWith('date', '2026-07-31')
    expect(result).toEqual([expectedSchedule])
  })

  it('throws NetworkError when Supabase returns an error', async () => {
    const mock = createMock({ data: null, error: { message: 'boom' } })
    const repo = new SupabaseScheduleRepository(mock as never)

    await expect(
      repo.getSchedulesForPlans([7], '2026-07-01', '2026-07-31'),
    ).rejects.toBeInstanceOf(NetworkError)
  })
})
