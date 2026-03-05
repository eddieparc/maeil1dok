interface CalendarHeaderProps {
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export default function CalendarHeader({ year, month, onPrevMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  return (
    <header data-testid="calendar-header" className="mb-4 flex items-center justify-between">
      <button
        type="button"
        onClick={onPrevMonth}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        aria-label="이전 달"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18L9 12L15 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onToday}
        className="text-base font-semibold text-[var(--color-text-primary)]"
        aria-label="오늘로 이동"
      >
        {year}년 {month}월
      </button>

      <button
        type="button"
        onClick={onNextMonth}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
        aria-label="다음 달"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18L15 12L9 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

    </header>
  )
}
