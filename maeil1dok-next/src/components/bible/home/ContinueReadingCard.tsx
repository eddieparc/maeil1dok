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
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        계속 읽기
      </h2>
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between rounded-xl border border-[var(--color-border-default)]',
          'bg-[var(--color-bg-secondary)] px-5 py-4 text-[var(--color-text-primary)]',
          'transition-all hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-tertiary)]',
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {bookName}
          </span>
          <span className="text-[0.9375rem] text-[var(--color-text-secondary)]">
            {chapter}
            {chapterUnit}
          </span>
        </div>
        <ArrowRightIcon className="text-[var(--color-text-muted)]" />
      </button>
    </section>
  )
}
