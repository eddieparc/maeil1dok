import type { DailySchedule } from '@/types'

type DailyBibleSchedule = DailySchedule

export interface CatchupScheduleInput {
  missedSchedules: DailyBibleSchedule[]
  strategy: 'parallel' | 'sequential'
  targetRejoinDate: Date
  maxDailyReadings: number
  maxDailyChapters: number
  weekendMultiplier: number
  startDate: Date
}

export interface DailyAllocation {
  date: Date
  schedules: DailyBibleSchedule[]
  isWeekend: boolean
  totalChapters: number
}

export interface CatchupScheduleOutput {
  days: DailyAllocation[]
  totalDays: number
  canComplete: boolean
  remainingAfterTarget: DailyBibleSchedule[]
}

interface DayState extends DailyAllocation {
  maxReadings: number
  maxChapters: number
}

const DAY_START_HOUR = 0
const DAY_END_HOUR = 23

function normalizeStartOfDay(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(DAY_START_HOUR, 0, 0, 0)
  return normalized
}

function normalizeEndOfDay(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(DAY_END_HOUR, 59, 59, 999)
  return normalized
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function getScaledLimit(base: number, weekend: boolean, weekendMultiplier: number): number {
  if (base <= 0) return 0
  if (!weekend) return base
  return Math.max(0, Math.floor(base * weekendMultiplier))
}

function getChapterCount(schedule: DailyBibleSchedule): number {
  const chapterCount = schedule.endChapter - schedule.startChapter + 1
  return chapterCount > 0 ? chapterCount : 1
}

function toDayStates(input: CatchupScheduleInput): DayState[] {
  const start = normalizeStartOfDay(input.startDate)
  const target = normalizeEndOfDay(input.targetRejoinDate)

  if (start > target) {
    return []
  }

  const days: DayState[] = []
  const cursor = new Date(start)

  while (cursor <= target) {
    const weekend = isWeekend(cursor)

    days.push({
      date: new Date(cursor),
      schedules: [],
      isWeekend: weekend,
      totalChapters: 0,
      maxReadings: getScaledLimit(input.maxDailyReadings, weekend, input.weekendMultiplier),
      maxChapters: getScaledLimit(input.maxDailyChapters, weekend, input.weekendMultiplier),
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function canFitSchedule(day: DayState, schedule: DailyBibleSchedule): boolean {
  if (day.maxReadings <= 0 || day.maxChapters <= 0) return false
  if (day.schedules.length >= day.maxReadings) return false

  const chapters = getChapterCount(schedule)
  return day.totalChapters + chapters <= day.maxChapters
}

function toOutput(days: DayState[], remaining: DailyBibleSchedule[]): CatchupScheduleOutput {
  const scheduledDays: DailyAllocation[] = days
    .filter((day) => day.schedules.length > 0)
    .map((day) => ({
      date: day.date,
      schedules: day.schedules,
      isWeekend: day.isWeekend,
      totalChapters: day.totalChapters,
    }))

  return {
    days: scheduledDays,
    totalDays: scheduledDays.length,
    canComplete: remaining.length === 0,
    remainingAfterTarget: remaining,
  }
}

function sortSchedulesByDate(schedules: DailyBibleSchedule[]): DailyBibleSchedule[] {
  return [...schedules].sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()

    if (dateA !== dateB) {
      return dateA - dateB
    }

    return a.id.localeCompare(b.id)
  })
}

function buildSequentialQueue(schedules: DailyBibleSchedule[]): DailyBibleSchedule[] {
  const ordered = sortSchedulesByDate(schedules)
  const planOrder: number[] = []
  const byPlan = new Map<number, DailyBibleSchedule[]>()

  for (const schedule of ordered) {
    if (!byPlan.has(schedule.planId)) {
      byPlan.set(schedule.planId, [])
      planOrder.push(schedule.planId)
    }

    byPlan.get(schedule.planId)?.push(schedule)
  }

  return planOrder.flatMap((planId) => byPlan.get(planId) ?? [])
}

function distributeParallel(
  schedules: DailyBibleSchedule[],
  days: DayState[]
): CatchupScheduleOutput {
  const remaining = sortSchedulesByDate(schedules)

  while (remaining.length > 0) {
    let assignedInRound = false

    for (const day of days) {
      if (remaining.length === 0) break

      const nextSchedule = remaining[0]
      if (!canFitSchedule(day, nextSchedule)) {
        continue
      }

      day.schedules.push(nextSchedule)
      day.totalChapters += getChapterCount(nextSchedule)
      remaining.shift()
      assignedInRound = true
    }

    if (!assignedInRound) {
      break
    }
  }

  return toOutput(days, remaining)
}

function distributeSequential(
  schedules: DailyBibleSchedule[],
  days: DayState[]
): CatchupScheduleOutput {
  const remaining = buildSequentialQueue(schedules)

  for (const day of days) {
    while (remaining.length > 0) {
      const nextSchedule = remaining[0]
      if (!canFitSchedule(day, nextSchedule)) {
        break
      }

      day.schedules.push(nextSchedule)
      day.totalChapters += getChapterCount(nextSchedule)
      remaining.shift()
    }
  }

  return toOutput(days, remaining)
}

export function generateCatchupSchedule(input: CatchupScheduleInput): CatchupScheduleOutput {
  const { missedSchedules, strategy } = input

  if (missedSchedules.length === 0) {
    return {
      days: [],
      totalDays: 0,
      canComplete: true,
      remainingAfterTarget: [],
    }
  }

  const days = toDayStates(input)
  if (days.length === 0) {
    return {
      days: [],
      totalDays: 0,
      canComplete: false,
      remainingAfterTarget: sortSchedulesByDate(missedSchedules),
    }
  }

  if (strategy === 'parallel') {
    return distributeParallel(missedSchedules, days)
  }

  return distributeSequential(missedSchedules, days)
}
