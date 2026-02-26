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
  return (
    <div className={`min-h-20 rounded-lg border border-gray-100 bg-white p-2 ${date.isCurrentMonth ? '' : 'opacity-40'}`}>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            date.isToday ? 'bg-blue-600 text-white ring-2 ring-blue-200' : 'text-gray-700'
          }`}
        >
          {date.date.getDate()}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {dots.map((dot) => (
          <span
            key={dot.subscriptionId}
            title={`${dot.planName} ${dot.isCompleted ? '완료' : '예정'}`}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dot.isCompleted ? dot.color : '#D1D5DB' }}
          />
        ))}
      </div>
    </div>
  )
}
