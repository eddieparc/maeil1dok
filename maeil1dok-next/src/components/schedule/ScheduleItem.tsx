import type { DailySchedule } from '@/types'

interface ScheduleItemProps {
  schedule: DailySchedule
  isCompleted: boolean
  isToday: boolean
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${parseInt(month, 10)}월 ${parseInt(day, 10)}일`
}

function formatChapterRange(start: number, end: number): string {
  if (start === end) return `${start}장`
  return `${start}-${end}장`
}

export default function ScheduleItem({ schedule, isCompleted, isToday }: ScheduleItemProps) {
  return (
    <div
      data-testid="schedule-item"
      className={`flex items-center gap-3 rounded-xl bg-[var(--color-bg-secondary)] px-4 py-3 shadow-sm transition-all border border-[var(--color-border-light)] ${
        isToday ? 'ring-2 ring-[var(--color-primary)] ring-offset-1' : ''
      }`}
    >
      {/* Completion indicator */}
      <div className="flex-shrink-0">
        {isCompleted ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--color-success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div className="h-7 w-7 rounded-full border-2 border-[var(--color-border-dark)]" />
        )}
      </div>

      {/* Schedule info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-medium ${isCompleted ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
            {schedule.book}
          </span>
          <span className={`text-sm ${isCompleted ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-secondary)]'}`}>
            {formatChapterRange(schedule.startChapter, schedule.endChapter)}
          </span>
        </div>
        <p className={`mt-0.5 text-xs ${isToday ? 'font-medium text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
          {isToday ? '오늘' : formatDate(schedule.date)}
        </p>
      </div>

      {/* Today badge */}
      {isToday && !isCompleted && (
        <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
          오늘
        </span>
      )}
    </div>
  )
}
