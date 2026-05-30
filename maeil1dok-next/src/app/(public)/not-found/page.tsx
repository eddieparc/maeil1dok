import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <h1
          className="text-[64px] font-medium text-[var(--color-ink)] -tracking-[0.04em] leading-[1] mb-4"
          style={{ fontFamily: 'var(--font-family-serif)' }}
        >
          404
        </h1>
        <p
          className="text-[15px] font-medium text-[var(--color-mute)] -tracking-[0.012em] mb-8"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          페이지를 찾을 수 없습니다
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-paper)] -tracking-[0.012em] transition-colors hover:bg-[var(--color-brand-deep)]"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
