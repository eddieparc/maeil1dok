'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-secondary)]">
      <div className="text-center">
        <h1
          className="text-[40px] font-medium text-[var(--color-ink)] -tracking-[0.035em] leading-[1.15] mb-4"
          style={{ fontFamily: 'var(--font-family-serif)' }}
        >
          오류가 발생했습니다
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          문제가 발생했습니다. 다시 시도해주세요.
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
