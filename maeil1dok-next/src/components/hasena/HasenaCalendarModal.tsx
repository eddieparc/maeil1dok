'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HasenaCalendarEntry {
  readonly date: string
  readonly passage: string
  readonly videoId: string
  readonly title: string
  readonly isCompleted: boolean
}

interface HasenaCalendarModalProps {
  readonly isOpen: boolean
  readonly selectedDate: string
  readonly today: string
  readonly onClose: () => void
  readonly onSelectDate: (date: string) => void
}

interface CalendarCell {
  readonly date: string
  readonly day: number
  readonly otherMonth: boolean
  readonly isToday: boolean
  readonly isSelected: boolean
  readonly isFuture: boolean
  readonly isSunday: boolean
  readonly entry: HasenaCalendarEntry | null
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

export function HasenaCalendarModal({ isOpen, selectedDate, today, onClose, onSelectDate }: HasenaCalendarModalProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(selectedDate))
  const [entries, setEntries] = useState<HasenaCalendarEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [year, month] = visibleMonth.split('-').map(Number)
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries])

  const cells = useMemo(
    () => buildCalendarCells(year, month, today, selectedDate, entryByDate),
    [entryByDate, month, selectedDate, today, year],
  )

  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/hasena/calendar?year=${year}&month=${month}`)
      if (!response.ok) throw new Error('calendar failed')
      const data: { entries?: HasenaCalendarEntry[] } = await response.json()
      setEntries(data.entries ?? [])
    } catch {
      setError('달력 정보를 불러오지 못했습니다')
      setEntries([])
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    if (!isOpen) return
    setVisibleMonth(monthKey(selectedDate))
  }, [isOpen, selectedDate])

  useEffect(() => {
    if (!isOpen) return
    void loadEntries()
  }, [isOpen, loadEntries])

  if (!isOpen) return null

  const isCurrentMonth = visibleMonth === monthKey(today)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" onClick={onClose}>
      <section
        className="max-h-[88dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-card)] shadow-[var(--shadow-md)]"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="hasena-calendar-title"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border-light)] px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[var(--color-brand)]" />
            <h2 id="hasena-calendar-title" className="text-base font-semibold">하세나 달력</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-[var(--color-bg-hover)]" aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" className="rounded-full p-2 hover:bg-[var(--color-bg-hover)]" aria-label="이전 달" onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}>
              <ChevronLeft size={20} />
            </button>
            <strong className="text-sm font-semibold">{year}년 {month}월</strong>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-[var(--color-bg-hover)] disabled:opacity-40"
              aria-label="다음 달"
              disabled={isCurrentMonth}
              onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--color-text-tertiary)]">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-2">{weekday}</span>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1 py-2">
              {Array.from({ length: 42 }, (_, index) => (
                <div key={index} className="aspect-square rounded-xl bg-[var(--color-bg-tertiary)]" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-lg bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">{error}</p>
          ) : (
            <div className="grid grid-cols-7 gap-1 py-2">
              {cells.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  disabled={cell.otherMonth || cell.isFuture || cell.isSunday || !cell.entry?.passage}
                  className={cn(
                    'relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl border text-sm transition-colors',
                    cell.otherMonth && 'text-[var(--color-text-tertiary)] opacity-35',
                    cell.entry?.passage ? 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]' : 'border-transparent bg-transparent',
                    cell.isSelected && 'border-[var(--color-brand)] bg-[var(--color-accent-light)] text-[var(--color-brand)]',
                    cell.entry?.isCompleted && 'border-[var(--color-success)]',
                    !cell.entry?.passage && !cell.otherMonth && 'text-[var(--color-text-tertiary)]',
                    'disabled:cursor-not-allowed',
                  )}
                  onClick={() => {
                    onSelectDate(cell.date)
                    onClose()
                  }}
                >
                  <span>{cell.day}</span>
                  {cell.entry?.isCompleted ? (
                    <Check size={13} strokeWidth={3} className="absolute bottom-1 text-[var(--color-success)]" />
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span className="inline-flex items-center gap-1"><Check size={13} className="text-[var(--color-success)]" /> 완료</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" /> 본문 있음</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function buildCalendarCells(
  year: number,
  month: number,
  today: string,
  selectedDate: string,
  entryByDate: ReadonlyMap<string, HasenaCalendarEntry>,
): CalendarCell[] {
  const monthIndex = month - 1
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: CalendarCell[] = []

  for (let index = firstDay.getDay() - 1; index >= 0; index -= 1) {
    cells.push(toCell(new Date(year, monthIndex, -index), true, today, selectedDate, entryByDate))
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toCell(new Date(year, monthIndex, day), false, today, selectedDate, entryByDate))
  }

  const remaining = 42 - cells.length
  for (let day = 1; day <= remaining; day += 1) {
    cells.push(toCell(new Date(year, monthIndex + 1, day), true, today, selectedDate, entryByDate))
  }

  return cells
}

function toCell(
  date: Date,
  otherMonth: boolean,
  today: string,
  selectedDate: string,
  entryByDate: ReadonlyMap<string, HasenaCalendarEntry>,
): CalendarCell {
  const dateValue = formatDate(date)
  return {
    date: dateValue,
    day: date.getDate(),
    otherMonth,
    isToday: dateValue === today,
    isSelected: dateValue === selectedDate,
    isFuture: dateValue > today,
    isSunday: date.getDay() === 0,
    entry: entryByDate.get(dateValue) ?? null,
  }
}

function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split('-').map(Number)
  return monthKey(formatDate(new Date(year, month - 1 + offset, 1)))
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
