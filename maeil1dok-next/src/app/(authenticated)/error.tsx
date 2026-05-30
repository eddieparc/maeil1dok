'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthenticatedError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Authenticated route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <h1
          className="mb-2 text-[28px] font-medium text-[var(--color-ink)] -tracking-[0.03em] leading-[1.2]"
          style={{ fontFamily: 'var(--font-family-serif)' }}
        >
          문제가 발생했습니다
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          잠시 후 다시 시도해주세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            type="button"
            className="rounded-lg bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--color-border-default)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
