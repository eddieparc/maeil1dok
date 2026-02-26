export interface TogglePlanItem {
  subscriptionId: string
  planName: string
  color: string
}

interface PlanTogglePanelProps {
  plans: TogglePlanItem[]
  visiblePlanIds: Set<string>
  onToggle: (subscriptionId: string) => void
}

export default function PlanTogglePanel({ plans, visiblePlanIds, onToggle }: PlanTogglePanelProps) {
  return (
    <section data-testid="plan-toggle-panel" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">표시할 플랜</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {plans.map((plan) => {
          const isVisible = visiblePlanIds.has(plan.subscriptionId)

          return (
            <button
              key={plan.subscriptionId}
              type="button"
              onClick={() => onToggle(plan.subscriptionId)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                isVisible ? 'border-gray-300 bg-white text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
              <span>{plan.planName}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
