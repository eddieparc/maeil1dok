'use client'

import Link from 'next/link'

export function HasenaCard() {
  return (
    <Link
      href="/hasena"
      data-testid="card-hasena"
      className="group block w-full overflow-hidden rounded-2xl border border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] active:scale-[0.99]"
    >
      <p
        className="mb-2 text-[11px] font-semibold text-[var(--color-brand)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        다음 단계 · 하세나
      </p>
      <h2
        className="mb-1 text-[var(--color-ink)] leading-[1.2] -tracking-[0.025em]"
        style={{
          fontFamily: 'var(--font-family-serif)',
          fontSize: 'clamp(1.375rem, 5.5vw, 1.625rem)',
          fontWeight: 500,
        }}
      >
        오늘 통독을 마쳤어요
      </h2>
      <p className="mb-4 text-[13px] text-[var(--color-mute)] -tracking-[0.008em]">
        하세나하시조 영상으로 한 걸음 더 깊이 묵상해보세요
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-4 py-2 text-[13px] font-semibold text-[var(--color-paper)] transition-colors group-hover:bg-[var(--color-brand-deep)]">
        하세나 보러가기
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
