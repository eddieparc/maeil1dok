'use client'

interface ChapterErrorProps {
  error: string
  onRetry?: () => void
}

export default function ChapterError({ error, onRetry }: ChapterErrorProps) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 text-center p-6">
      <p className="text-base font-semibold text-[var(--color-text-primary)]">본문을 불러오지 못했습니다.</p>
      <p className="max-w-md text-sm text-[var(--color-text-secondary)]">{error}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:opacity-90"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  )
}
