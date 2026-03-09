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
    <div className="rounded-2xl border border-[var(--color-surface-secondary)] bg-[var(--color-bg-card)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">🏃</span>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{session.name}</h3>
      </div>

      <div className="mb-4">
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-info)] to-blue-400 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-[var(--color-info)]">{percentage}%</span>
          <span className="text-[var(--color-text-secondary)]">({completedCount}/{totalCount})</span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-surface-secondary)] px-4 py-3 text-sm">
        <span className="text-base">📅</span>
        <span className="text-[var(--color-text-primary)]">
          예상 완료일: <strong className="font-semibold">{formatDate(estimatedCompletionDate)}</strong>
        </span>
      </div>

      <div className="flex gap-3">
        <button type="button" className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-3 font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)]">
          <span>⚙️</span>
          계획수정
        </button>
        <button type="button" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-info)] px-3 py-3 font-semibold text-white transition-colors hover:bg-blue-700">
          <span>✅</span>
          따라잡기완료
        </button>
      </div>
    </div>
  )
}
