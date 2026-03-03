interface CalendarHeaderProps {
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export default function CalendarHeader({ year, month, onPrevMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  return (
    <header data-testid="calendar-header" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
      <button
        type="button"
        onClick={onPrevMonth}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
        aria-label="이전 달"
      >
        ←
      </button>

      <div className="text-center">
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">{year}년 {String(month).padStart(2, '0')}월</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="rounded-full border border-[var(--color-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
        >
          오늘
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
          aria-label="다음 달"
        >
          →
        </button>
      </div>
    </header>
  )
}
