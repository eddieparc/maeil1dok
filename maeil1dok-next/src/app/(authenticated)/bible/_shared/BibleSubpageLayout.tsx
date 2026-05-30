'use client'

import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'

export interface BibleSubpageLayoutProps {
  title: string
  loading?: boolean
  loadingText?: string
  empty?: boolean
  emptyText?: string
  emptyHint?: string
  emptyGuide?: string[]
  actions?: ReactNode
  tabs?: ReactNode
  filter?: ReactNode
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  children: ReactNode
}

export function BibleSubpageLayout({
  title,
  loading = false,
  loadingText = '불러오는 중...',
  empty = false,
  emptyText = '데이터가 없습니다',
  emptyHint,
  emptyGuide,
  actions,
  tabs,
  filter,
  emptyIcon,
  emptyAction,
  children,
}: BibleSubpageLayoutProps) {
  const router = useRouter()

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] pb-24">
      <div className="mx-auto min-h-dvh max-w-[768px] bg-[var(--color-bg-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => router.back()}
              aria-label="뒤로 가기"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h1
              className="flex-1 text-[20px] font-medium text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
              style={{ fontFamily: 'var(--font-family-serif)' }}
            >
              {title}
            </h1>
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          </div>
          {tabs ? (
            <div className="border-t border-[var(--color-border,var(--color-border-default))] px-2 py-1">
              {tabs}
            </div>
          ) : null}
          {filter ? (
            <div className="border-t border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)]">
              {filter}
            </div>
          ) : null}
        </header>

        {loading ? (
          <section className="flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center gap-3 px-6 text-center text-[var(--color-text-secondary)]">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-sm">{loadingText}</p>
          </section>
        ) : empty ? (
          <section className="flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 text-[var(--color-text-muted)]">{emptyIcon}</div>
            <p className="text-[0.9375rem] text-[var(--color-text-secondary)]">{emptyText}</p>
            {emptyHint ? (
              <p className="mt-1 text-[0.8125rem] text-[var(--color-text-muted)]">{emptyHint}</p>
            ) : null}
            {emptyGuide && emptyGuide.length > 0 ? (
              <ol className="mt-4 w-full max-w-[360px] rounded-xl border border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)] p-4 text-left text-[0.8125rem] text-[var(--color-text-secondary)]">
                {emptyGuide.map((step) => (
                  <li key={step} className="mb-2 last:mb-0">{step}</li>
                ))}
              </ol>
            ) : null}
            {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
          </section>
        ) : (
          <section>{children}</section>
        )}
      </div>
    </main>
  )
}
