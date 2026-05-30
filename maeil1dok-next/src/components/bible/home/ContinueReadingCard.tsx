'use client'

import { cn } from '@/lib/utils'

interface ContinueReadingCardProps {
  book: string
  chapter: number
  bookName: string
  chapterUnit: string
  onClick: () => void
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function ContinueReadingCard({
  book,
  chapter,
  bookName,
  chapterUnit,
  onClick,
}: ContinueReadingCardProps) {
  return (
    <section>
      <h2
        className="mb-2 text-[12px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        계속 읽기
      </h2>
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between rounded-2xl border border-[var(--color-rule)]',
          'bg-[var(--color-paper)] px-5 py-4 text-[var(--color-ink)]',
          'transition-colors hover:border-[var(--color-ink)]',
        )}
        onClick={onClick}
      >
        <div className="flex items-baseline gap-2">
          <span
            className="-tracking-[0.025em]"
            style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.0625rem',
              fontWeight: 500,
            }}
          >
            {bookName}
          </span>
          <span
            className="text-[14px] font-medium text-[var(--color-mute)] -tracking-[0.012em] tabular-nums"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            {chapter}
            {chapterUnit}
          </span>
        </div>
        <ArrowRightIcon className="text-[var(--color-subtle)]" />
      </button>
    </section>
  )
}
