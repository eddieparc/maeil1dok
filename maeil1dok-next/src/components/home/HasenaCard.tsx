'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export function HasenaCard() {
  return (
    <Link href="/hasena" data-testid="card-hasena">
      <div
        className={cn(
          'flex w-full flex-col justify-center overflow-hidden rounded-3xl border p-5 transition-all duration-300',
          'cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(44,51,51,0.08)] active:scale-[0.98]',
          'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200/20',
          'dark:from-amber-950 dark:to-yellow-900 dark:border-amber-500/20',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent-primary)]">
          TODAY&apos;S SUGGESTION
        </span>
        <h2
          className="mt-2 mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
        >
          오늘의 통독을
          <br />
          <strong className="font-bold">완료했어요! 👏</strong>
        </h2>
        <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
          하세나하시조 영상을 시청해보세요
        </div>
        <span className="inline-flex items-center gap-2 border-b border-current pb-1 text-base font-medium text-[#92400E] transition-opacity hover:opacity-70 dark:text-amber-300">
          하세나 보러가기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginLeft: 4 }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
