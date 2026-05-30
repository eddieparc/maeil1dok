'use client'

import { cn } from '@/lib/utils'

interface TodaySchedule {
  id: string
  bookCode: string
  bookName: string
  range: string
  startChapter: number
  endChapter: number
  total: number
  completed: number
  isCompleted: boolean
  planId: number
}

interface TodayTongdokCardProps {
  schedule: TodaySchedule | null
  hasPlan: boolean
  isAuthenticated: boolean
  isLoading: boolean
  onStart: () => void
  onPlanClick: () => void
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[14px] w-[14px]', className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[14px] w-[14px]', className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[13px] w-[13px]', className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-4 w-4', className)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

function formatTodayDate(): string {
  const today = new Date()
  return today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

export default function TodayTongdokCard({
  schedule,
  hasPlan,
  isAuthenticated,
  isLoading,
  onStart,
  onPlanClick,
}: TodayTongdokCardProps) {
  return (
    <>
      {schedule && (
        <section>
          <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="mb-1 text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  오늘의 통독 · {formatTodayDate()}
                </p>
                <div className="flex items-baseline gap-2">
                  <h2
                    className="text-[var(--color-ink)] leading-[1.25] -tracking-[0.025em]"
                    style={{
                      fontFamily: 'var(--font-family-serif)',
                      fontSize: 'clamp(1.25rem, 5vw, 1.5rem)',
                      fontWeight: 500,
                    }}
                  >
                    {schedule.bookName}
                  </h2>
                  <span
                    className="text-[15px] font-medium text-[var(--color-mute)] -tracking-[0.012em] tabular-nums"
                    style={{ fontFamily: 'var(--font-family-ui)' }}
                  >
                    {schedule.range}
                  </span>
                </div>
              </div>
              {schedule.isCompleted && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-success-text)] -tracking-[0.005em]"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  <CheckIcon className="h-[11px] w-[11px]" />
                  완료
                </span>
              )}
            </div>

            {schedule.total > 1 && (
              <div className="mb-4">
                <div
                  className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  <span>오늘 진행</span>
                  <span>
                    {schedule.completed} / {schedule.total}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-rule)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-500"
                    style={{
                      width: `${(schedule.completed / schedule.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold -tracking-[0.012em] transition-colors',
                schedule.isCompleted
                  ? 'border border-[var(--color-rule)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-ink)]'
                  : 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-brand-deep)]',
              )}
              style={{ fontFamily: 'var(--font-family-ui)' }}
              onClick={onStart}
            >
              {schedule.isCompleted ? (
                <>
                  다시 읽기
                  <ArrowRight />
                </>
              ) : (
                <>
                  <PlayIcon />
                  통독 시작
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {!hasPlan && isAuthenticated && !isLoading && (
        <section>
          <div
            className={cn(
              'flex items-center gap-2 rounded-2xl border border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)] p-3.5',
              'text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]',
            )}
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            <InfoIcon className="text-[var(--color-brand)]" />
            <span className="flex-1">플랜을 구독하면 매일 통독 일정을 받을 수 있어요</span>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-paper)] transition-colors hover:bg-[var(--color-brand-deep)]"
              onClick={onPlanClick}
            >
              플랜 보기
              <ArrowRight className="h-[11px] w-[11px]" />
            </button>
          </div>
        </section>
      )}
    </>
  )
}
