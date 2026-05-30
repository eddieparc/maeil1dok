import type { CatchupSession } from '@/types'

interface CatchupProgressCardProps {
  session: CatchupSession
  completedCount: number
  totalCount: number
  estimatedCompletionDate: string | null
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function CatchupProgressCard({
  session,
  completedCount,
  totalCount,
  estimatedCompletionDate,
}: CatchupProgressCardProps) {
  const percentage = totalCount === 0 ? 0 : Math.min(100, Math.round((completedCount / totalCount) * 100))

  return (
    <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p
            className="mb-1 text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
            style={{ fontFamily: 'var(--font-family-ui)' }}
          >
            진행 중인 캐치업
          </p>
          <h3
            className="text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
            style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.375rem',
              fontWeight: 500,
            }}
          >
            {session.name}
          </h3>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-faint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {percentage}%
        </span>
      </div>

      <div className="mb-4">
        <div
          className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          <span>전체 진행</span>
          <span>
            {completedCount} / {totalCount}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-rule)]">
          <div
            className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div
        className="mb-4 flex items-center gap-2 rounded-2xl border border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)] px-4 py-3 text-[13px] font-medium text-[var(--color-ink)] -tracking-[0.008em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-[var(--color-brand)]"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>
          예상 완료일:{' '}
          <strong className="font-semibold text-[var(--color-ink)] tabular-nums">
            {formatDate(estimatedCompletionDate)}
          </strong>
        </span>
      </div>
    </div>
  )
}
