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
    return <p className="text-sm text-gray-500">표시 중인 플랜이 없습니다</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {visiblePlans.map((plan) => (
        <div key={plan.subscriptionId} className="inline-flex items-center gap-2 text-xs text-gray-700">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
          <span>{plan.planName}</span>
        </div>
      ))}
    </div>
  )
}
