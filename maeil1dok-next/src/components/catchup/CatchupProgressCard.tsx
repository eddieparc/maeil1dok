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
    <section data-testid="catchup-progress-card" className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.12em] text-emerald-700">CATCHUP SESSION</p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">{session.name}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {session.rangeStart} ~ {session.rangeEnd}
      </p>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-500">진행률</p>
          <p className="text-2xl font-bold text-gray-900">
            {completedCount} / {totalCount}
          </p>
        </div>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">{percentage}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-50">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
      </div>

      <p className="mt-3 text-sm text-gray-600">
        예상 완료일: <strong className="font-semibold text-gray-900">{formatDate(estimatedCompletionDate)}</strong>
      </p>
    </section>
  )
}
