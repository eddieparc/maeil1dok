'use client'

import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContentBottomActionProps {
  tongdokMode: boolean
  tongdokRangeText: string
  tongdokProgress: { completed: number; total: number }
  currentChapterRead: boolean
  bookName: string
  bookProgress: { read: number; total: number }
  onMarkAsRead: () => void
}

export default function ContentBottomAction({
  tongdokMode,
  tongdokRangeText,
  tongdokProgress,
  currentChapterRead,
  bookName,
  bookProgress,
  onMarkAsRead,
}: ContentBottomActionProps) {
  return (
    <div className="content-bottom-action">
      {/* Mark as read / tongdok complete */}
      {tongdokMode ? (
        <button
          type="button"
          className="mark-read-btn"
          onClick={onMarkAsRead}
        >
          <CheckCircle2 size={18} />
          <span>통독 완료</span>
        </button>
      ) : (
        <button
          type="button"
          className={cn('mark-read-btn w-full max-w-none', currentChapterRead && 'is-read')}
          onClick={onMarkAsRead}
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{currentChapterRead ? '읽음 완료' : '읽음으로 표시'}</span>
        </button>
      )}

      {/* Book progress (non-tongdok mode) */}
      {!tongdokMode && bookProgress.total > 0 ? (
        <div className="flex flex-col items-center gap-2 w-full max-w-[260px] p-4 bg-[var(--color-bg-secondary)] rounded-[14px] border border-[var(--color-border-light)] dark:border-white/[.08]">
          <span className="text-[0.8125rem] font-semibold text-[var(--color-text-primary)] whitespace-nowrap tracking-tight">
            {bookName} 읽기 진도
          </span>
          <div className="book-progress-bar">
            <div
              className="book-progress-fill"
              style={{ width: `${bookProgress.total > 0 ? Math.round((bookProgress.read / bookProgress.total) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap tracking-tight">
            {bookProgress.read} / {bookProgress.total}장{' '}
            <span className="text-[var(--color-brand)] font-semibold">
              ({bookProgress.total > 0 ? Math.round((bookProgress.read / bookProgress.total) * 100) : 0}%)
            </span>
          </span>
        </div>
      ) : null}

      {/* Tongdok range info */}
      {tongdokMode ? (
        <div className="text-xs text-[var(--color-text-tertiary)] text-center">
          <p className="font-medium">{tongdokRangeText}</p>
          <p className="mt-0.5">
            진행: {tongdokProgress.completed}/{tongdokProgress.total}
          </p>
        </div>
      ) : null}
    </div>
  )
}
