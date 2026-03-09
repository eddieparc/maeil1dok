'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Home, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BibleBottomNavProps {
  bookName: string
  chapter: number
  hasPrevChapter: boolean
  hasNextChapter: boolean
  userId?: string
  onPrevChapter: () => void
  onNextChapter: () => void
  onOpenBookSelector: () => void
}

export default function BibleBottomNav({
  bookName,
  chapter,
  hasPrevChapter,
  hasNextChapter,
  userId,
  onPrevChapter,
  onNextChapter,
  onOpenBookSelector,
}: BibleBottomNavProps) {
  return (
    <nav aria-label="성경 읽기 네비게이션" className="bible-floating-nav">
      <div className="flex items-center justify-between px-2 py-2 min-h-[46px] gap-2">
        {/* Home */}
        <Link
          href="/"
          aria-label="홈으로"
          className="flex items-center justify-center w-8 h-8 text-[var(--color-text-tertiary)] rounded-lg transition-all hover:text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-light)] active:scale-[0.92] no-underline shrink-0"
        >
          <Home size={16} aria-hidden="true" />
        </Link>

        {/* Center: prev / chapter-info / next */}
        <div className="flex items-center justify-center gap-1 flex-1 min-w-0 overflow-hidden">
          <button
            type="button"
            aria-label="이전 장"
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md transition-all bg-transparent border-none cursor-pointer shrink-0',
              hasPrevChapter
                ? 'text-[var(--color-text-secondary)] hover:scale-[1.15] hover:text-[var(--color-accent-primary)] active:scale-95'
                : 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed',
            )}
            disabled={!hasPrevChapter}
            onClick={onPrevChapter}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-label={`${bookName} ${chapter}장 선택`}
            className="chapter-info-btn"
            onClick={onOpenBookSelector}
          >
            <span className="font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">
              {bookName} {chapter}장
            </span>
          </button>

          <button
            type="button"
            aria-label="다음 장"
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md transition-all bg-transparent border-none cursor-pointer shrink-0',
              hasNextChapter
                ? 'text-[var(--color-text-secondary)] hover:scale-[1.15] hover:text-[var(--color-accent-primary)] active:scale-95'
                : 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed',
            )}
            disabled={!hasNextChapter}
            onClick={onNextChapter}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Profile */}
        <Link
          href={userId ? `/profile/${userId}` : '/login'}
          aria-label="프로필"
          className="flex items-center justify-center w-8 h-8 text-[var(--color-text-tertiary)] rounded-lg transition-all hover:text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-light)] active:scale-[0.92] no-underline shrink-0"
        >
          <User size={16} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}
