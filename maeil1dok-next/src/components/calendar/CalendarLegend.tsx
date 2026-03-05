interface LegendPlanItem {
  subscriptionId: string
  planName: string
  color: string
}

interface CalendarLegendProps {
  visiblePlans: LegendPlanItem[]
}

export default function CalendarLegend({ visiblePlans }: CalendarLegendProps) {
  if (visiblePlans.length === 0) {
    return <p className="text-center text-xs text-[var(--color-text-muted)]">표시 중인 플랜이 없습니다</p>
  }

  return (
    <div className="flex items-center justify-center">
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
        읽음
      </span>
    </div>
  )
}
