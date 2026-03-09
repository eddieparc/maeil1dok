'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
    <svg aria-hidden="true" className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  const router = useRouter()

  return (
    <>
      {schedule && (
        <section>
          <div
            className={cn(
              'rounded-2xl p-5 text-white shadow-lg',
              'bg-gradient-to-br from-[var(--color-accent-primary)] to-[var(--color-accent-hover)]',
            )}
          >
            {/* Card header */}
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                오늘의 통독
              </span>
              <span className="text-[0.8125rem] opacity-90">{formatTodayDate()}</span>
            </div>

            {/* Schedule info */}
            <div className="mb-4">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-xl font-bold">{schedule.bookName}</span>
                <span className="text-base opacity-90">{schedule.range}</span>
              </div>

              {/* Progress indicator */}
              {schedule.total > 1 && (
                <div className="flex items-center gap-3">
                  <span className="whitespace-nowrap text-xs opacity-90">
                    {schedule.completed}/{schedule.total} 완료
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-300"
                      style={{
                        width: `${(schedule.completed / schedule.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Start button */}
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[0.9375rem] font-semibold transition-all',
                schedule.isCompleted
                  ? 'bg-white/20 text-white'
                  : 'bg-white text-[var(--color-accent-primary)] hover:-translate-y-0.5 hover:shadow-lg',
              )}
              onClick={onStart}
            >
              {schedule.isCompleted ? (
                <>
                  <CheckCircleIcon />
                  <span>완료됨</span>
                </>
              ) : (
                <>
                  <PlayIcon />
                  <span>통독 시작</span>
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
              'flex items-center gap-2 rounded-[10px] bg-[var(--color-bg-tertiary)] p-3',
              'text-[0.8125rem] text-[var(--color-text-secondary)]',
            )}
          >
            <InfoIcon />
            <span>플랜을 구독하면 매일 통독 일정을 받을 수 있어요</span>
            <button
              type="button"
              className="ml-auto font-medium text-[var(--color-accent-primary)]"
              onClick={onPlanClick}
            >
              플랜 보기
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-4 w-4', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
    </svg>
  )
}
