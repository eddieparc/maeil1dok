import { describe, expect, it } from 'vitest'

import { generateCatchupSchedule } from '../scheduling'
import type { DailySchedule } from '@/types'

function createDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function createSchedule(
  id: string,
  options: {
    planId?: number
    date?: string
    startChapter?: number
    endChapter?: number
  } = {}
): DailySchedule {
  const {
    planId = 1,
    date = '2026-03-01',
    startChapter = 1,
    endChapter = startChapter,
  } = options

  return {
    id,
    planId,
    date,
    book: 'Genesis',
    startChapter,
    endChapter,
    audioLink: null,
    guideLink: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function createInput(overrides: Partial<Parameters<typeof generateCatchupSchedule>[0]> = {}) {
  return {
    missedSchedules: [],
    strategy: 'parallel' as const,
    targetRejoinDate: createDate('2026-03-05'),
    maxDailyReadings: 3,
    maxDailyChapters: 10,
    weekendMultiplier: 1,
    startDate: createDate('2026-03-01'),
    ...overrides,
  }
}

describe('generateCatchupSchedule', () => {
  it('returns empty output for no missed schedules', () => {
    const result = generateCatchupSchedule(createInput())

    expect(result).toEqual({
      days: [],
      totalDays: 0,
      canComplete: true,
      remainingAfterTarget: [],
    })
  })

  it('parallel strategy distributes readings evenly across available days', () => {
    const missedSchedules = Array.from({ length: 6 }, (_, index) => createSchedule(`s-${index + 1}`))

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'parallel',
        startDate: createDate('2026-03-02'),
        targetRejoinDate: createDate('2026-03-04'),
        maxDailyReadings: 4,
        maxDailyChapters: 20,
      })
    )

    expect(result.canComplete).toBe(true)
    expect(result.days).toHaveLength(3)
    expect(result.days.map((day) => day.schedules.length)).toEqual([2, 2, 2])
  })

  it('parallel strategy respects maxDailyReadings limit', () => {
    const missedSchedules = Array.from({ length: 5 }, (_, index) => createSchedule(`s-${index + 1}`))

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'parallel',
        startDate: createDate('2026-03-02'),
        targetRejoinDate: createDate('2026-03-04'),
        maxDailyReadings: 2,
        maxDailyChapters: 20,
      })
    )

    expect(result.days.map((day) => day.schedules.length)).toEqual([2, 2, 1])
  })

  it('weekend multiplier increases weekend daily limits', () => {
    const missedSchedules = Array.from({ length: 3 }, (_, index) => createSchedule(`s-${index + 1}`))

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'parallel',
        startDate: createDate('2026-03-06'),
        targetRejoinDate: createDate('2026-03-07'),
        maxDailyReadings: 1,
        maxDailyChapters: 5,
        weekendMultiplier: 2,
      })
    )

    expect(result.canComplete).toBe(true)
    expect(result.days).toHaveLength(2)
    expect(result.days[0].isWeekend).toBe(false)
    expect(result.days[1].isWeekend).toBe(true)
    expect(result.days[0].schedules).toHaveLength(1)
    expect(result.days[1].schedules).toHaveLength(2)
  })

  it('sequential strategy completes one plan at a time in order', () => {
    const missedSchedules = [
      createSchedule('p1-a', { planId: 1, date: '2026-03-01' }),
      createSchedule('p2-a', { planId: 2, date: '2026-03-02' }),
      createSchedule('p1-b', { planId: 1, date: '2026-03-03' }),
      createSchedule('p2-b', { planId: 2, date: '2026-03-04' }),
    ]

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'sequential',
        startDate: createDate('2026-03-10'),
        targetRejoinDate: createDate('2026-03-11'),
        maxDailyReadings: 2,
        maxDailyChapters: 10,
      })
    )

    const orderedIds = result.days.flatMap((day) => day.schedules.map((schedule) => schedule.id))
    expect(orderedIds).toEqual(['p1-a', 'p1-b', 'p2-a', 'p2-b'])
  })

  it('handles rejoin date before startDate as non-completable', () => {
    const missedSchedules = [createSchedule('s-1'), createSchedule('s-2')]

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        startDate: createDate('2026-03-10'),
        targetRejoinDate: createDate('2026-03-09'),
      })
    )

    expect(result.days).toEqual([])
    expect(result.totalDays).toBe(0)
    expect(result.canComplete).toBe(false)
    expect(result.remainingAfterTarget.map((schedule) => schedule.id)).toEqual(['s-1', 's-2'])
  })

  it('sets canComplete to false when capacity is insufficient', () => {
    const missedSchedules = Array.from({ length: 8 }, (_, index) => createSchedule(`s-${index + 1}`))

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'parallel',
        startDate: createDate('2026-03-02'),
        targetRejoinDate: createDate('2026-03-03'),
        maxDailyReadings: 2,
        maxDailyChapters: 10,
      })
    )

    expect(result.canComplete).toBe(false)
    expect(result.remainingAfterTarget).toHaveLength(4)
  })

  it('handles single missed schedule correctly', () => {
    const result = generateCatchupSchedule(
      createInput({
        missedSchedules: [createSchedule('single-1')],
        strategy: 'parallel',
      })
    )

    expect(result.canComplete).toBe(true)
    expect(result.totalDays).toBe(1)
    expect(result.days[0].schedules[0].id).toBe('single-1')
  })

  it('handles 30 missed schedules within a 5-day target window', () => {
    const missedSchedules = Array.from({ length: 30 }, (_, index) => createSchedule(`s-${index + 1}`))

    const result = generateCatchupSchedule(
      createInput({
        missedSchedules,
        strategy: 'parallel',
        startDate: createDate('2026-03-02'),
        targetRejoinDate: createDate('2026-03-06'),
        maxDailyReadings: 6,
        maxDailyChapters: 20,
      })
    )

    expect(result.canComplete).toBe(true)
    expect(result.days).toHaveLength(5)
    expect(result.days.map((day) => day.schedules.length)).toEqual([6, 6, 6, 6, 6])
    expect(result.remainingAfterTarget).toEqual([])
  })
})
