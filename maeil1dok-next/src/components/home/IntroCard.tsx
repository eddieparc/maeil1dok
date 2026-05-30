'use client'

import Link from 'next/link'

export function IntroCard() {
  return (
    <Link
      href="/intro"
      data-testid="card-intro"
      className="group block w-full overflow-hidden rounded-2xl border border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] active:scale-[0.99]"
    >
      <p
        className="mb-2 text-[11px] font-semibold text-[var(--color-brand)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        이번 주 · 개론
      </p>
      <h2
        className="mb-1 text-[var(--color-ink)] leading-[1.2] -tracking-[0.025em]"
        style={{
          fontFamily: 'var(--font-family-serif)',
          fontSize: 'clamp(1.375rem, 5.5vw, 1.625rem)',
          fontWeight: 500,
        }}
      >
        이번 주 개론을 만나보세요
      </h2>
      <p className="mb-4 text-[13px] text-[var(--color-mute)] -tracking-[0.008em]">
        성경의 배경과 흐름을 짧은 영상으로 정리했어요
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-[13px] font-semibold text-[var(--color-paper)] transition-colors group-hover:bg-[var(--color-brand-deep)]">
        개론 영상 보기
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </span>
    </Link>
  )
}
