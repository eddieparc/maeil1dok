'use client'

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
  return (
    <section>
      <div
        className={cn(
          'rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)]',
          'px-6 py-8 text-center',
        )}
      >
        <div className="mb-4 text-5xl">📖</div>
        <h2
          className="mb-2 text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
          style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: '1.375rem',
            fontWeight: 500,
          }}
        >
          매일일독에 오신 것을 환영합니다
        </h2>
        <p
          className="mb-6 text-[14px] font-medium text-[var(--color-mute)] -tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          성경을 읽고, 묵상하고, 기록해보세요
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full px-4 py-3',
              'bg-[var(--color-ink)] text-[13px] font-semibold text-[var(--color-paper)] -tracking-[0.012em]',
              'transition-colors hover:bg-[var(--color-brand-deep)]',
            )}
            style={{ fontFamily: 'var(--font-family-ui)' }}
            onClick={onViewTOC}
          >
            <ListIcon className="h-[14px] w-[14px]" />
            성경 목차에서 시작하기
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-rule)] px-4 py-3',
                'bg-transparent text-[13px] font-semibold text-[var(--color-ink)] -tracking-[0.012em]',
                'transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-brand-faint)]',
              )}
              style={{ fontFamily: 'var(--font-family-ui)' }}
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
