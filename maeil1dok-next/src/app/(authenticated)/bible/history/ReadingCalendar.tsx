'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ReadingCalendarProps {
  readingDates: string[]
}

export function ReadingCalendar({ readingDates }: ReadingCalendarProps) {
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const readingSet = useMemo(() => new Set(readingDates), [readingDates])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const prevMonthLast = new Date(currentYear, currentMonth, 0)

    const days: Array<{
      day: number
      isCurrentMonth: boolean
      hasReading: boolean
      isToday: boolean
      dayOfWeek: number
    }> = []

    const prevOffset = firstDay.getDay()
    for (let i = prevOffset - 1; i >= 0; i -= 1) {
      const day = prevMonthLast.getDate() - i
      const date = new Date(currentYear, currentMonth - 1, day)
      const iso = date.toISOString().split('T')[0]
      days.push({ day, isCurrentMonth: false, hasReading: readingSet.has(iso), isToday: false, dayOfWeek: date.getDay() })
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(currentYear, currentMonth, day)
      const iso = date.toISOString().split('T')[0]
      days.push({
        day,
        isCurrentMonth: true,
        hasReading: readingSet.has(iso),
        isToday: date.toDateString() === today.toDateString(),
        dayOfWeek: date.getDay(),
      })
    }

    const remaining = 42 - days.length
    for (let day = 1; day <= remaining; day += 1) {
      const date = new Date(currentYear, currentMonth + 1, day)
      const iso = date.toISOString().split('T')[0]
      days.push({ day, isCurrentMonth: false, hasReading: readingSet.has(iso), isToday: false, dayOfWeek: date.getDay() })
    }

    return days
  }, [currentMonth, currentYear, readingSet, today])

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((prev) => prev - 1) }
    else setCurrentMonth((prev) => prev - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((prev) => prev + 1) }
    else setCurrentMonth((prev) => prev + 1)
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          onClick={prevMonth}
          aria-label="이전 달"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          {currentYear}년 {currentMonth + 1}월
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          onClick={nextMonth}
          aria-label="다음 달"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7">
        {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
          <span
            key={weekday}
            className={[
              'py-1 text-center text-xs font-medium',
              weekday === '일' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((date, index) => (
          <div
            key={`${date.day}-${index}`}
            className={[
              'relative flex aspect-square flex-col items-center justify-center rounded-lg',
              !date.isCurrentMonth ? 'opacity-30' : '',
              date.hasReading ? 'bg-[var(--color-success-bg)]' : '',
              date.isToday ? 'ring-1 ring-[var(--primary-color,var(--color-accent-primary))]' : '',
            ].join(' ')}
          >
            <span
              className={[
                'text-[0.8125rem] text-[var(--color-text-primary)]',
                date.dayOfWeek === 0 ? 'text-[var(--color-danger)]' : '',
                date.isToday ? 'font-semibold text-[var(--primary-color,var(--color-accent-primary))]' : '',
              ].join(' ')}
            >
              {date.day}
            </span>
            {date.hasReading ? (
              <span
                className="absolute bottom-1 h-[5px] w-[5px] rounded-full bg-[var(--color-success)]"
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center border-t border-[var(--color-border)] pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
          읽음
        </span>
      </div>
    </div>
  )
}
