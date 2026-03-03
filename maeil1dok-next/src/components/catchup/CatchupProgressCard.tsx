import type { CatchupSession } from '@/types'
import { Card, CardBody, ProgressBar } from '@/components/ui'
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
    <Card data-testid="catchup-progress-card" className="border-[var(--color-success-bg)]">
      <CardBody className="p-4">
        <p className="text-[var(--font-size-xs)] font-semibold tracking-[0.12em] text-[var(--color-success-text)]">CATCHUP SESSION</p>
        <h2 className="mt-1 text-[var(--font-size-lg)] font-semibold text-[var(--color-text-primary)]">{session.name}</h2>
        <p className="mt-1 text-[var(--font-size-xs)] text-[var(--color-text-tertiary)]">
          {session.rangeStart} ~ {session.rangeEnd}
        </p>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">진행률</p>
            <p className="text-[var(--font-size-2xl)] font-bold text-[var(--color-text-primary)]">
              {completedCount} / {totalCount}
            </p>
          </div>
          <span className="rounded-lg bg-[var(--color-success-bg)] px-2.5 py-1 text-[var(--font-size-sm)] font-semibold text-[var(--color-success-text)]">{percentage}%</span>
        </div>

        <div className="mt-3">
          <ProgressBar value={completedCount} max={totalCount} variant="success" />
        </div>

        <p className="mt-3 text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          예상 완료일: <strong className="font-semibold text-[var(--color-text-primary)]">{formatDate(estimatedCompletionDate)}</strong>
        </p>
      </CardBody>
    </Card>
  )
}
