'use client'

import { cn } from '@/lib/utils'

interface FeatureCardsProps {
  bookmarkCount: number
  noteCount: number
  highlightCount: number
  onBookmarks: () => void
  onNotes: () => void
  onHighlights: () => void
  onHistory: () => void
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function HighlightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-[18px] w-[18px]', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

interface FeatureCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  name: string
  count?: number
  description: string
  onClick: () => void
}

function FeatureCard({ icon, iconBg, iconColor, name, count, description, onClick }: FeatureCardProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl border border-[var(--color-rule)]',
        'bg-[var(--color-paper)] p-4 text-left',
        'transition-colors hover:border-[var(--color-ink)]',
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          iconBg,
          iconColor,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className="text-[15px] font-semibold text-[var(--color-ink)] -tracking-[0.012em]"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            {name}
          </span>
          {count != null && count > 0 && (
            <span
              className={cn(
                'rounded-full bg-[var(--color-brand-faint)] px-2 py-0.5',
                'text-[11px] font-semibold text-[var(--color-brand)] tabular-nums',
              )}
              style={{ fontFamily: 'var(--font-family-ui)' }}
            >
              {count}
            </span>
          )}
        </div>
        <p
          className="truncate text-[13px] text-[var(--color-mute)] -tracking-[0.008em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {description}
        </p>
      </div>
      <ChevronRightIcon className="shrink-0 text-[var(--color-subtle)]" />
    </button>
  )
}

export default function FeatureCards({
  bookmarkCount,
  noteCount,
  highlightCount,
  onBookmarks,
  onNotes,
  onHighlights,
  onHistory,
}: FeatureCardsProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        내 성경 활동
      </h2>
      <div className="flex flex-col gap-2">
        <FeatureCard
          icon={<BookmarkIcon />}
          iconBg="bg-[var(--color-warning-bg)]"
          iconColor="text-[var(--color-warning-text)]"
          name="북마크"
          count={bookmarkCount}
          description={
            bookmarkCount > 0
              ? `저장된 ${bookmarkCount}개의 장`
              : '자주 찾는 장을 저장하세요'
          }
          onClick={onBookmarks}
        />
        <FeatureCard
          icon={<DocumentIcon />}
          iconBg="bg-[var(--color-info-bg)]"
          iconColor="text-[var(--color-info-text)]"
          name="묵상노트"
          count={noteCount}
          description={
            noteCount > 0
              ? `작성된 ${noteCount}개의 노트`
              : '말씀을 읽고 묵상을 기록하세요'
          }
          onClick={onNotes}
        />
        <FeatureCard
          icon={<HighlightIcon />}
          iconBg="bg-[var(--color-danger-bg)]"
          iconColor="text-[var(--color-danger-text)]"
          name="하이라이트"
          count={highlightCount}
          description={
            highlightCount > 0
              ? `표시된 ${highlightCount}개의 구절`
              : '중요한 구절에 색상을 입히세요'
          }
          onClick={onHighlights}
        />
        <FeatureCard
          icon={<HistoryIcon />}
          iconBg="bg-[var(--color-success-bg)]"
          iconColor="text-[var(--color-success-text)]"
          name="읽기 기록"
          description="읽은 장과 날짜를 확인하세요"
          onClick={onHistory}
        />
      </div>
    </section>
  )
}
