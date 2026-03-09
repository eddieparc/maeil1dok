'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface WelcomeGuideProps {
  isAuthenticated: boolean
  onViewTOC: () => void
  onPlanClick: () => void
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

export default function WelcomeGuide({
  isAuthenticated,
  onViewTOC,
  onPlanClick,
}: WelcomeGuideProps) {
  const router = useRouter()

  return (
    <section>
      <div
        className={cn(
          'rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]',
          'px-6 py-8 text-center',
        )}
      >
        <div className="mb-4 text-5xl">📖</div>
        <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
          매일일독에 오신 것을 환영합니다!
        </h2>
        <p className="mb-6 text-[0.9375rem] text-[var(--color-text-secondary)]">
          성경을 읽고, 묵상하고, 기록해보세요.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-3.5',
              'bg-[var(--color-accent-primary)] text-[0.9375rem] font-medium text-white',
              'transition-all hover:bg-[var(--color-accent-hover)]',
            )}
            onClick={onViewTOC}
          >
            <ListIcon className="h-[18px] w-[18px]" />
            성경 목차에서 시작하기
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className={cn(
                'flex items-center justify-center gap-2 rounded-[10px] border border-[var(--color-border-default)] px-4 py-3.5',
                'bg-[var(--color-bg-tertiary)] text-[0.9375rem] font-medium text-[var(--color-text-primary)]',
                'transition-all hover:bg-[var(--color-bg-primary)]',
              )}
              onClick={onPlanClick}
            >
              <CalendarIcon />
              통독 플랜 구독하기
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
