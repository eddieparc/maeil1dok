import type { CalendarDate } from './generateCalendarDates'
export interface CalendarDot {
  subscriptionId: string
  color: string
  isCompleted: boolean
  planName: string
}

interface CalendarDayCellProps {
  date: CalendarDate
  dots: CalendarDot[]
}

export default function CalendarDayCell({ date, dots }: CalendarDayCellProps) {
  const completedDots = dots.filter((dot) => dot.isCompleted)
  const hasReading = completedDots.length > 0
  const isSunday = date.date.getDay() === 0

  return (
    <div
      className={[
        'relative flex aspect-square flex-col items-center justify-center rounded-lg',
        !date.isCurrentMonth ? 'opacity-30' : '',
        hasReading ? 'bg-[var(--color-success-bg)]' : '',
        date.isToday ? 'ring-1 ring-[var(--color-primary)]' : '',
      ].join(' ')}
    >
      <span
        className={[
          'text-[0.8125rem] text-[var(--color-text-primary)]',
          isSunday ? 'text-[var(--color-danger)]' : '',
          date.isToday ? 'font-semibold text-[var(--color-primary)]' : '',
        ].join(' ')}
      >
        {date.date.getDate()}
      </span>

      {hasReading ? (
        <div className="absolute bottom-1 flex items-center gap-1" aria-label="읽기 완료" role="img">
          {completedDots.slice(0, 4).map((dot) => (
            <span key={dot.subscriptionId} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: dot.color }} title={`${dot.planName} 완료`} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
