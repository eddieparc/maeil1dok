'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export function IntroCard() {
  return (
    <Link href="/intro" data-testid="card-intro">
      <div
        className={cn(
          'flex w-full flex-col justify-center overflow-hidden rounded-3xl border p-5 transition-all duration-300',
          'cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(44,51,51,0.08)] active:scale-[0.98]',
          'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200/20',
          'dark:from-blue-950 dark:to-indigo-900 dark:border-blue-500/20',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent-primary)]">
          THIS WEEK&apos;S INTRO
        </span>
        <h2
          className="mt-2 mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
        >
          이번 주
          <br />
          <strong className="font-bold">개론을 시청해보세요</strong>
        </h2>
        <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
          성경의 배경과 흐름을 이해할 수 있어요
        </div>
        <span className="inline-flex items-center gap-2 border-b border-current pb-1 text-base font-medium text-[#1E40AF] transition-opacity hover:opacity-70 dark:text-blue-300">
          개론 영상 보기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginLeft: 4 }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
