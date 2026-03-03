import type { CalendarDate } from './generateCalendarDates'
import Badge from '@/components/ui/Badge'
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
  const hasDots = dots.length > 0
  const allCompleted = hasDots && dots.every(d => d.isCompleted)
  const anyCompleted = hasDots && dots.some(d => d.isCompleted)
  
  let bgClass = 'bg-[var(--color-bg-primary)]'
  if (hasDots) {
    if (allCompleted) bgClass = 'bg-[var(--color-success-bg)]'
    else if (anyCompleted) bgClass = 'bg-[var(--color-primary-bg)]'
    else bgClass = 'bg-[var(--color-bg-secondary)]'
  }

  return (
    <div className={`min-h-20 rounded-lg border border-[var(--color-border-default)] p-2 ${bgClass} ${date.isCurrentMonth ? '' : 'opacity-40'}`}>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            date.isToday ? 'bg-[var(--color-primary)] text-white ring-2 ring-[var(--color-primary-bg)]' : 'text-[var(--color-text-primary)]'
          }`}
        >
          {date.date.getDate()}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        {dots.map((dot) => (
          <div key={dot.subscriptionId} title={`${dot.planName} ${dot.isCompleted ? '완료' : '예정'}`}>
            <Badge
              variant={dot.isCompleted ? 'success' : 'default'}
              size="sm"
              className="w-full justify-center truncate"
            >
              {dot.planName}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
