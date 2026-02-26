import { describe, it, expect } from 'vitest'
import { determineCardType } from '../ReadingCardStack.utils'
import type { DailySchedule } from '@/types/schedule'
import type { UserProgress } from '@/types/progress'
import type { PastIncompleteData } from '../ReadingCardStack.utils'

const mockSchedule: DailySchedule = {
  id: 'schedule-1',
  planId: 1,
  date: '2026-02-26',
  book: '창세기',
  startChapter: 1,
  endChapter: 3,
  audioLink: null,
  guideLink: null,
  createdAt: '2026-01-01T00:00:00Z',
}

const mockProgress: UserProgress = {
  id: 'progress-1',
  subscriptionId: 'sub-1',
  scheduleId: 'schedule-1',
  isCompleted: true,
  completedAt: '2026-02-26T10:00:00Z',
  createdAt: '2026-02-26T10:00:00Z',
  updatedAt: '2026-02-26T10:00:00Z',
}

const mockPastIncomplete: PastIncompleteData = {
  date: '2026-02-25',
  schedule: mockSchedule,
}

describe('determineCardType', () => {
  it('returns "login" when isAuthenticated is false', () => {
    const result = determineCardType({
      isAuthenticated: false,
      todaySchedule: null,
      todayProgress: null,
      pastIncomplete: null,
    })
    expect(result).toBe('login')
  })

  it('returns "allDone" when authenticated with no todaySchedule and no pastIncomplete', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: null,
      todayProgress: null,
      pastIncomplete: null,
    })
    expect(result).toBe('allDone')
  })

  it('returns "main" when authenticated with todaySchedule but no progress and no pastIncomplete', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: mockSchedule,
      todayProgress: null,
      pastIncomplete: null,
    })
    expect(result).toBe('main')
  })

  it('returns "allDone" when authenticated with completed todayProgress and no pastIncomplete', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: mockSchedule,
      todayProgress: mockProgress,
      pastIncomplete: null,
    })
    expect(result).toBe('allDone')
  })

  it('returns "pastIncomplete" when authenticated with no todaySchedule but has pastIncomplete', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: null,
      todayProgress: null,
      pastIncomplete: mockPastIncomplete,
    })
    expect(result).toBe('pastIncomplete')
  })

  it('returns "pastIncomplete" when authenticated with todaySchedule but has pastIncomplete', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: mockSchedule,
      todayProgress: null,
      pastIncomplete: mockPastIncomplete,
    })
    expect(result).toBe('pastIncomplete')
  })
})

  it('returns "hasena" when authenticated with no todaySchedule and hasenaCompleted is false', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: null,
      todayProgress: null,
      pastIncomplete: null,
      hasenaCompleted: false,
    })
    expect(result).toBe('hasena')
  })

  it('returns "intro" when authenticated with no todaySchedule and introAvailable is true but introCompleted is false', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: null,
      todayProgress: null,
      pastIncomplete: null,
      hasenaCompleted: true,
      introAvailable: true,
      introCompleted: false,
    })
    expect(result).toBe('intro')
  })

  it('returns "hasena" when authenticated with todaySchedule and hasenaCompleted is false', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: mockSchedule,
      todayProgress: null,
      pastIncomplete: null,
      hasenaCompleted: false,
    })
    expect(result).toBe('hasena')
  })

  it('returns "intro" when authenticated with todaySchedule and introAvailable is true but introCompleted is false', () => {
    const result = determineCardType({
      isAuthenticated: true,
      todaySchedule: mockSchedule,
      todayProgress: null,
      pastIncomplete: null,
      hasenaCompleted: true,
      introAvailable: true,
      introCompleted: false,
    })
    expect(result).toBe('intro')
  })
