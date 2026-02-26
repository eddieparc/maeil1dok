import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateCalendarDates } from '../generateCalendarDates'

describe('generateCalendarDates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('always returns exactly 42 dates', () => {
    const result = generateCalendarDates(2026, 2)
    expect(result).toHaveLength(42)
  })

  it('first date is Sunday of the week containing the 1st', () => {
    // February 2026 starts on Sunday (Feb 1 is Sunday)
    const result = generateCalendarDates(2026, 2)
    const firstDate = result[0].date
    expect(firstDate.getDay()).toBe(0) // Sunday
    expect(firstDate.getMonth()).toBe(1) // February (0-indexed)
    expect(firstDate.getDate()).toBe(1)
  })

  it('marks correct dates as isCurrentMonth for February 2026', () => {
    const result = generateCalendarDates(2026, 2)
    const februaryDates = result.filter((d) => d.isCurrentMonth)
    // February 2026 has 28 days
    expect(februaryDates).toHaveLength(28)
    februaryDates.forEach((d) => {
      expect(d.date.getMonth()).toBe(1) // February (0-indexed)
    })
  })

  it('marks dates from other months as not isCurrentMonth', () => {
    const result = generateCalendarDates(2026, 2)
    const otherMonthDates = result.filter((d) => !d.isCurrentMonth)
    otherMonthDates.forEach((d) => {
      expect(d.date.getMonth()).not.toBe(1) // Not February
    })
  })

  it('marks today correctly when in current month', () => {
    // Set fake time to February 26, 2026
    const fakeToday = new Date(2026, 1, 26) // Month is 0-indexed
    vi.setSystemTime(fakeToday)

    const result = generateCalendarDates(2026, 2)
    const todayDate = result.find((d) => d.isToday)

    expect(todayDate).toBeDefined()
    expect(todayDate?.date.getDate()).toBe(26)
    expect(todayDate?.date.getMonth()).toBe(1)
    expect(todayDate?.date.getFullYear()).toBe(2026)
  })

  it('generates correct dateStr format (YYYY-MM-DD)', () => {
    const result = generateCalendarDates(2026, 2)
    result.forEach((d) => {
      expect(d.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const [year, month, day] = d.dateStr.split('-').map(Number)
      expect(year).toBe(d.date.getFullYear())
      expect(month).toBe(d.date.getMonth() + 1)
      expect(day).toBe(d.date.getDate())
    })
  })
})
